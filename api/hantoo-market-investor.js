// 한투 Open API — 코스피/코스닥 시장 전체 투자자 동향 Vercel serverless
//
// 요청: GET /api/hantoo-market-investor
// 응답: { kospi, kosdaq, combined } — 각 { foreign, institution, individual } (단위: 원)
//
// KIS 엔드포인트: /uapi/domestic-stock/v1/quotations/inquire-investor
//   FID_COND_MRKT_DIV_CODE: U (지수)
//   FID_INPUT_ISCD: 0001(코스피) | 1001(코스닥)
//   tr_id: FHKST01010900
//
// KIS 키 미설정 시 Naver fallback 사용 (allorigins 경유)

import { getHantooToken, HANTOO_BASE } from './_hantoo-token.js';
import { todayStr, toWon } from './_hantoo-utils.js';
import { getSnap, setSnap } from './_price-cache.js';

// #382: last-good — 한투+Naver 동시 장애 시 직전 동향 유지 (response에 date/stale 필드 포함, UI 배지는 후속)
const MI_LASTGOOD_KEY = 'market:investor:lastgood';
const MI_LASTGOOD_TTL  = 93600; // 26h — 직전 거래일 동향까지 커버

// 한투 API로 특정 지수 투자자 동향 조회
// iscd: '0001'(코스피) | '1001'(코스닥)
async function fetchMarketFromHantoo(token, iscd, today) {
  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor`);
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'U'); // U = 지수
  url.searchParams.set('FID_INPUT_ISCD',    iscd);
  url.searchParams.set('FID_INPUT_DATE_1',  today);
  url.searchParams.set('FID_INPUT_DATE_2',  today);

  const apiRes = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      appkey:        process.env.HANTOO_APP_KEY,
      appsecret:     process.env.HANTOO_APP_SECRET,
      tr_id:         'FHKST01010900',
      custtype:      'P',
    },
    signal: AbortSignal.timeout(4000),
  });

  if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);

  const data = await apiRes.json();
  if (data.rt_cd !== '0') throw new Error(data.msg1 || data.rt_cd);

  // output 배열 — [0]이 가장 최근 거래일
  const rows   = Array.isArray(data.output) ? data.output : [];
  const latest = rows[0];
  if (!latest) throw new Error(`${iscd} 데이터 없음`);

  return {
    foreign:     toWon(latest.frgn_ntby_tr_pbmn),
    institution: toWon(latest.orgn_ntby_tr_pbmn),
    individual:  toWon(latest.indv_ntby_tr_pbmn),
  };
}

// Naver 모바일 API fallback (allorigins 경유)
// 코스피: KOSPI, 코스닥: KOSDAQ
async function fetchMarketFromNaver(marketCode) {
  const PROXY = 'https://api.allorigins.win/get?url=';
  const naverUrl = `https://m.stock.naver.com/api/index/${marketCode}/investor`;
  const res = await fetch(
    `${PROXY}${encodeURIComponent(naverUrl)}`,
    { signal: AbortSignal.timeout(4000) }, // #382 HIGH: 한투4s+Naver4s=8s < 클라 10s 예산
  );
  if (!res.ok) throw new Error(`Naver proxy ${res.status}`);
  const wrapper = await res.json();
  const text    = wrapper.contents ?? '';
  if (!text) throw new Error('allorigins 빈 응답');
  const json = JSON.parse(text);

  // Naver 지수 investor 응답 필드 파싱
  const toNum = v => parseInt((String(v || '0')).replace(/,/g, ''), 10) || 0;

  return {
    // 금액 필드 (단위: 백만원) — 원 단위로 변환
    foreign:     toNum(json.frgNetAmt   ?? json.frgnNetAmt   ?? 0) * 1_000_000,
    institution: toNum(json.instNetAmt  ?? json.orgNetAmt    ?? 0) * 1_000_000,
    individual:  toNum(json.indvNetAmt  ?? json.retlNetAmt   ?? 0) * 1_000_000,
  };
}

export default async function handler(req, res) {
  const today = todayStr();

  try {
    let kospi, kosdaq;

    // 한투 우선 시도 → 에러 시 Naver 자동 fallback (#135: FID_COND_MRKT_DIV_CODE 거부 대응)
    try {
      if (!process.env.HANTOO_APP_KEY || !process.env.HANTOO_APP_SECRET) {
        throw new Error('HANTOO_APP_KEY 미설정');
      }
      const token = await getHantooToken();
      [kospi, kosdaq] = await Promise.all([
        fetchMarketFromHantoo(token, '0001', today),
        fetchMarketFromHantoo(token, '1001', today),
      ]);
    } catch (hantooErr) {
      console.warn('[market-investor] 한투 실패 → Naver fallback:', hantooErr.message);
      [kospi, kosdaq] = await Promise.all([
        fetchMarketFromNaver('KOSPI'),
        fetchMarketFromNaver('KOSDAQ'),
      ]);
    }

    // 코스피+코스닥 합산
    const combined = {
      foreign:     kospi.foreign     + kosdaq.foreign,
      institution: kospi.institution + kosdaq.institution,
      individual:  kospi.individual  + kosdaq.individual,
    };

    const result = { kospi, kosdaq, combined, date: today };
    // #382 HIGH: await — 응답 후 컨텍스트 동결 전 last-good 쓰기 보장 (fire-and-forget 시 드롭)
    await setSnap(MI_LASTGOOD_KEY, result, MI_LASTGOOD_TTL);

    // 55초 캐시 (1분 갱신 주기에 맞춤)
    res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=10');
    res.json(result);

  } catch (e) {
    console.error('[market-investor]', e.message);
    // #382: 한투+Naver 동시 장애 → last-good 복구(stale 200), 없으면 error 200
    // (500→200 — 게이트웨이로 5xx 전파 차단. 섹션은 data.error로 숨김 유지)
    try {
      const lastGood = await getSnap(MI_LASTGOOD_KEY);
      if (lastGood && lastGood.combined) {
        res.setHeader('Cache-Control', 's-maxage=30');
        return res.status(200).json({ ...lastGood, stale: true });
      }
    } catch { /* last-good 조회 실패 무시 */ }
    // [SEC] 내부 에러 메시지 비노출 — 클라는 error 존재 여부만 확인(섹션 숨김)
    res.status(200).json({ error: 'unavailable' });
  }
}
