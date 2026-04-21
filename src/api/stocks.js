// 주식 데이터
// 미국: /api/d (통합 게이트웨이) → Stooq.com (CORS OK) → Yahoo Finance v7 프록시 fallback → v8 chart fallback
// 한국: /api/d (통합 게이트웨이) → Yahoo .KS 프록시 fallback
import {
  fetchUsPrice, fetchHantooPrice, fetchNaverPrice,
  fetchEtfPrices, fetchMarketIndices, fetchHantooIndices as gwHantooIndices,
} from './_gateway.js';

// ─── Stooq.com (미국 주식, CORS 허용) ────────────────────────
// Stooq JSON 배치 API는 최신 1 row만 반환한다.
// 전일 종가를 얻으려면 각 심볼에 대해 CSV 2일치를 별도 요청해야 하나,
// 배치 처리 성능을 위해 Prev_Close 필드(f=...p 포함) 방식을 사용한다.
// f 파라미터: s=심볼, d2=날짜, t2=시각, o=시가, h=고가, l=저가, c=현재가, v=거래량, n=이름, p=전일종가
async function fetchStooq(symbols) {
  const syms = symbols.map(s => `${s.toLowerCase()}.us`).join(',');
  // f=sd2t2ohlcvnp: p 필드로 전일 종가(Prev_Close) 포함
  const url  = `https://stooq.com/q/l/?s=${syms}&f=sd2t2ohlcvnp&h&e=json`;
  // 타임아웃 5000ms — 실패 시 빠르게 다음 소스로 fallback
  const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const data = await res.json();
  // Stooq JSON 필드명: 소문자 (close, previous, volume, symbol 등)
  return (data.symbols || [])
    .filter(s => (s.close ?? s.Close) && (s.close ?? s.Close) !== 'N/D' && parseFloat(s.close ?? s.Close) > 0)
    .map(s => {
      const close     = parseFloat(s.close ?? s.Close);
      // previous(p 필드) 전일 종가 — 없으면 change=0
      const prevClose = parseFloat(s.previous ?? s.Prev_Close) || 0;
      return {
        symbol:    (s.symbol ?? s.Symbol).split('.')[0].toUpperCase(),
        price:     close,
        change:    prevClose > 0 ? parseFloat((close - prevClose).toFixed(2)) : 0,
        changePct: prevClose > 0
          ? parseFloat(((close - prevClose) / prevClose * 100).toFixed(2))
          : 0,
        volume:    parseInt(s.volume ?? s.Volume) || 0,
        _source:   'stooq',
      };
    });
}

// #173: fetchYahooQuoteBatch / fetchYahooChart 제거 — allorigins 경유는
//       CORS 차단으로 실질 작동 안 하던 dead fallback. 주 소스(통합 게이트웨이,
//       Stooq, Naver) 로 충분 커버.

// ─── 미국 주식 ─────────────────────────────────────────────────
export async function fetchUsStocksBatch(symbols) {
  // 부분 결과 보존 Map — 실시간 데이터를 EOD로 오염시키지 않기 위해
  // 각 단계에서 missing symbol만 fallback, 이미 확보된 실시간 데이터는 유지
  const collected = new Map();

  const missing = () => symbols.filter(s => !collected.has(s.toUpperCase()));
  const addResults = (results) => results.forEach(r => {
    const key = (r.symbol || '').toUpperCase();
    if (key && !collected.has(key)) collected.set(key, r);
  });

  // 1) 통합 게이트웨이 — Yahoo v8 실시간 (Vercel Edge 프록시)
  try {
    const data = await fetchUsPrice(symbols, 8000);
    if (data.results?.length > 0) {
      addResults(data.results);
      if (missing().length === 0) return [...collected.values()];
      if (data.results.length < symbols.length * 0.7) {
        console.warn(`[미장] Edge 프록시 부분 결과: ${data.results.length}/${symbols.length} — missing: ${missing().join(',')}`);
      }
    }
  } catch (e) { console.warn('[미장] Edge 프록시 실패:', e.message); }

  // 2) Stooq (직접 CORS 허용, EOD 데이터) — missing symbol만 조회
  const miss2 = missing();
  if (miss2.length > 0) {
    try {
      const data = await fetchStooq(miss2);
      addResults(data);
      if (missing().length === 0) return [...collected.values()];
      if (data.length > 0) console.warn(`[미장] Stooq 부분 결과: ${data.length}/${miss2.length}`);
    } catch (e) { console.warn('[미장] Stooq 실패:', e.message); }
  }

  // #173: 구 fallback 3(Yahoo v7 proxy), 4(Yahoo v8 chart proxy) 제거 —
  //       allorigins CORS 차단으로 실질 작동 안 함. Naver 서버 fallback 이 최종 안전망.

  // 5) 네이버 해외시세 fallback — 통합 게이트웨이/Stooq 모두 실패한 심볼 처리
  const miss5 = missing();
  if (miss5.length > 0) {
    try {
      console.warn(`[미장] Yahoo/Stooq 전부 실패 ${miss5.length}개 → 네이버 해외시세 fallback: ${miss5.join(',')}`);
      const res = await fetch(`/api/naver-us-price?symbols=${miss5.join(',')}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results?.length > 0) addResults(data.results);
      }
    } catch (e) { console.warn('[미장] 네이버 해외시세 실패:', e.message); }
  }

  // 6) 가격 0인 종목 재시도 — 수집됐지만 price=0이면 유효하지 않음
  const zeroPrice = [...collected.entries()]
    .filter(([, v]) => !v.price || v.price <= 0)
    .map(([k]) => k);
  if (zeroPrice.length > 0) {
    console.warn(`[미장] 가격 0 감지 ${zeroPrice.length}개 → 네이버 재시도: ${zeroPrice.join(',')}`);
    // 기존 무효 데이터 제거 후 네이버로 재시도
    zeroPrice.forEach(k => collected.delete(k));
    try {
      const res = await fetch(`/api/naver-us-price?symbols=${zeroPrice.join(',')}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results?.length > 0) {
          data.results.filter(r => r.price > 0).forEach(r => {
            collected.set(r.symbol.toUpperCase(), r);
          });
        }
      }
    } catch (e) { console.warn('[미장] 가격 0 재시도 실패:', e.message); }
  }

  if (collected.size === 0) console.warn('[미장] 모든 소스 실패 — 데이터 없음');
  return [...collected.values()];
}

