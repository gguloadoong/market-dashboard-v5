// crons/update-us.js — 미장 가격 갱신 (Yahoo v8 chart, 샤드 기반)
// #171: v7 batch 의 401 인증 회귀로 v8 개별 호출 복원.
//   멀티 오프셋 병렬 크론 (cron 2,3,4) 각각 900 종목 샤드 처리 → 풀 리프레시 5분.
//   3 shards × 900 = 2700 종목 (NASDAQ 시총 상위).
//   샤드당 900 subrequest (CF Workers Paid Standard 1000 한도 내 안전 마진).

import { SNAP_KEYS, SNAP_TTL, setSnap, recordCronFailure, getRedis } from '../price-cache.js';

// ── 샤딩 / 배치 설정 ──
const SYMBOL_LIMIT = 2700;        // 3 shards × 900
const SHARD_SIZE = 900;           // 샤드당 종목 수 (~900 subrequest/invocation)
const TOTAL_SHARDS = 3;
const CONCURRENCY = 30;           // v8 개별 호출 병렬도
const SYMBOL_LIST_TTL = 86400;    // NASDAQ 종목 리스트 24시간 캐시
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

// ── Yahoo v8 chart 개별 호출 ──
// v7 quote 배치는 CF Worker IP 에서 401(crumb/cookie) 요구로 차단.
// v8 chart 는 인증 없이 개별 심볼 조회 가능. 개당 subrequest 1개 소모.
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
let _hostIdx = 0;
function nextHost() { return YAHOO_HOSTS[(_hostIdx++) % YAHOO_HOSTS.length]; }

// v8 chart API 개별 심볼 조회.
// BRK.A 등 dot 심볼은 Yahoo 포맷(BRK-A)으로 dash 치환 후 요청 (#169 Codex HIGH #1 관행 유지).
// mcMap 에서 marketCap 을 머지 (v8 응답엔 marketCap 없음).
async function fetchYahooV8Single(symbol, timeoutMs = 10000, mcMap = null) {
  // Yahoo v8 은 dot 심볼을 dash 로 요청 (BRK.A → BRK-A)
  const yahooSymbol = symbol.includes('.') ? symbol.replace('.', '-') : symbol;
  const host = nextHost();
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Yahoo v8 HTTP ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('Yahoo v8: result 없음');

  const meta = result.meta || {};
  const price = Number(meta.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Yahoo v8: 가격 무효');
  const prev = Number(meta.chartPreviousClose) || Number(meta.previousClose) || price || 0;
  const volume = Number(meta.regularMarketVolume) || 0;

  // mcMap lookup 은 원본(raw) 또는 dash 치환 심볼 양쪽 키로 시도 — NASDAQ 포맷이 환경별로 다름
  const mcFromNasdaq = mcMap ? (mcMap[symbol] || mcMap[yahooSymbol]) : 0;
  const marketCap = mcFromNasdaq || 0;

  return {
    symbol: yahooSymbol,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat((price - prev).toFixed(2)),
    changePct: prev > 0 ? parseFloat(((price - prev) / prev * 100).toFixed(2)) : 0,
    volume,
    marketCap,
    name: meta.shortName || meta.longName || yahooSymbol,
    market: 'us',
  };
}

// 전 심볼을 CONCURRENCY 병렬 청크로 v8 개별 호출.
// 성공: results, 실패(HTTP/parse/가격 무효): failed 에 원본 심볼 집계.
async function fetchBatch(symbols, timeoutMs = 10000, mcMap = null) {
  const results = [];
  const failed = [];
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const chunk = symbols.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map((s) => fetchYahooV8Single(s, timeoutMs, mcMap))
    );
    for (let j = 0; j < settled.length; j++) {
      if (settled[j].status === 'fulfilled') {
        results.push(settled[j].value);
      } else {
        failed.push(chunk[j]);
      }
    }
  }
  return { results, failed };
}

