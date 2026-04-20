// crons/update-us.js — 미장 가격 갱신 (Yahoo v7 batch, 단일 invocation 전량)
// #169: 샤딩 제거. 5분 주기로 NASDAQ 시총 상위 3000종목(토스/네이버 수준) 전량 갱신.
//       Yahoo v7 multi-quote 로 200개/call → 3000 종목 15 batch × 5 병렬 → ~3~5 라운드.

import { SNAP_KEYS, SNAP_TTL, setSnap, recordCronFailure, getRedis } from '../price-cache.js';

// ── 커버리지 / 배치 설정 ──
const SYMBOL_LIMIT = 3000;         // 토스/네이버 해외주식 수준 커버
const BATCH_SIZE = 200;            // Yahoo v7 multi-quote 안전 상한 (500 이상 시 HTTP 414)
const BATCH_CONCURRENCY = 5;       // 동시 배치 수 (IP rate limit 완화)
const SYMBOL_LIST_TTL = 86400;     // NASDAQ 종목 리스트 24시간 캐시
const SYMBOL_LIST_KEY = 'us:symbols';

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
  const redis = getRedis();
  let legacyArrayCache = null;
  if (redis) {
    try {
      const cached = await redis.get(SYMBOL_LIST_KEY);
      // #104 B3: 새 캐시 형태 {symbols, mcMap} 우선.
      // 임계값 저장(>=100)과 통일해서 정확히 100개일 때도 캐시 재사용.
      if (cached && typeof cached === 'object' && !Array.isArray(cached)
          && Array.isArray(cached.symbols) && cached.symbols.length >= 100) {
        return { symbols: cached.symbols, mcMap: cached.mcMap || {} };
      }
      // 구형 캐시 (plain array) — rollout 과도기 호환.
      // 여기서 즉시 return 하면 새 형식으로 갱신이 24h(TTL) 지연되므로,
      // 폴백 변수로 보관만 하고 NASDAQ 재수집을 시도한다 (#104 Opus 리뷰).
      if (Array.isArray(cached) && cached.length >= 100) {
        console.log('[update-us] 구형 array 캐시 감지 → NASDAQ 재수집 시도 (성공 시 새 형식으로 교체)');
        legacyArrayCache = cached;
      }
    } catch (_) { /* fallback */ }
  }

  // NASDAQ API에서 수집 (총 30초 타임아웃)
  let collected = { symbols: [], mcMap: {} };
  try {
    collected = await Promise.race([
      fetchNasdaqSymbols(SYMBOL_LIMIT),
      new Promise((_, reject) => setTimeout(() => reject(new Error('NASDAQ API 총 타임아웃')), 30000)),
    ]);
  } catch (e) {
    console.warn('[update-us] NASDAQ 수집 실패:', e.message);
    collected = { symbols: [], mcMap: {} };
  }
  // #104 Opus: 임계값 일관성 — 100 미만이면 의심스러운 수집이라 판단하고
  //           legacy/FALLBACK 중 더 나은 쪽을 사용. 캐시 저장 기준(>=100)과 통일.
  //           Redis 미구성 환경(로컬 등) 에서도 수집 성공 시 그대로 반환 (버그 수정).
  if (collected.symbols.length >= 100) {
    if (redis) {
      try {
        await redis.set(SYMBOL_LIST_KEY, collected, { ex: SYMBOL_LIST_TTL });
        console.log(`[update-us] 종목 리스트 갱신: ${collected.symbols.length}개 (marketCap 포함) → Redis 캐시`);
      } catch (_) { /* 저장 실패해도 진행 */ }
    }
    return collected;
  }

  // NASDAQ 수집 결과가 100 미만 (장애/레이트리밋/타임아웃):
  //   1) 구형 캐시(array)가 남아 있으면 coverage 보존
  //   2) 없으면 FALLBACK_SYMBOLS 122개
  // #104 Codex: 부분 수집한 mcMap 이 있으면 같이 전달해서 legacy 경로도
  //           가능한 범위에서 marketCap 복구 (모두 0 으로 떨어지지 않도록).
  const partialMcMap = collected.mcMap || {};
  if (legacyArrayCache) {
    console.warn(`[update-us] NASDAQ 수집 부족(${collected.symbols.length}) — 구형 array 캐시 사용 (부분 mcMap ${Object.keys(partialMcMap).length}건)`);
    return { symbols: legacyArrayCache, mcMap: partialMcMap };
  }
  console.warn(`[update-us] NASDAQ 수집 부족(${collected.symbols.length}) — 하드코딩 FALLBACK_SYMBOLS (부분 mcMap ${Object.keys(partialMcMap).length}건)`);
  return { symbols: FALLBACK_SYMBOLS, mcMap: partialMcMap };
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

