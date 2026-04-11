// api/cron/update-us.js — 미장 가격 갱신 Serverless Cron (샤드 기반)
// Serverless 런타임 → 60~300초 타임아웃 (Edge 10초 제한 해제)
// 매 2분마다 호출, 샤드 커서로 250개씩 순환 → 전체 1000개 8분 주기

import { SNAP_KEYS, SNAP_TTL, setSnap, recordCronFailure, redis } from '../_price-cache.js';

// ── 심볼 소스: NASDAQ API 동적 + 하드코딩 fallback ──
const SHARD_SIZE = 250;    // 샤드당 종목 수
const CONCURRENCY = 30;    // Yahoo v8 동시 요청 수
const SHARD_TTL = 900;     // 샤드 TTL 15분 (크론 8분 주기 × 1.9, 장애 버퍼)
const SYMBOL_LIST_TTL = 86400; // 종목 리스트 24시간 캐시
const SYMBOL_LIST_KEY = 'us:symbols'; // Redis 키
const SHARD_CURSOR_KEY = 'us:cron:shard'; // 현재 샤드 인덱스

// NASDAQ API에서 시가총액 상위 종목 수집
// #104 B3: 반환값에 { symbol, marketCap } 맵을 포함시켜 snapshot 까지 전파.
//          Yahoo v8 chart API 는 marketCap 을 돌려주지 않기 때문에 NASDAQ 수집
//          단계의 값을 잃어버리면 /api/snapshot us 전종목 marketCap=0 이 된다.
async function fetchNasdaqSymbols(limit = 1000) {
  const exchanges = ['NASDAQ', 'NYSE', 'AMEX'];
  const allSymbols = [];

  for (const exchange of exchanges) {
    try {
      const url = `https://api.nasdaq.com/api/screener/stocks?exchange=${exchange}&limit=${limit}&sortcolumn=marketcap&sortorder=desc`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const rows = data?.data?.table?.rows || [];
      for (const row of rows) {
        if (!row.symbol || row.symbol.includes('^') || row.symbol.includes('/')) continue;
        // 시가총액 파싱 (문자열 "1,234,567" → 숫자)
        const mcStr = (row.marketCap || '').replace(/,/g, '');
        const mc = parseInt(mcStr, 10) || 0;
        // 시총 1억 달러 미만 제외 (페니스톡 필터)
        if (mc < 100_000_000) continue;
        allSymbols.push({
          symbol: row.symbol.trim(),
          name: (row.name || '').replace(/ Common Stock$| Class [A-C].*$| Inc\.$| Corp\.$/i, '').trim(),
          exchange,
          marketCap: mc,
        });
      }
    } catch (e) {
      console.warn(`[update-us] NASDAQ API ${exchange} 실패:`, e.message);
    }
  }

  // 시가총액 내림차순 정렬 후 상위 limit개
  allSymbols.sort((a, b) => b.marketCap - a.marketCap);
  // 중복 심볼 제거 (GOOG vs GOOGL 등)
  const seen = new Set();
  const symbols = [];
  const mcMap = {};
  for (const s of allSymbols) {
    if (seen.has(s.symbol)) continue;
    seen.add(s.symbol);
    symbols.push(s.symbol);
    mcMap[s.symbol] = s.marketCap;
  }
  return {
    symbols: symbols.slice(0, limit),
    mcMap, // symbol → marketCap (USD)
  };
}

