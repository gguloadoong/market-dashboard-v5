// api/cron/update-us.js — 미장 가격 갱신 Edge Cron
// Yahoo Finance v8 chart per-symbol + query1/query2 rotation → Redis 저장
export const config = { runtime: 'edge' };

import { SNAP_KEYS, SNAP_TTL, setSnap, recordCronFailure } from '../_price-cache.js';

// 주요 S&P500 + 기존 88개 종목 통합 심볼 목록
const US_SYMBOLS = [
  // 빅테크
  'AAPL','MSFT','GOOGL','GOOG','AMZN','NVDA','META','TSLA','BRK-B','AVGO',
  // 반도체
  'AMD','INTC','QCOM','MU','AMAT','LRCX','KLAC','MRVL','ON','NXPI',
  // 소프트웨어/클라우드
  'CRM','ORCL','ADBE','NOW','INTU','SNPS','CDNS','PANW','CRWD','FTNT',
  // 핀테크/결제
  'V','MA','PYPL','SQ','COIN','GS','JPM','BAC','WFC','MS',
  // 헬스케어/바이오
  'UNH','JNJ','LLY','ABBV','MRK','PFE','TMO','ABT','AMGN','GILD',
  // 소비재
  'COST','WMT','HD','NKE','MCD','SBUX','TGT','LOW','TJX','BKNG',
  // 에너지/산업
  'XOM','CVX','COP','SLB','LMT','BA','CAT','GE','HON','UNP',
  // 통신/미디어
  'DIS','NFLX','CMCSA','T','VZ','TMUS','SPOT','ROKU','PARA','WBD',
  // ETF (주요)
  'SPY','QQQ','DIA','IWM','VOO','VTI','ARKK','SOXX','XLF','XLE',
  // 기타 인기 종목
  'PLTR','UBER','ABNB','RIVN','LCID','NIO','LI','XPEV','DKNG','RBLX',
  'SNOW','NET','DDOG','ZS','MDB','SHOP','SE','MELI','GRAB','CPNG',
  // 추가 대형주
  'ACN','IBM','CSCO','TXN','NEE','PG','KO','PEP','PM','MO',
];

const CONCURRENCY = 25; // Yahoo v8 동시 요청 수 (10→25 성능 개선)
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
let _hostIdx = 0;
function nextHost() {
  return YAHOO_HOSTS[(_hostIdx++) % YAHOO_HOSTS.length];
}

// Yahoo v8 chart 단일 심볼 — v7 batch 대비 Vercel Edge에서 안정적
async function fetchYahooV8Single(symbol, timeoutMs = 8000) {
  const host = nextHost();
  const url = `https://${host}/v8/finance/chart/${symbol}?interval=1d&range=5d&includePrePost=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Yahoo v8 ${symbol} ${res.status}`);
  const data   = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result?.meta?.regularMarketPrice) throw new Error(`no price: ${symbol}`);
  const meta   = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
  const price  = meta.regularMarketPrice;
  let prev     = meta.previousClose;
  if (!prev || Math.abs(prev - price) / Math.max(Math.abs(price), 1) < 0.0001) {
    for (let i = closes.length - 2; i >= 0; i--) {
      if (closes[i] && Math.abs(closes[i] - price) / Math.max(Math.abs(price), 1) >= 0.0001) {
        prev = closes[i]; break;
      }
    }
  }
  if (!prev) prev = price;
  return {
    symbol:    meta.symbol?.split('.')[0] ?? symbol,
    price:     parseFloat(price.toFixed(2)),
    change:    parseFloat((price - prev).toFixed(2)),
    changePct: prev > 0 ? parseFloat(((price - prev) / prev * 100).toFixed(2)) : 0,
    volume:    meta.regularMarketVolume ?? 0,
    marketCap: 0,
    name:      meta.shortName || meta.longName || symbol,
    market:    'us',
  };
}

// 동시성 제한 배치 실행 (타임아웃 커스텀 지원)
async function fetchYahooBatch(symbols, timeoutMs = 8000) {
  const results = [];
  const failedSymbols = [];
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const chunk = symbols.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(sym => fetchYahooV8Single(sym, timeoutMs))
    );
    for (let j = 0; j < settled.length; j++) {
      if (settled[j].status === 'fulfilled') results.push(settled[j].value);
      else failedSymbols.push(chunk[j]);
    }
  }
  if (failedSymbols.length > 0) {
    console.warn(`[update-us] Yahoo v8 실패 ${failedSymbols.length}/${symbols.length}개`);
  }
  return { results, failedSymbols };
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
    // 1차 실행
    const { results: firstResults, failedSymbols } = await fetchYahooBatch(US_SYMBOLS);

    // 2단계 재시도 — 실패 비율 50% 이상이면 서버 문제로 판단하여 스킵
    let retryResults = [];
    const failRatio = failedSymbols.length / US_SYMBOLS.length;
    if (failedSymbols.length > 0 && failRatio < 0.5) {
      console.log(`[update-us] 2차 재시도: ${failedSymbols.length}개 (타임아웃 10초)`);
      const { results: retried } = await fetchYahooBatch(failedSymbols, 10000);
      retryResults = retried;
    } else if (failRatio >= 0.5) {
      console.warn(`[update-us] 실패 비율 ${(failRatio * 100).toFixed(0)}% — 서버 문제로 판단, 재시도 스킵`);
    }

    const items = [...firstResults, ...retryResults];

    // Redis 저장
    if (items.length > 0) {
      await setSnap(SNAP_KEYS.US, items, SNAP_TTL.US);
    }

    // 전량 실패 시 모니터링 기록 (Promise.allSettled가 개별 실패를 삼키므로 catch로 안 감)
    if (items.length === 0) {
      try { await recordCronFailure('us', `전량 실패: ${US_SYMBOLS.length}개 심볼 모두 응답 없음`); } catch (_) { /* 무시 */ }
    }

    return new Response(JSON.stringify({
      ok: items.length > 0,
      count: items.length,
      retried: retryResults.length,
      failed: failedSymbols.length - retryResults.length,
    }), {
      status: items.length > 0 ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    // Cron 실패 기록 — 기록 실패가 에러 응답을 덮어쓰지 않도록 방어
    try { await recordCronFailure('us', String(err?.message || err)); } catch (_) { /* 무시 */ }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