// ── Yahoo v7 multi-quote 배치 조회 ──
// 개별 /v8/finance/chart 호출 대신 /v7/finance/quote?symbols=... 로 200개 1 call.
// 3000 종목 → 15 batch × 5 병렬 → subrequest 15개만 소모 (기존 3000개 → 200배 감소).
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
let _hostIdx = 0;
function nextHost() { return YAHOO_HOSTS[(_hostIdx++) % YAHOO_HOSTS.length]; }

// v7 quote 단일 배치 (최대 BATCH_SIZE 심볼)
// 반환: { items, missingSymbols } — Yahoo 가 응답에서 누락한 심볼은 missingSymbols 로
//      명시 (#169 Codex P2: 요청은 있었는데 result 에 없으면 실패로 간주, silent 누락 금지)
async function fetchYahooV7Batch(symbols, timeoutMs = 10000, mcMap = null) {
  const host = nextHost();
  const url = `https://${host}/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Yahoo v7 batch HTTP ${res.status}`);
  const data = await res.json();
  const quotes = data?.quoteResponse?.result;
  if (!Array.isArray(quotes)) throw new Error('Yahoo v7: result 배열 누락');

  // 응답된 심볼 set — 요청 ↔ 응답 매칭으로 missing 추출
  const requestedSet = new Set(symbols);
  const validOriginals = new Set();  // 원본 요청 심볼 (suffix 포함) 중 응답 유효한 것
  const items = [];
  for (const q of quotes) {
    const rawSymbol = q.symbol || '';
    if (!rawSymbol) continue;
    // BRK.A / BRK.B 계열 보존: dot 제거 금지. Naver/Toss 관행대로 dash 로 치환만 (#169 Codex HIGH #1).
    const resolvedSymbol = rawSymbol.replace('.', '-');
    const price = Number(q.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0) continue; // 가격 무효는 missingSymbols 에 집계됨
    const prev = Number(q.regularMarketPreviousClose) || price || 0;
    // mcMap lookup 은 원본(raw) 또는 resolved(dash) 양쪽 키로 시도 — NASDAQ 포맷이 환경별로 다름
    const mcFromNasdaq = mcMap ? (mcMap[rawSymbol] || mcMap[resolvedSymbol]) : 0;
    const marketCap = mcFromNasdaq || Number(q.marketCap) || 0;
    items.push({
      symbol: resolvedSymbol,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat((price - prev).toFixed(2)),
      changePct: prev > 0 ? parseFloat(((price - prev) / prev * 100).toFixed(2)) : 0,
      volume: Number(q.regularMarketVolume) || 0,
      marketCap,
      name: q.shortName || q.longName || resolvedSymbol,
      market: 'us',
    });
    // 원본 요청 심볼 포맷이 Yahoo rawSymbol 과 일치하는 것만 기록 (Set 조회 O(1))
    if (requestedSet.has(rawSymbol)) validOriginals.add(rawSymbol);
  }

  // 요청 원본 기준으로 valid 이지 않은 심볼 전부 missing 처리 — O(n) 한 번 순회
  const missingSymbols = symbols.filter((s) => !validOriginals.has(s));
  return { items, missingSymbols };
}