// Redis에서 종목 리스트 + marketCap 맵 가져오기 (없으면 NASDAQ API 호출 후 캐시)
// 반환: { symbols: string[], mcMap: Record<symbol, number> }
async function getSymbolList() {
  if (redis) {
    try {
      const cached = await redis.get(SYMBOL_LIST_KEY);
      // #104 B3: 새 캐시 형태 {symbols, mcMap} 우선, 구형 array 는 무시하고 갱신.
      if (cached && typeof cached === 'object' && Array.isArray(cached.symbols) && cached.symbols.length > 100) {
        return { symbols: cached.symbols, mcMap: cached.mcMap || {} };
      }
    } catch (_) { /* fallback */ }
  }

  // NASDAQ API에서 수집 (총 30초 타임아웃)
  let collected = { symbols: [], mcMap: {} };
  try {
    collected = await Promise.race([
      fetchNasdaqSymbols(1000),
      new Promise((_, reject) => setTimeout(() => reject(new Error('NASDAQ API 총 타임아웃')), 30000)),
    ]);
  } catch (e) {
    console.warn('[update-us] NASDAQ 수집 실패:', e.message);
    collected = { symbols: [], mcMap: {} };
  }
  if (collected.symbols.length > 100 && redis) {
    try {
      await redis.set(SYMBOL_LIST_KEY, collected, { ex: SYMBOL_LIST_TTL });
      console.log(`[update-us] 종목 리스트 갱신: ${collected.symbols.length}개 (marketCap 포함) → Redis 캐시`);
    } catch (_) { /* 저장 실패해도 진행 */ }
  }

  // NASDAQ API 실패 시 하드코딩 fallback (marketCap 없음)
  if (collected.symbols.length < 50) {
    console.warn('[update-us] NASDAQ API 수집 부족 — 하드코딩 fallback');
    return { symbols: FALLBACK_SYMBOLS, mcMap: {} };
  }
  return collected;
}

// 하드코딩 fallback (기존 122개)
const FALLBACK_SYMBOLS = [
  'AAPL','MSFT','GOOGL','GOOG','AMZN','NVDA','META','TSLA','BRK-B','AVGO',
  'AMD','INTC','QCOM','MU','AMAT','LRCX','KLAC','MRVL','ON','NXPI',
  'CRM','ORCL','ADBE','NOW','INTU','SNPS','CDNS','PANW','CRWD','FTNT',
  'V','MA','PYPL','SQ','COIN','GS','JPM','BAC','WFC','MS',
  'UNH','JNJ','LLY','ABBV','MRK','PFE','TMO','ABT','AMGN','GILD',
  'COST','WMT','HD','NKE','MCD','SBUX','TGT','LOW','TJX','BKNG',
  'XOM','CVX','COP','SLB','LMT','BA','CAT','GE','HON','UNP',
  'DIS','NFLX','CMCSA','T','VZ','TMUS','SPOT','ROKU','PARA','WBD',
  'SPY','QQQ','DIA','IWM','VOO','VTI','ARKK','SOXX','XLF','XLE',
  'PLTR','UBER','ABNB','RIVN','LCID','NIO','LI','XPEV','DKNG','RBLX',
  'SNOW','NET','DDOG','ZS','MDB','SHOP','SE','MELI','GRAB','CPNG',
  'ACN','IBM','CSCO','TXN','NEE','PG','KO','PEP','PM','MO',
];

// ── Yahoo v8 per-symbol 가격 조회 ──
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
let _hostIdx = 0;
function nextHost() { return YAHOO_HOSTS[(_hostIdx++) % YAHOO_HOSTS.length]; }

