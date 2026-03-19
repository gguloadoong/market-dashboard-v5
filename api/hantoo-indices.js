// 한투 Open API — 국내 업종지수 현재가 Vercel serverless
// KOSPI(0001), KOSDAQ(1001) 업종 현재가 조회
//
// 요청: GET /api/hantoo-indices
// 응답: { data: [ { id, value, change, changePct } ] }

import { getHantooToken, HANTOO_BASE } from './_hantoo-token.js';

const INDICES = [
  { id: 'KOSPI',  code: '0001' },
  { id: 'KOSDAQ', code: '1001' },
];

async function fetchSingleIndex(code, token) {
  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-index-price`);
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'U'); // U = 업종
  url.searchParams.set('FID_INPUT_ISCD', code);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization:  `Bearer ${token}`,
      appkey:         process.env.HANTOO_APP_KEY,
      appsecret:      process.env.HANTOO_APP_SECRET,
      tr_id:          'FHPUP02100000',
      custtype:       'P',
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.rt_cd !== '0') throw new Error(data.msg1 || `rt_cd ${data.rt_cd}`);

  const o = data.output;
  const value = parseFloat(o.bstp_nmix_prpr || '0');
  if (!value) throw new Error('지수 값 없음');

  // bstp_nmix_prdy_vrss: 전일 대비, bstp_nmix_prdy_ctrt: 전일 대비율
  const sign   = o.prdy_vrss_sign ?? '3';
  const absChg = parseFloat(o.bstp_nmix_prdy_vrss || '0');
  const change = (sign === '4' || sign === '5') ? -absChg : absChg;

  return {
    value:     parseFloat(value.toFixed(2)),
    change:    parseFloat(change.toFixed(2)),
    changePct: parseFloat(o.bstp_nmix_prdy_ctrt || '0'),
  };
}

export default async function handler(req, res) {
  if (!process.env.HANTOO_APP_KEY || !process.env.HANTOO_APP_SECRET) {
    return res.status(503).json({ error: 'HANTOO not configured' });
  }

  try {
    const token   = await getHantooToken();
    const settled = await Promise.allSettled(
      INDICES.map(async ({ id, code }) => {
        const data = await fetchSingleIndex(code, token);
        return { id, ...data };
      })
    );

    const data   = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const errors = settled.filter(r => r.status === 'rejected').map(r => r.reason?.message);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');
    res.json({ data, errors: errors.length ? errors : undefined });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
