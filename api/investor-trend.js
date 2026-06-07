// api/investor-trend.js — 국장 투자자 동향 추이 Serverless
// Naver Finance 모바일 API → 외인/기관/개인 N일 순매수 반환
//
// GET /api/investor-trend?symbol=005930&days=30
// 응답: { data: [ { date, foreign, institution, individual, foreignFmt, institutionFmt, individualFmt } ] }

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseInt(String(val).replace(/,/g, ''), 10) || 0;
}

function formatNetAmt(won) {
  const abs = Math.abs(won);
  if (abs >= 1_000_000_000_000) return `${(won / 1_000_000_000_000).toFixed(1)}조`;
  if (abs >= 100_000_000)       return `${(won / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000)            return `${(won / 10_000).toFixed(0)}만`;
  return String(won);
}

export default async function handler(req, res) {
  const symbol = (req.query.symbol || '').trim();
  const days   = Math.min(parseInt(req.query.days || '30', 10) || 30, 60);

  if (!/^\d{6}$/.test(symbol)) {
    return res.status(400).json({ error: 'symbol must be 6-digit KR stock code' });
  }

  // Naver Finance 모바일 — 투자자 일별 순매수 추이
  // (#355) 구 /investors 엔드포인트 폐기(404) → /trend 로 마이그레이션.
  // 신 엔드포인트는 순매수 *수량(주)*을 반환(foreignerPureBuyQuant 등) → 종가를 곱해 순매수 금액(원) 근사.
  const url = `https://m.stock.naver.com/api/stock/${symbol}/trend?periodType=DAILY&count=${days}`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://m.stock.naver.com/',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`Naver HTTP ${resp.status}`);
    const json = await resp.json();

    const list = Array.isArray(json) ? json : (json.list ?? json.investorList ?? json.investors ?? []);

    const data = list.slice(0, days).map(row => {
      // 신 /trend: 순매수 *수량(주)* → 종가를 곱해 순매수 금액(원) 근사(소비처 억/조 표기 의미 보존).
      //   부호는 수량·금액 동일 → 연속 매수매도 streak 판정 무영향.
      // 구 /investors: 이미 금액(원) → 폴백 시 종가 곱 없이 그대로 사용.
      const close = toNum(row.closePrice);
      const toAmt = (qtyVal, oldAmtVal) => {
        if (qtyVal !== null && qtyVal !== undefined && qtyVal !== '') {
          const q = toNum(qtyVal);
          return close > 0 ? q * close : q; // 종가 미상 시 수량 그대로(부호 보존)
        }
        return toNum(oldAmtVal);
      };
      const foreign     = toAmt(row.foreignerPureBuyQuant,  row.frgnNetAmt ?? row.frgNetAmt ?? row.foreignNetAmt);
      const institution = toAmt(row.organPureBuyQuant,      row.instNetAmt ?? row.institutionNetAmt);
      const individual  = toAmt(row.individualPureBuyQuant,  row.indvNetAmt ?? row.individualNetAmt);
      return {
        date:           row.bizdate ?? row.stcTrdDd ?? row.bizday ?? row.date ?? '',
        foreign,
        institution,
        individual,
        foreignFmt:     formatNetAmt(foreign),
        institutionFmt: formatNetAmt(institution),
        individualFmt:  formatNetAmt(individual),
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({ data });
  } catch (err) {
    console.error('[investor-trend]', symbol, err.message);
    return res.status(500).json({ error: '투자자 동향 데이터를 가져오지 못했습니다.' });
  }
}