async function fetchYahooV8Single(symbol, timeoutMs = 10000, mcMap = null) {
  const host = nextHost();
  const url = `https://${host}/v8/finance/chart/${symbol}?interval=1d&range=5d&includePrePost=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Yahoo v8 ${symbol} ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result?.meta?.regularMarketPrice) throw new Error(`no price: ${symbol}`);
  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
  const price = meta.regularMarketPrice;
  let prev = meta.previousClose;
  if (!prev || Math.abs(prev - price) / Math.max(Math.abs(price), 1) < 0.0001) {
    for (let i = closes.length - 2; i >= 0; i--) {
      if (closes[i] && Math.abs(closes[i] - price) / Math.max(Math.abs(price), 1) >= 0.0001) {
        prev = closes[i]; break;
      }
    }
  }
  if (!prev) prev = price;
  const resolvedSymbol = meta.symbol?.split('.')[0] ?? symbol;
  // #104 B3: Yahoo chart API 는 marketCap 을 돌려주지 않으므로 NASDAQ 수집값을 merge.
  //          meta.marketCap 은 거의 항상 undefined → 기존 fallback 은 전부 0 이었음.
  const marketCap = (mcMap && mcMap[resolvedSymbol]) || (mcMap && mcMap[symbol]) || meta.marketCap || 0;
  return {
    symbol: resolvedSymbol,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat((price - prev).toFixed(2)),
    changePct: prev > 0 ? parseFloat(((price - prev) / prev * 100).toFixed(2)) : 0,
    volume: meta.regularMarketVolume ?? 0,
    marketCap,
    name: meta.shortName || meta.longName || symbol,
    market: 'us',
  };
}

// 동시성 제한 배치 실행
async function fetchBatch(symbols, timeoutMs = 10000, mcMap = null) {
  const results = [];
  const failed = [];
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const chunk = symbols.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(sym => fetchYahooV8Single(sym, timeoutMs, mcMap))
    );
    for (let j = 0; j < settled.length; j++) {
      if (settled[j].status === 'fulfilled') results.push(settled[j].value);
      else failed.push(chunk[j]);
    }
  }
  return { results, failed };
}

// ── 메인 핸들러 ──
export default async function handler(request) {
  // Cron 인증
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get?.('authorization') || request.headers?.authorization;
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    // 1. 종목 리스트 + marketCap 맵 가져오기 (#104 B3)
    const { symbols: allSymbols, mcMap } = await getSymbolList();
    const totalShards = Math.ceil(allSymbols.length / SHARD_SIZE);

    // 2. 현재 샤드 커서 읽기
    let shard = 0;
    if (redis) {
      try {
        const cur = await redis.get(SHARD_CURSOR_KEY);
        shard = (parseInt(cur, 10) || 0) % totalShards;
      } catch (_) { /* 기본값 0 */ }
    }

    // 3. 이번 샤드의 종목 추출
    const start = shard * SHARD_SIZE;
    const shardSymbols = allSymbols.slice(start, start + SHARD_SIZE);
    console.log(`[update-us] 샤드 ${shard}/${totalShards - 1} (${shardSymbols.length}개, 전체 ${allSymbols.length}개)`);

    // 4. Yahoo v8로 가격 조회 (#104 B3: NASDAQ mcMap 을 함께 전파)
    const { results: firstResults, failed } = await fetchBatch(shardSymbols, 10000, mcMap);

    // 5. 실패분 재시도 (50% 미만일 때만)
    let retryResults = [];
    const failRatio = failed.length / shardSymbols.length;
    if (failed.length > 0 && failRatio < 0.5) {
      console.log(`[update-us] 재시도: ${failed.length}개`);
      const { results: retried } = await fetchBatch(failed, 12000, mcMap);
      retryResults = retried;
    }

    const items = [...firstResults, ...retryResults];

    // 6. 샤드별 Redis 저장 + 레거시 키 병합 갱신
    if (items.length > 0) {
      const shardKey = `snap:us:${shard}`;
      await setSnap(shardKey, items, SHARD_TTL);

      // 레거시 snap:us도 병합 갱신 (fallback 보장)
      try {
        const existing = await redis?.get(SNAP_KEYS.US);
        const merged = new Map();
        if (Array.isArray(existing)) {
          for (const it of existing) merged.set(it.symbol, it);
        }
        for (const it of items) merged.set(it.symbol, it);
        await setSnap(SNAP_KEYS.US, [...merged.values()], SHARD_TTL);
      } catch (_) { /* 레거시 병합 실패해도 샤드 키는 이미 저장됨 */ }
    }

    // 7. 커서 + 샤드 수 저장 (읽기 측에서 동적 참조)
    if (redis) {
      try {
        await Promise.all([
          redis.set(SHARD_CURSOR_KEY, (shard + 1) % totalShards, { ex: 3600 }),
          redis.set('us:cron:shardCount', totalShards, { ex: 3600 }),
        ]);
      } catch (_) { /* 무시 */ }
    }

    // 8. 전량 실패 모니터링
    if (items.length === 0) {
      try { await recordCronFailure('us', `샤드 ${shard} 전량 실패`); } catch (_) {}
    }

    return new Response(JSON.stringify({
      ok: items.length > 0,
      shard,
      totalShards,
      totalSymbols: allSymbols.length,
      count: items.length,
      retried: retryResults.length,
      failed: failed.length - retryResults.length,
    }), {
      status: items.length > 0 ? 200 : 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    try { await recordCronFailure('us', String(err?.message || err)); } catch (_) {}
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
