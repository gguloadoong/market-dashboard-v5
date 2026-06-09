// api/krx-etf.js — KRX Open API로 국내 ETF 전체 목록 조회
// GET /api/krx-etf
// 전일 종가 기준 (실시간 아님), GlobalSearch 종목 확보용
// 거래일 기준 최근 5일 중 데이터 있는 날 자동 선택

import { getSnap, setSnap } from './_price-cache.js';

const KRX_BASE  = 'https://data-dbg.krx.co.kr/svc/apis';
const AUTH_KEY  = process.env.KRX_API_KEY;

// #382: fail-fast + last-good — KRX Open API 지연/장애 시 게이트웨이 12s 타임아웃→500 방지
const ETF_LASTGOOD_KEY  = 'etf:krx:lastgood';
const ETF_LASTGOOD_TTL  = 172800; // 48h — 전일 종가(정적)라 장기 보존 무해
const FETCH_TIMEOUT_MS  = 4000;   // 8s→4s. KRX 정상 응답 2~3s(#312), 느릴 때 빠르게 포기
const TOTAL_DEADLINE_MS = 3000;   // 순차 누적 cap. 실제 바인딩 제약은 클라 abort 8s(_gateway fetchKrxEtf)
                                  // 최악 = deadline+timeout+Redis = 3+4+α ≈ 7s < 8s → last-good를 클라까지 전달 보장

// YYYYMMDD 형식 날짜 — offset 일 이전
function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  // 주말 건너뛰기
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchEtfForDate(basDd) {
  const res = await fetch(`${KRX_BASE}/etp/etf_bydd_trd`, {
    method:  'POST',
    headers: {
      'AUTH_KEY':    AUTH_KEY.trim(),
      'Content-Type': 'application/json',
    },
    body:   JSON.stringify({ basDd }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`KRX ${res.status}`);
  const data = await res.json();
  const list = data?.OutBlock_1 ?? [];
  return list;
}

// 숫자 문자열 정제 — 콤마/공백 제거
function num(s) {
  if (!s) return 0;
  return parseFloat(String(s).replace(/,/g, '').trim()) || 0;
}

export default async function handler(_req) {
  try {
    if (!AUTH_KEY) {
      return Response.json({ error: 'KRX_API_KEY not set', etfs: [] }, { status: 500 });
    }

    // 순차 3 영업일 시도 — 첫 성공 날짜에서 즉시 중단 (최신 우선 + KRX 쿼터 보호)
    // 각 8s 타임아웃 × 최대 3일 = 최악 24s (#312: KRX가 인증 요청 처리에 2s+ 소요 확인).
    // dateStr()이 주말을 금요일로 collapse → 월요일엔 Fri 3중복 발생.
    // offset을 최대 2주(14)까지 확장하고 dedup으로 **3 영업일 보장**.
    let list = [];
    const uniqueDates = [...new Set(
      Array.from({ length: 14 }, (_, i) => dateStr(i + 1)),
    )].slice(0, 3);
    const startedAt = Date.now();
    for (const basDd of uniqueDates) {
      // #382: 누적 deadline 가드 — KRX 지연 시 게이트웨이 타임아웃 전 중단
      if (Date.now() - startedAt > TOTAL_DEADLINE_MS) break;
      try {
        const rows = await fetchEtfForDate(basDd);
        if (rows.length > 0) { list = rows; break; }
      } catch (e) {
        console.error(`[krx-etf] ${basDd} 실패:`, e);
      }
    }

    // KRX 응답 → 프론트 ETF_DATA 포맷으로 변환 (list 비어도 빈 배열)
    const etfs = list.map(r => {
      const price     = num(r.TDD_CLSPRC);
      const prevClose = price - num(r.CMPPREVDD_PRC);
      const change    = num(r.CMPPREVDD_PRC);
      const changePct = prevClose > 0
        ? parseFloat(((change / prevClose) * 100).toFixed(2))
        : 0;
      return {
        symbol:    (r.ISU_CD  || r.ISU_SRT_CD || '').trim(),
        name:      (r.ISU_NM  || r.ISU_ABBRV  || '').trim(),
        market:    'kr',
        sector:    'ETF',
        category:  'ETF',
        price:     parseFloat(price.toFixed(0)),
        change:    parseFloat(change.toFixed(0)),
        changePct,
        volume:    num(r.ACC_TRDVOL),
        aum:       num(r.MKTCAP),
      };
    }).filter(e => e.symbol && e.name && e.price > 0);

    // #382 HIGH: KRX 실패/타임아웃 OR 스키마 드리프트로 결과 0건 → last-good 복구
    // (list 있어도 filter 후 빈 경우 포함 — 빈 배열 6h 고착 방지)
    if (!etfs.length) {
      const lastGood = await getSnap(ETF_LASTGOOD_KEY);
      if (Array.isArray(lastGood) && lastGood.length) {
        console.warn('[krx-etf] 결과 0건 → last-good 반환');
        return Response.json({ etfs: lastGood, stale: true }, {
          headers: { 'Cache-Control': 'public, s-maxage=600' },
        });
      }
      return Response.json({ etfs: [] }, {
        // #386: 빈배열(KRX실패+last-good부재)은 짧게 — 일시장애 CDN 고착 방지(60s self-heal)
        headers: { 'Cache-Control': 'public, s-maxage=60' },
      });
    }

    // #382 HIGH: await — 응답 후 컨텍스트 동결 전 last-good 쓰기 보장 (fire-and-forget 시 드롭)
    await setSnap(ETF_LASTGOOD_KEY, etfs, ETF_LASTGOOD_TTL);

    return Response.json({ etfs }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600', // #386: 6h→1h (EOD 전일종가, CDN 활성화 신선도 안전)
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    console.error('[krx-etf] handler 크래시:', e);
    // #382: 크래시에도 last-good 우선, 없으면 빈 배열 200 — 위젯 hang/500 제거
    const lastGood = await getSnap(ETF_LASTGOOD_KEY).catch(() => null);
    if (Array.isArray(lastGood) && lastGood.length) {
      return Response.json({ etfs: lastGood, stale: true }, { status: 200 });
    }
    return Response.json({ etfs: [] }, { status: 200 });
  }
}
