// crons/update-coins.js — 코인 가격 갱신 (CF Workers 이식)
// Upbit REST (primary) → Bithumb REST (fallback), CoinPaprika 병렬 보강.
// #104 B1/B2/B4 수정:
//   B1 — Promise.all 단일 실패점 → allSettled 로 부분 성공 허용
//   B2 — CoinPaprika limit=100 → 300 + priceUsd=0 필터링
//   B4 — Upbit ticker 전종목 실패 시 Bithumb public/ticker/ALL_KRW fallback
//
// 타임아웃 예산 (Edge runtime 기본 30s maxDuration):
//   Phase 1: markets(5s) || paprika(4s) 병렬 → ~5s
//   Phase 2: upbit tickers chunks(6s) 병렬   → ~6s
//   Phase 3: bithumb(10s) — Phase 2 전부 실패시에만 실행 → 최대 +10s
//   Worst case (primary 타임아웃 후 fallback): ~5 + 6 + 10 = ~21s < 30s

import { SNAP_KEYS, SNAP_TTL, setSnap, recordCronFailure } from '../price-cache.js';

// #104 Opus: Upbit markets 전량 실패 + Bithumb fallback 경로에서도 최소한의 한글명 보장.
// 라이브 Upbit 한글명 매핑을 1-off 로 추출 (Top 40 KRW 마켓).
// ※ 리브랜드 반영: MATIC → POL, RNDR → RENDER (2024 마이그레이션).
//   fetchUpbitMarkets 가 성공한 정상 경로는 이 정적 맵을 덮어쓰지 않으므로
//   Upbit 공식 한글명과의 표기 drift 위험은 최소화됨.
const COIN_KR_NAMES_FALLBACK = {
  BTC: '비트코인', ETH: '이더리움', XRP: '리플', SOL: '솔라나', DOGE: '도지코인',
  ADA: '에이다', AVAX: '아발란체', DOT: '폴카닷', TRX: '트론', LINK: '체인링크',
  POL: '폴리곤 에코시스템 토큰', NEAR: '니어프로토콜', BCH: '비트코인캐시', LTC: '라이트코인', SHIB: '시바이누',
  ATOM: '코스모스', UNI: '유니스왑', XLM: '스텔라루멘', ETC: '이더리움클래식', FIL: '파일코인',
  APT: '앱토스', ARB: '아비트럼', OP: '옵티미즘', STX: '스택스', HBAR: '헤데라',
  SUI: '수이', TIA: '셀레스티아', INJ: '인젝티브', SEI: '세이', PYTH: '파이스네트워크',
  JUP: '주피터', IMX: '이뮤터블엑스', RENDER: '렌더토큰', GRT: '더그래프', AAVE: '에이브',
  SAND: '샌드박스', MANA: '디센트럴랜드', AXS: '엑시인피니티', APE: '에이프코인', GMT: '스테픈',
};

