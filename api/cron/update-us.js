// api/cron/update-us.js — 미장 가격 갱신 Serverless Cron (샤드 기반)
// Serverless 런타임 → 60~300초 타임아웃 (Edge 10초 제한 해제)
// 매 2분마다 호출, 샤드 커서로 250개씩 순환 → 전체 1000개 8분 주기

import { SNAP_KEYS, SNAP_TTL, setSnap, recordCronFailure, redis } from '../_price-cache.js';

// ── 심볼 소스: NASDAQ API 동적 + 하드코딩 fallback ──
const SHARD_SIZE = 250;    // 샤드당 종목 수
const CONCURRENCY = 30;    // Yahoo v8 동시 요청 수
const SHARD_TTL = 600;     // 샤드 TTL 10분 (크론 8분 주기 × 1.25)
const SYMBOL_LIST_TTL = 86400; // 종목 리스트 24시간 캐시
const SYMBOL_LIST_KEY = 'us:symbols'; // Redis 키
const SHARD_CURSOR_KEY = 'us:cron:shard'; // 현재 샤드 인덱스

// NASDAQ API에서 시가총액 상위 종목 수집
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
  const unique = [];
  for (const s of allSymbols) {
    if (seen.has(s.symbol)) continue;
    seen.add(s.symbol);
    unique.push(s.symbol);
  }
  return unique.slice(0, limit);
}

// Redis에서 종목 리스트 가져오기 (없으면 NASDAQ API 호출 후 캐시)
async function getSymbolList() {
  if (redis) {
    try {
      const cached = await redis.get(SYMBOL_LIST_KEY);
      if (Array.isArray(cached) && cached.length > 100) return cached;
    } catch (_) { /* fallback */ }
  }

  // NASDAQ API에서 수집
  const symbols = await fetchNasdaqSymbols(1000);
  if (symbols.length > 100 && redis) {
    try {
      await redis.set(SYMBOL_LIST_KEY, symbols, { ex: SYMBOL_LIST_TTL });
      console.log(`[update-us] 종목 리스트 갱신: ${symbols.length}개 → Redis 캐시`);
    } catch (_) { /* 저장 실패해도 진행 */ }
  }

  // NASDAQ API 실패 시 하드코딩 fallback
  if (symbols.length < 50) {
    console.warn('[update-us] NASDAQ API 수집 부족 — 하드코딩 fallback');
    return FALLBACK_SYMBOLS;
  }
  return symbols;
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

async function fetchYahooV8Single(symbol, timeoutMs = 10000) {
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
  return {
    symbol: meta.symbol?.split('.')[0] ?? symbol,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat((price - prev).toFixed(2)),
    changePct: prev > 0 ? parseFloat(((price - prev) / prev * 100).toFixed(2)) : 0,
    volume: meta.regularMarketVolume ?? 0,
    marketCap: meta.marketCap ?? 0,
    name: meta.shortName || meta.longName || symbol,
    market: 'us',
  };
}

// 동시성 제한 배치 실행
async function fetchBatch(symbols, timeoutMs = 10000) {
  const results = [];
  const failed = [];
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const chunk = symbols.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(sym => fetchYahooV8Single(sym, timeoutMs))
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
    // 1. 종목 리스트 가져오기
    const allSymbols = await getSymbolList();
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

    // 4. Yahoo v8로 가격 조회
    const { results: firstResults, failed } = await fetchBatch(shardSymbols);

    // 5. 실패분 재시도 (50% 미만일 때만)
    let retryResults = [];
    const failRatio = failed.length / shardSymbols.length;
    if (failed.length > 0 && failRatio < 0.5) {
      console.log(`[update-us] 재시도: ${failed.length}개`);
      const { results: retried } = await fetchBatch(failed, 12000);
      retryResults = retried;
    }

    const items = [...firstResults, ...retryResults];

    // 6. 샤드별 Redis 저장
    if (items.length > 0) {
      const shardKey = `snap:us:${shard}`;
      await setSnap(shardKey, items, SHARD_TTL);
      // 레거시 키에도 병합 저장 (하위 호환)
      if (shard === 0) {
        await setSnap(SNAP_KEYS.US, items, SNAP_TTL.US);
      }
    }

    // 7. 커서 다음 샤드로 이동
    if (redis) {
      try {
        await redis.set(SHARD_CURSOR_KEY, (shard + 1) % totalShards, { ex: 3600 });
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
