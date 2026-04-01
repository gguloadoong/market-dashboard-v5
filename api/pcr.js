// Put/Call Ratio — Yahoo Finance 옵션 데이터 (무료, 키 없음)
export const config = { runtime: 'edge' };

export default async function handler(request) {
  try {
    // SPY 옵션 체인 조회 (S&P500 ETF — 가장 유동성 높은 옵션)
    const res = await fetch(
      'https://query2.finance.yahoo.com/v7/finance/options/SPY',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MarketBot/1.0)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ pcr: null, error: 'yahoo_fetch_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      });
    }

    const data = await res.json();
    const chain = data?.optionChain?.result?.[0];
    if (!chain) {
      return new Response(JSON.stringify({ pcr: null, error: 'no_chain' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 전체 만기 옵션 합산
    let totalPutVolume = 0;
    let totalCallVolume = 0;

    const options = chain.options ?? [];
    for (const exp of options) {
      for (const put of (exp.puts ?? [])) {
        totalPutVolume += put.volume ?? 0;
      }
      for (const call of (exp.calls ?? [])) {
        totalCallVolume += call.volume ?? 0;
      }
    }

    // 거래량 없으면 OI 사용
    if (totalPutVolume === 0 && totalCallVolume === 0) {
      for (const exp of options) {
        for (const put of (exp.puts ?? [])) {
          totalPutVolume += put.openInterest ?? 0;
        }
        for (const call of (exp.calls ?? [])) {
          totalCallVolume += call.openInterest ?? 0;
        }
      }
    }

    if (totalCallVolume === 0) {
      return new Response(JSON.stringify({ pcr: null, error: 'no_call_volume' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pcr = totalPutVolume / totalCallVolume;
    let signal = 'neutral';
    if (pcr > 1.2) signal = 'bullish';
    else if (pcr < 0.7) signal = 'bearish';

    return new Response(
      JSON.stringify({ pcr: parseFloat(pcr.toFixed(4)), totalPuts: totalPutVolume, totalCalls: totalCallVolume, signal }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ pcr: null, error: e.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
