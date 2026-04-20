// crons/update-coins.js — 코인 가격 갱신 (CF Workers, Upbit 전용)
// 2026-04-20 #167: Bithumb fallback / CoinPaprika / CoinGecko 제거.
//   사유: priceUsd / marketCap / volume24h 가 프로덕션에서 항상 0 → 실효성 0.
//   Upbit REST(ticker/all 1 call + 실패 시 청크 fallback)만 유지.
//
// 타임아웃 예산 (CF Workers 기본 maxDuration 30s):
//   Phase 1: Upbit markets(5s) 단독 → ~5s
//   Phase 2: ticker/all(6s) or 청크 fallback(6s) → ~6s
//   Worst case: ~11s

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

// Upbit 전종목 KRW 마켓 목록 조회 (한국어명 매핑용)
async function fetchUpbitMarkets(timeoutMs = 5000) {
  const res = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Upbit markets HTTP ${res.status}`);
  const data = await res.json();
  return data.filter((m) => m.market.startsWith('KRW-'));
}

// #133: Upbit ticker/all — 전종목 1회 요청 (기존 100개 청크 분할 대체)
async function fetchUpbitTickerAll(timeoutMs = 6000) {
  const res = await fetch('https://api.upbit.com/v1/ticker/all?quote_currencies=KRW', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Upbit ticker/all HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('Upbit ticker/all: 빈 응답');
  return data;
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

export async function updateCoins(env) {
  try {
    // 1단계: Upbit 마켓 목록 (한국어 이름 매핑용)
    let markets = null;
    try {
      markets = await fetchUpbitMarkets();
    } catch (e) {
      console.warn('[update-coins] Upbit markets 실패:', e.message);
    }

    // 2단계: Upbit 티커 — ticker/all 우선(1회 요청), 실패 시 청크 fallback
    // #133: ticker/all API로 전종목 단일 요청 (기존 100개 청크 분할 N회 → 1회)
    let tickers = null;
    try {
      tickers = await fetchUpbitTickerAll();
    } catch (e) {
      console.warn('[update-coins] ticker/all 실패, 청크 fallback:', e.message);
      if (markets && markets.length > 0) {
        tickers = await fetchUpbitTickers(markets);
      }
    }
    if (!tickers || tickers.length === 0) {
      throw new Error('Upbit 티커 수집 전량 실패');
    }

    // 마켓 이름 매핑 (market code → korean_name)
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

    // Upbit 티커 → 통합 형태 변환
    // #167: priceUsd/marketCap/volume24h(USD) 는 CoinPaprika/CoinGecko 제거로 0 고정.
    //       priceUsd 는 클라이언트(coinWs.js)가 priceKrw / 환율로 계산해 복구.
    const items = tickers.map((t) => {
      const symbol = t.market.replace('KRW-', '');
      const change24h = (t.signed_change_rate ?? 0) * 100;
      return {
        id: symbol.toLowerCase(),
        symbol,
        name: nameMap.get(t.market) || symbol,
        market: 'coin',
        priceKrw: t.trade_price ?? 0,
        change24h: parseFloat(change24h.toFixed(2)),
        priceUsd: 0,
        marketCap: 0,
        volume24h: 0,
        accTradePrice24h: t.acc_trade_price_24h ?? 0,
        highPrice: t.high_price ?? 0,
        lowPrice: t.low_price ?? 0,
      };
    });
    console.log(`[update-coins] 저장: ${items.length}개 (source=upbit)`);

    if (items.length > 0) {
      await setSnap(SNAP_KEYS.COINS, items, SNAP_TTL.COINS);
    }

    return { ok: true, count: items.length };
  } catch (err) {
    try { await recordCronFailure('coins', String(err?.message || err)); } catch (_) { /* 무시 */ }
    throw err;
  }
}