// 전 심볼을 BATCH_SIZE 로 잘라 BATCH_CONCURRENCY 병렬로 실행.
// 배치 자체 실패(HTTP/parse 에러) + Yahoo 가 응답에서 드롭한 심볼 모두 failed 에 집계.
async function fetchAllV7Batches(symbols, mcMap = null, timeoutMs = 10000) {
  const batches = [];
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    batches.push(symbols.slice(i, i + BATCH_SIZE));
  }

  const results = [];
  const failed = [];
  for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
    const group = batches.slice(i, i + BATCH_CONCURRENCY);
    const settled = await Promise.allSettled(
      group.map((b) => fetchYahooV7Batch(b, timeoutMs, mcMap))
    );
    for (let j = 0; j < settled.length; j++) {
      if (settled[j].status === 'fulfilled') {
        const { items, missingSymbols } = settled[j].value;
        results.push(...items);
        if (missingSymbols && missingSymbols.length > 0) failed.push(...missingSymbols);
      } else {
        failed.push(...group[j]); // 전체 배치 실패 — 200 심볼 통째로 실패 처리
        console.warn('[update-us] v7 batch 실패:', settled[j].reason?.message);
      }
    }
  }
  return { results, failed };
}

// ── 메인 함수 ──
// #169: 샤딩 제거. 단일 invocation 에서 전 종목 v7 batch 로 갱신 → snap:us 에 직접 저장.
export async function updateUs(env) {
  const redis = getRedis();
  try {
    // 1. 종목 리스트 + marketCap 맵 (24h 캐시)
    const { symbols: allSymbols, mcMap } = await getSymbolList();
    console.log(`[update-us] v7 batch 시작: ${allSymbols.length}개 (BATCH=${BATCH_SIZE} 병렬=${BATCH_CONCURRENCY})`);

    // 2. 전 종목 v7 batch 조회
    const { results: firstResults, failed } = await fetchAllV7Batches(allSymbols, mcMap, 10000);

    // 3. 실패 심볼 재시도 (50% 미만일 때만 — 대규모 장애 시 재시도 비용 방지)
    let retryResults = [];
    const failRatio = allSymbols.length > 0 ? failed.length / allSymbols.length : 0;
    if (failed.length > 0 && failRatio < 0.5) {
      console.log(`[update-us] 재시도: ${failed.length}개`);
      const { results: retried } = await fetchAllV7Batches(failed, mcMap, 12000);
      retryResults = retried;
    }

    let items = [...firstResults, ...retryResults];

    // 4. 부분 실패 시 기존 snap 보존 머지 (#169 Codex HIGH #2)
    //    30% 이상 실패면 신규 items 로 통째 덮으면 coverage 축소 regression.
    //    기존 snap:us 를 읽어 symbol 기준 Map 머지 → 이번 배치 성공분으로 상위 덮어쓰기.
    const finalFailed = failed.length - retryResults.length;
    if (finalFailed > allSymbols.length * 0.3 && redis && items.length > 0) {
      try {
        const existing = await redis.get(SNAP_KEYS.US);
        if (Array.isArray(existing) && existing.length > 0) {
          const merged = new Map();
          for (const it of existing) merged.set(it.symbol, it);
          for (const it of items) merged.set(it.symbol, it); // 신규가 기존을 덮어씀
          items = [...merged.values()];
          console.log(`[update-us] 부분실패 머지: 신규 ${firstResults.length + retryResults.length} + 기존 보존 → ${items.length}`);
        }
      } catch (_) { /* 머지 실패해도 items 로 진행 */ }
    }

    // 5. snap:us 에 단일 저장
    if (items.length > 0) {
      await setSnap(SNAP_KEYS.US, items, SNAP_TTL.US);
    } else {
      try { await recordCronFailure('us', '전량 실패 — v7 batch 응답 없음'); } catch (_) {}
    }

    console.log(`[update-us] 저장: ${items.length}개 (재시도 ${retryResults.length}, 최종실패 ${finalFailed})`);
    return {
      ok: items.length > 0,
      totalSymbols: allSymbols.length,
      count: items.length,
      retried: retryResults.length,
      failed: finalFailed,
    };
  } catch (err) {
    try { await recordCronFailure('us', String(err?.message || err)); } catch (_) {}
    throw err;
  }
}