// Upbit 전종목 KRW 마켓 목록 조회
async function fetchUpbitMarkets(timeoutMs = 5000) {
  const res = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Upbit markets HTTP ${res.status}`);
  const data = await res.json();
  // KRW 마켓만 필터
  return data.filter((m) => m.market.startsWith('KRW-'));
}

// Upbit 티커 배치 조회 — 100개씩 청크 분할 (URL 길이 제한 대비)
const TICKER_BATCH_SIZE = 100;

async function fetchUpbitTickers(markets, timeoutMs = 6000) {
  // #104 Codex P1: 청크 병렬 실행이라 상한은 6s. 남은 ~24s 중 10s 를 Bithumb
  // fallback 에 할당하고 나머지는 Phase 4 의 파이프라인 처리에 사용.
  const chunks = [];
  for (let i = 0; i < markets.length; i += TICKER_BATCH_SIZE) {
    chunks.push(markets.slice(i, i + TICKER_BATCH_SIZE));
  }

  const settled = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const marketStr = chunk.map((m) => m.market).join(',');
      const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketStr}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`Upbit ticker HTTP ${res.status}`);
      return res.json();
    }),
  );

  // 성공한 청크만 병합 — 부분 실패 시 성공 데이터 보존
  const results = settled
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  if (results.length === 0) throw new Error('Upbit ticker: 모든 청크 실패');
  return results.flat();
}

// #104 B4: Bithumb REST fallback — Upbit 완전 실패 시만 호출
// 응답 스키마: { status, data: { BTC: {...}, ETH: {...}, ..., date: "..." } }
// Upbit 티커 포맷으로 정규화하여 동일 파이프라인에 흘려보냄.
//
// ⚠️ 변동률 의미 주의 (#104 Opus 리뷰):
//   - Upbit `signed_change_rate` = (현재가 - 전일 종가) / 전일 종가 → 24h 기준
//   - Bithumb `opening_price`    = 00:00 KST 기준 일일 시가 (일중 리셋)
//   직접 (close-open)/open 을 쓰면 "24h 변동률" 이 "일중 변동률" 로 의미가 바뀐다.
//   Bithumb 는 `fluctate_rate_24H` 필드(24h 변동률, %, 문자열)를 제공하므로 이쪽을 사용.
async function fetchBithumbTickers() {
  const res = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Bithumb ALL_KRW HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== '0000' || !json.data) {
    throw new Error(`Bithumb 응답 비정상: status=${json.status}`);
  }
  const tickers = [];
  for (const [symbol, row] of Object.entries(json.data)) {
    // non-coin 필드(`date` 등) 방어: closing_price 존재 여부를 primary gate 로.
    if (!row || typeof row !== 'object' || row.closing_price == null) continue;
    const close = parseFloat(row.closing_price);
    if (!Number.isFinite(close) || close <= 0) continue;
    // 24h 변동률: fluctate_rate_24H(%) 만 사용.
    // prev_closing_price 는 "전일 종가" 로 00:00 KST 리셋되는 일일 기준이라
    // "24h 롤링" 의미가 아님 → Upbit signed_change_rate 와 드리프트. 없으면 0.
    let changeRate = 0;
    const rate24H = parseFloat(row.fluctate_rate_24H);
    if (Number.isFinite(rate24H)) {
      changeRate = rate24H / 100; // Upbit 와 동일하게 0.05 = 5%
    }
    tickers.push({
      market: `KRW-${symbol}`,
      trade_price: close,
      signed_change_rate: changeRate,
      acc_trade_price_24h: parseFloat(row.acc_trade_value_24H) || 0,
      high_price: parseFloat(row.max_price) || 0,
      low_price:  parseFloat(row.min_price) || 0,
      _source: 'bithumb',
    });
  }
  if (!tickers.length) throw new Error('Bithumb: 유효한 티커 없음');
  return tickers;
}

// CoinPaprika 글로벌 시세 조회 (USD + KRW)
// #104 B2: limit 100 → 300 으로 상향해 Upbit KRW 244 개 커버 (+ 마진).
// #117: limit 300 → 500 으로 추가 상향 + 실패 시 1회 재시도.
//       시총 300위 밖 코인(WAXP, CARV, LSK 등) 컷오프 해소.
// #104 Opus: paprika 는 보강 데이터라 실패해도 snapshot 저장에 영향 없음.
// Edge 10s 예산을 지키기 위해 타임아웃 10s → 4s 로 축소. 실패는 allSettled 가 흡수.
async function fetchCoinPaprikaOnce() {
  const res = await fetch('https://api.coinpaprika.com/v1/tickers?limit=500&quotes=KRW,USD', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`CoinPaprika HTTP ${res.status}`);
  return res.json();
}

async function fetchCoinPaprika() {
  try {
    return await fetchCoinPaprikaOnce();
  } catch (e) {
    // #117: 1회 재시도 (네트워크 일시 실패 대응). 재시도도 실패하면 throw하여
    // 호출부 allSettled가 rejected로 감지하고 정확히 경고 로그를 남기도록 한다.
    console.warn('[update-coins] CoinPaprika 1차 실패 재시도:', e.message);
    return await fetchCoinPaprikaOnce();
  }
}

// #117: CoinGecko 2차 fallback — paprika 누락 심볼만 보강
// 무료 tier 30 req/min. page=1,2 두 번만 호출 → 500개 커버 (안전 마진 충분).
// Promise.allSettled 로 단일 페이지 실패는 흡수. 완전 실패 시 빈 배열.
async function fetchCoinGeckoPage(page, timeoutMs = 4000) {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`CoinGecko page=${page} HTTP ${res.status}`);
  return res.json();
}

async function fetchCoinGecko() {
  const settled = await Promise.allSettled([
    fetchCoinGeckoPage(1),
    fetchCoinGeckoPage(2),
  ]);
  const merged = [];
  for (const r of settled) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      merged.push(...r.value);
    } else if (r.status === 'rejected') {
      console.warn('[update-coins] CoinGecko 페이지 실패:', r.reason?.message);
    }
  }
  return merged;
}

export async function updateCoins(env) {
  try {
    // 1단계: Upbit 마켓 목록 + CoinPaprika 동시 조회
    // #104 B1: Promise.all 단일 실패점 제거 → allSettled 로 부분 성공 허용.
    const [marketsRes, paprikaRes] = await Promise.allSettled([
      fetchUpbitMarkets(),
      fetchCoinPaprika(),
    ]);
    const markets = marketsRes.status === 'fulfilled' ? marketsRes.value : null;
    const paprikaData = paprikaRes.status === 'fulfilled' ? paprikaRes.value : [];
    if (marketsRes.status === 'rejected') {
      console.warn('[update-coins] Upbit markets 실패:', marketsRes.reason?.message);
    }
    if (paprikaRes.status === 'rejected') {
      console.warn('[update-coins] CoinPaprika 실패 (보강 데이터 생략):', paprikaRes.reason?.message);
    }

    // 2단계: Upbit 티커 조회 — 실패 시 Bithumb fallback (#104 B4)
    let tickers = null;
    let tickerSource = 'upbit';
    if (markets && markets.length > 0) {
      try {
        tickers = await fetchUpbitTickers(markets);
      } catch (e) {
        console.warn('[update-coins] Upbit ticker 전종목 실패, Bithumb fallback 시도:', e.message);
        tickers = null;
      }
    } else {
      console.warn('[update-coins] Upbit markets 없음 — Bithumb fallback 으로 진행');
    }
    if (!tickers || tickers.length === 0) {
      try {
        tickers = await fetchBithumbTickers();
        tickerSource = 'bithumb';
        console.log(`[update-coins] Bithumb fallback 성공: ${tickers.length}개`);
      } catch (e) {
        throw new Error(`Upbit + Bithumb 모두 실패: ${e.message}`);
      }
    }

    // 마켓 이름 매핑 (market code → korean_name)
    // #104 Codex P2: Bithumb fallback 경로에서 Upbit markets 재시도는 Edge 10s
    // 예산을 추가로 5~8s 깎아 먹을 수 있음. 따라서 markets 가 없어도 재시도하지 않고
    // 바로 static COIN_KR_NAMES_FALLBACK 으로 주요 코인을 커버.
    const nameMap = new Map();
    if (markets) {
      for (const m of markets) {
        nameMap.set(m.market, m.korean_name || m.english_name || m.market);
      }
    }
    // static fallback: 주요 상위 코인 한글명 (markets 실패 시 최소 커버리지)
    for (const [sym, kr] of Object.entries(COIN_KR_NAMES_FALLBACK)) {
      const key = `KRW-${sym}`;
      if (!nameMap.has(key)) nameMap.set(key, kr);
    }

    // CoinPaprika 심볼 매핑 (symbol → { priceUsd, marketCap, volume24h })
    // #104 B2: priceUsd=0 인 row 는 맵에 넣지 않음 — 조용한 0 값 차단.
    //         호출자는 paprika 누락을 "데이터 없음(0)" 으로 깔끔하게 처리.
    // #104 Codex: 동일 티커 중복(다른 프로젝트가 같은 심볼) 시 시가총액 큰 쪽을
    //            유지. paprika 는 market cap 내림차순 정렬이므로 first-wins 로 충분.
    const paprikaMap = new Map();
    for (const coin of paprikaData) {
      if (!coin.symbol) continue;
      const key = coin.symbol.toUpperCase();
      if (paprikaMap.has(key)) continue; // 먼저 들어온(=더 큰 시총) row 유지
      const priceUsd  = coin.quotes?.USD?.price ?? 0;
      const marketCap = coin.quotes?.USD?.market_cap ?? 0;
      const volume24h = coin.quotes?.USD?.volume_24h ?? 0;
      if (priceUsd <= 0) continue;
      paprikaMap.set(key, { priceUsd, marketCap, volume24h });
    }

    // #117: CoinGecko 2차 fallback — paprika 누락(=priceUsd<=0) 심볼만 보강.
    // paprika 에 이미 있는 심볼은 덮어쓰지 않음 (시총 큰 쪽 유지 정책 보존).
    // Upbit KRW 마켓 심볼 집합을 먼저 만들어 "결손 여부" 를 계산.
    const needGecko = new Set();
    for (const t of tickers) {
      const sym = t.market.replace('KRW-', '').toUpperCase();
      if (!paprikaMap.has(sym)) needGecko.add(sym);
    }
    let geckoFillCount = 0;
    if (needGecko.size > 0) {
      const geckoData = await fetchCoinGecko();
      // CoinGecko 도 market_cap_desc 정렬 → first-wins 로 시총 큰 쪽 유지.
      const geckoSeen = new Set();
      for (const coin of geckoData) {
        if (!coin?.symbol) continue;
        const key = coin.symbol.toUpperCase();
        if (geckoSeen.has(key)) continue;
        geckoSeen.add(key);
        if (!needGecko.has(key)) continue; // paprika 커버 심볼은 건너뜀
        const priceUsd  = Number(coin.current_price) || 0;
        const marketCap = Number(coin.market_cap) || 0;
        const volume24h = Number(coin.total_volume) || 0;
        if (priceUsd <= 0) continue;
        paprikaMap.set(key, { priceUsd, marketCap, volume24h });
        geckoFillCount += 1;
      }
    }

    // Upbit/Bithumb 티커 → 통합 형태 변환
    const items = tickers.map((t) => {
      const symbol = t.market.replace('KRW-', '');
      const paprika = paprikaMap.get(symbol) || {};

      // 변동률: Upbit/Bithumb 정규화된 signed_change_rate 는 소수 (0.05 = 5%)
      const change24h = (t.signed_change_rate ?? 0) * 100;

      return {
        id: symbol.toLowerCase(),
        symbol,
        name: nameMap.get(t.market) || symbol,
        market: 'coin',
        priceKrw: t.trade_price ?? 0,
        change24h: parseFloat(change24h.toFixed(2)),
        // CoinPaprika 보강 데이터 (없으면 0)
        priceUsd: paprika.priceUsd ?? 0,
        marketCap: paprika.marketCap ?? 0,
        volume24h: paprika.volume24h ?? 0,
        // Upbit/Bithumb 추가 데이터
        accTradePrice24h: t.acc_trade_price_24h ?? 0,
        highPrice: t.high_price ?? 0,
        lowPrice: t.low_price ?? 0,
      };
    });
    // #117: 커버리지 관측 로그 — paprika 와 CoinGecko fallback 기여분 분리 표기.
    const paprikaBase = paprikaMap.size - geckoFillCount;
    const missingMeta = items.filter((it) => (it.priceUsd ?? 0) <= 0).length;
    console.log(
      `[update-coins] 저장: ${items.length}개 ` +
      `(source=${tickerSource}, paprika=${paprikaBase} coingecko_fallback=${geckoFillCount} missing_meta=${missingMeta})`,
    );

    // Redis 저장
    if (items.length > 0) {
      await setSnap(SNAP_KEYS.COINS, items, SNAP_TTL.COINS);
    }

    return { ok: true, count: items.length };
  } catch (err) {
    // Cron 실패 기록 (모니터링용) — 기록 실패가 에러 응답을 덮어쓰지 않도록 방어
    try { await recordCronFailure('coins', String(err?.message || err)); } catch (_) { /* 무시 */ }
    throw err;
  }
}