// ── 메인 함수 ──
// #171: 샤딩 복원. shardId ∈ [0, TOTAL_SHARDS) 필수 (기본값 없음 — 호출자 명시 강제).
//   각 샤드는 자기 전용 키(snap:us:N)에만 쓰기 → 샤드 간 race condition 원천 차단.
//   reader(api/_price-cache.js) 가 snap:us:0..N 을 mget 후 merge 하는 "sharded-read" 패턴.
export async function updateUs(env, shardId) {
  if (!Number.isInteger(shardId) || shardId < 0 || shardId >= TOTAL_SHARDS) {
    throw new Error(`updateUs: shardId 필수(0~${TOTAL_SHARDS - 1}) — 받은 값: ${shardId}`);
  }
  const redis = getRedis();
  try {
    const { symbols: allSymbols, mcMap } = await getSymbolList();
    const totalSymbols = Math.min(allSymbols.length, SYMBOL_LIMIT);
    const start = shardId * SHARD_SIZE;
    const end = Math.min(start + SHARD_SIZE, totalSymbols);
    const shardSymbols = allSymbols.slice(start, end);
    const shardKey = `${SNAP_KEYS.US}:${shardId}`;
    console.log(`[update-us] 샤드 ${shardId}/${TOTAL_SHARDS - 1}: ${shardSymbols.length}개 (${start}~${end - 1}) → ${shardKey}`);

    if (shardSymbols.length === 0) {
      return { ok: true, shardId, count: 0 };
    }

    const { results, failed } = await fetchBatch(shardSymbols, 10000, mcMap);

    // 실패 재시도 (50% 미만 + 재시도 추가 subrequest 가 1000 한도 넘지 않을 때만)
    let retryResults = [];
    const failRatio = failed.length / shardSymbols.length;
    const wouldExceedBudget = (shardSymbols.length + failed.length) > 980;  // 샤드 Yahoo + 재시도 합산
    if (failed.length > 0 && failRatio < 0.5 && !wouldExceedBudget) {
      console.log(`[update-us] 샤드 ${shardId} 재시도: ${failed.length}개`);
      const { results: retried } = await fetchBatch(failed, 12000, mcMap);
      retryResults = retried;
    } else if (wouldExceedBudget) {
      console.log(`[update-us] 샤드 ${shardId} 재시도 skip — subrequest 예산 초과 우려 (${shardSymbols.length + failed.length})`);
    }

    const shardItems = [...results, ...retryResults];

    // 샤드 전용 키에만 쓰기 — snap:us 공유 키는 절대 건드리지 않음 (race 방지)
    // 빈 배열이면 쓰기 skip (직전 성공분 TTL 내 보존)
    if (shardItems.length > 0) {
      try {
        await setSnap(shardKey, shardItems, SNAP_TTL.US);
        console.log(`[update-us] 샤드 ${shardId} 저장: ${shardItems.length}개 → ${shardKey}`);
        // #185: 샤드 0 에서만 hot 계산. 자기 샤드 쓰기 완료 → snap:us:0..2 mget → merge → Top 200.
        //        다른 샤드는 자기 쓰기 직후 이미 redis 에 있으므로 race 없음.
        //        샤드 1/2 아직 안 썼다면 mget 이 일부 null 이지만, 다음 샤드 0 실행(5분 뒤)에 복원됨.
        if (shardId === 0) {
          try {
            const shardKeys = Array.from({ length: TOTAL_SHARDS }, (_, i) => `${SNAP_KEYS.US}:${i}`);
            const shards = await redis.mget(...shardKeys);
            const merged = new Map();
            for (const arr of shards) {
              if (!Array.isArray(arr)) continue;
              for (const it of arr) merged.set(it.symbol, it);
            }
            // #185 cold start sanity: 최소 2 샤드(2×SHARD_SIZE=1800) 이상 병합돼야 hot 저장.
            // 신규 배포/Redis flush 직후 샤드 0만 있는 상태에서 편향된 Top 200 서빙 방지.
            // 다음 샤드 0 실행(5분 뒤)에 정상 복원 — skip 이 편향 서빙보다 안전.
            const MIN_SYMBOLS_FOR_HOT = SHARD_SIZE * 2;
            if (merged.size >= MIN_SYMBOLS_FOR_HOT) {
              const hot = [...merged.values()]
                .sort((a, b) => {
                  const mc = (b.marketCap || 0) - (a.marketCap || 0);
                  if (mc !== 0) return mc;
                  return String(a.symbol).localeCompare(String(b.symbol));
                })
                .slice(0, 200);
              await setSnap(SNAP_KEYS.US_HOT, hot, SNAP_TTL.HOT);
              console.log(`[update-us] hot 저장: ${hot.length}개 (merged ${merged.size})`);
            } else {
              console.warn(`[update-us] hot skip — 병합(${merged.size}) < ${MIN_SYMBOLS_FOR_HOT} (cold start 편향 방지)`);
            }
          } catch (e) {
            console.warn('[update-us] hot 계산/저장 실패:', e?.message || e);
          }
        }
      } catch (e) {
        // 샤드 전용 키 쓰기 실패 시: 에러 기록만 하고 진행. 공유 snap:us 로 fallback 쓰기 금지
        // (다른 샤드 데이터 덮어쓰면 전체 coverage 전멸 — Codex CRITICAL #1 반영).
        console.warn(`[update-us] 샤드 ${shardId} setSnap 실패: ${e?.message || e}`);
        try { await recordCronFailure('us', `샤드 ${shardId} setSnap: ${String(e?.message || e)}`); } catch (_) {}
      }
    } else {
      // 전량 실패: 기존 snap:us:N 은 건드리지 않음 (TTL 내 직전 성공분 보존)
      try { await recordCronFailure('us', `샤드 ${shardId} 전량 실패`); } catch (_) {}
    }

    return {
      ok: shardItems.length > 0,
      shardId,
      count: shardItems.length,
      retried: retryResults.length,
      failed: failed.length - retryResults.length,
      totalSymbols: shardSymbols.length,
    };
  } catch (err) {
    try { await recordCronFailure('us', `샤드 ${shardId}: ${String(err?.message || err)}`); } catch (_) {}
    throw err;
  }
}