// ─── Naver Finance (Vercel serverless 프록시) ─────────────────
// allorigins는 520 오류로 사용 불가 → /api/naver-price 서버사이드 경유
const NAVER_BATCH = 25;

async function fetchNaverBatch(stocks) {
  const symbols = stocks.map(s => s.symbol);
  const results = [];

  for (let i = 0; i < symbols.length; i += NAVER_BATCH) {
    const chunk = symbols.slice(i, i + NAVER_BATCH);
    const json = await fetchNaverPrice(chunk, 10000);
    if (Array.isArray(json.data)) results.push(...json.data);
    if (i + NAVER_BATCH < symbols.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return results;
}

// ─── 한국투자증권 Open API (1순위 — 실시간 정확 데이터) ─────────
// Vercel serverless /api/hantoo-price 프록시 경유
// 서버 측 20개 제한 → 클라이언트에서 27개씩 배치 분할 후 병렬 요청
// KIS API TPS 보호: 라운드 간 200ms 딜레이
const HANTOO_BATCH = 27;

async function fetchSingleHantooBatch(chunk) {
  const json = await fetchHantooPrice(chunk, 10000);
  return Array.isArray(json.data) ? json.data : [];
}

async function fetchKoreanStocksHantoo(stocks) {
  const symbols = stocks.map(s => s.symbol);
  const chunks = [];
  for (let i = 0; i < symbols.length; i += HANTOO_BATCH) {
    chunks.push(symbols.slice(i, i + HANTOO_BATCH));
  }

  // 모든 청크 동시 처리 — 50종목(2청크) 기준 순차 대비 50%+ 응답 속도 개선
  const settled = await Promise.allSettled(
    chunks.map(chunk => fetchSingleHantooBatch(chunk))
  );

  const results = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(...r.value);
    else console.warn(`[한투] 배치 실패 (건너뜀):`, r.reason?.message);
  }

  if (!results.length) throw new Error('한투: 데이터 없음');
  return results;
}

// ─── 한국 주식 배치 ────────────────────────────────────────────
export async function fetchKoreanStocksBatch(stocks) {
  // 1) 한국투자증권 Open API (실시간, 가장 정확)
  // 배치 분할로 127개 전체 커버 — 10% 이상 성공 시 채택 (부분 실패 허용)
  try {
    const data = await fetchKoreanStocksHantoo(stocks);
    if (data.length >= stocks.length * 0.1) return data;
  } catch (e) {
    console.warn('[한투 시세] fallback:', e.message);
  }

  // 2) Naver Finance via Vercel serverless (한투 실패 시 fallback)
  try {
    const valid = await fetchNaverBatch(stocks);
    if (valid.length >= stocks.length * 0.1) return valid;
  } catch (e) { console.warn('[국장] Naver 실패:', e.message); }

  // #173: Yahoo .KS via allorigins fallback 제거 — CORS 차단 dead path.
  //       한투 + Naver 실패 시 빈 배열 반환.
  return [];
}

// ─── ETF 전용 배치 (Vercel 프록시 경유 → Yahoo CORS·레이트리밋 해소) ──────
// 레버리지·코인 ETF(TSLL, CONL, ETHU, BITX 등) 포함 전체 커버리지
export async function fetchEtfPricesBatch(symbols) {
  // 1) 통합 게이트웨이 (ETF) — 서버사이드 Yahoo 호출
  try {
    const data = await fetchEtfPrices(symbols, 10000);
    if (data.results?.length > 0) return data.results;
  } catch {}
  // #173: Yahoo v7/v8 allorigins fallback 제거 — CORS 차단 dead path.
  //       통합 게이트웨이 실패 시 빈 배열 반환.
  return [];
}

// ─── 지수 ────────────────────────────────────────────────────
// 모든 지수: Yahoo Finance via 다중 프록시 동시 레이스 (KOSPI 포함)
// KOSPI: ^KS11, KOSDAQ: ^KQ11 (Yahoo Finance 공식 티커)
const _toNum = s => parseFloat((s || '').toString().replace(/,/g, '')) || 0;

// #173: fetchYahooRace 제거 — allorigins 경유 지수 프록시는 CORS 차단 dead path.
//       KOSPI 는 Stooq + 한투 지수 fallback, 나머지는 통합 게이트웨이만 사용.

// ─── Stooq 한국 지수 (CORS 허용, 실시간에 가까운 데이터) ──────
// 검증 결과: ^kospi 동작 확인, ^kosdaq N/D
async function fetchStooqKospi() {
  // f=sd2t2ohlcvnp: p 필드로 전일 종가(Prev_Close) 포함
  const res = await fetch('https://stooq.com/q/l/?s=^kospi&f=sd2t2ohlcvnp&h&e=json', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Stooq KOSPI ${res.status}`);
  const data = await res.json();
  // Stooq JSON 필드명: 소문자 (close, previous 등)
  const s = (data.symbols || []).find(x => (x.close ?? x.Close) && (x.close ?? x.Close) !== 'N/D');
  if (!s) throw new Error('Stooq KOSPI: N/D');
  const close     = parseFloat(s.close ?? s.Close);
  // previous(p 필드) 전일 종가 기준 — 없으면 change=0
  const prevClose = parseFloat(s.previous ?? s.Prev_Close) || 0;
  return {
    id:        'KOSPI',
    value:     parseFloat(close.toFixed(2)),
    change:    prevClose > 0 ? parseFloat((close - prevClose).toFixed(2)) : 0,
    changePct: prevClose > 0 ? parseFloat(((close - prevClose) / prevClose * 100).toFixed(2)) : 0,
    isDelayed: false,
    dataDelay: '실시간(추정)',
  };
}

// 모든 지수 — Yahoo Finance 티커 매핑 (KOSPI 제외: Stooq 사용)
const ALL_INDICES = [
  // KOSPI는 Stooq로 별도 처리
  { id: 'KOSDAQ', symbol: '^KQ11'    },
  { id: 'SPX',    symbol: '^GSPC'    },
  { id: 'NDX',    symbol: '^NDX'     },
  { id: 'DJI',    symbol: '^DJI'     },
  { id: 'DXY',    symbol: 'DX-Y.NYB' },
];

// 한투 업종지수 (KOSPI/KOSDAQ — 가장 정확한 실시간)
async function fetchHantooIndices() {
  const json = await gwHantooIndices(8000);
  return json.data || [];
}

const ALL_INDEX_IDS = ['KOSPI', 'KOSDAQ', 'SPX', 'NDX', 'DJI', 'DXY'];

export async function fetchIndices() {
  let results = [];

  // 0) 통합 게이트웨이 — 서버사이드 직접 Yahoo 호출
  try {
    const data = await fetchMarketIndices(10000);
    if (data.results?.length > 0) results = data.results;
  } catch (e) { console.warn('[지수] Edge 프록시 실패:', e.message); }

  // 1) 누락된 지수 확인 — Edge 프록시가 부분 결과 반환 시 보충
  const have = new Set(results.map(r => r.id));
  const missing = ALL_INDEX_IDS.filter(id => !have.has(id));

  if (missing.length === 0) return results;

  // 2) KOSPI/KOSDAQ 누락 시 한투 API 보충 (가장 정확)
  const missingKr = missing.filter(id => id === 'KOSPI' || id === 'KOSDAQ');
  if (missingKr.length > 0) {
    try {
      const hantooData = await fetchHantooIndices();
      for (const idx of hantooData) {
        if (missingKr.includes(idx.id)) {
          results.push(idx);
          have.add(idx.id);
        }
      }
    } catch (e) { console.warn('[지수] 한투 지수 fallback 실패:', e.message); }
  }

  // 3) 여전히 누락된 지수: Stooq(KOSPI) fallback. #173: Yahoo allorigins race 제거 (CORS dead).
  const stillMissing = ALL_INDEX_IDS.filter(id => !have.has(id));
  if (stillMissing.length > 0) {
    const fallbackPromises = stillMissing.map(async (id) => {
      if (id === 'KOSPI') {
        try { return await fetchStooqKospi(); } catch {}
      }
      return null;
    });

    const settled = await Promise.allSettled(fallbackPromises);
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }

  return results;
}
