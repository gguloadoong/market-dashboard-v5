// api/cron/update-coins.js — 코인 가격 갱신 Edge Cron
// Upbit REST (primary) → Bithumb REST (fallback), CoinPaprika 병렬 보강.
// #104 B1/B2/B4 수정:
//   B1 — Promise.all 단일 실패점 → allSettled 로 부분 성공 허용
//   B2 — CoinPaprika limit=100 → 500 + priceUsd=0 필터링
//   B4 — Upbit ticker 전종목 실패 시 Bithumb public/ticker/ALL_KRW fallback
export const config = { runtime: 'edge' };

import { SNAP_KEYS, SNAP_TTL, setSnap, recordCronFailure } from '../_price-cache.js';

// Upbit 전종목 KRW 마켓 목록 조회
async function fetchUpbitMarkets() {
  const res = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Upbit markets HTTP ${res.status}`);
  const data = await res.json();
  // KRW 마켓만 필터
  return data.filter((m) => m.market.startsWith('KRW-'));
}

// Upbit 티커 배치 조회 — 100개씩 청크 분할 (URL 길이 제한 대비)
const TICKER_BATCH_SIZE = 100;

async function fetchUpbitTickers(markets) {
  const chunks = [];
  for (let i = 0; i < markets.length; i += TICKER_BATCH_SIZE) {
    chunks.push(markets.slice(i, i + TICKER_BATCH_SIZE));
  }

  const settled = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const marketStr = chunk.map((m) => m.market).join(',');
      const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketStr}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
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
    if (symbol === 'date' || !row || typeof row !== 'object') continue;
    const close = parseFloat(row.closing_price);
    const open  = parseFloat(row.opening_price);
    if (!Number.isFinite(close) || close <= 0) continue;
    const changeRate = open > 0 ? (close - open) / open : 0;
    tickers.push({
      market: `KRW-${symbol}`,
      trade_price: close,
      signed_change_rate: changeRate, // -0.05 ~ +0.05 형태로 Upbit 호환
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
// #104 B2: limit 100 → 500 으로 상향해 Upbit KRW 244 개 전부 커버.
// 실패·부분응답은 호출자가 처리.
async function fetchCoinPaprika() {
  const res = await fetch('https://api.coinpaprika.com/v1/tickers?limit=500&quotes=KRW,USD', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function handler(request) {
  // Vercel Cron Bearer 인증 — CRON_SECRET 설정 시에만 검증, 미설정 시 허용
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

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
    // Bithumb fallback 경로에는 markets 가 없을 수 있어 기본값으로 symbol 노출.
    const nameMap = new Map();
    if (markets) {
      for (const m of markets) {
        nameMap.set(m.market, m.korean_name || m.english_name || m.market);
      }
    }

    // CoinPaprika 심볼 매핑 (symbol → { priceUsd, marketCap, volume24h })
    // #104 B2: priceUsd=0 인 row 는 맵에 넣지 않음 — 조용한 0 값 차단.
    //         호출자는 paprika 누락을 "데이터 없음(0)" 으로 깔끔하게 처리.
    const paprikaMap = new Map();
    for (const coin of paprikaData) {
      if (!coin.symbol) continue;
      const priceUsd  = coin.quotes?.USD?.price ?? 0;
      const marketCap = coin.quotes?.USD?.market_cap ?? 0;
      const volume24h = coin.quotes?.USD?.volume_24h ?? 0;
      if (priceUsd <= 0) continue;
      paprikaMap.set(coin.symbol.toUpperCase(), { priceUsd, marketCap, volume24h });
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
    console.log(`[update-coins] 저장: ${items.length}개 (source=${tickerSource}, paprika=${paprikaMap.size})`);

    // Redis 저장
    if (items.length > 0) {
      await setSnap(SNAP_KEYS.COINS, items, SNAP_TTL.COINS);
    }

    return new Response(JSON.stringify({ ok: true, count: items.length }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    // Cron 실패 기록 (모니터링용) — 기록 실패가 에러 응답을 덮어쓰지 않도록 방어
    try { await recordCronFailure('coins', String(err?.message || err)); } catch (_) { /* 무시 */ }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
