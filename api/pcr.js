// Put/Call Ratio — Deribit BTC 옵션 (무료, 키 없음)
export const config = { runtime: 'edge' };

export default async function handler(_request) {
  try {
    const res = await fetch(
      'https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option',
      { signal: AbortSignal.timeout(8000) },
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ pcr: null, error: 'deribit_fetch_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await res.json();
    const items = data?.result ?? [];

    let putVolume = 0;
    let callVolume = 0;

    for (const item of items) {
      const name = item.instrument_name ?? '';
      const vol = item.volume ?? 0;
      if (name.endsWith('-P')) putVolume += vol;
      else if (name.endsWith('-C')) callVolume += vol;
    }

    if (callVolume === 0) {
      return new Response(JSON.stringify({ pcr: null, error: 'no_call_volume' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const pcr = putVolume / callVolume;
    let signal = 'neutral';
    if (pcr > 1.2) signal = 'bullish';
    else if (pcr < 0.7) signal = 'bearish';

    return new Response(
      JSON.stringify({ pcr: parseFloat(pcr.toFixed(4)), totalPuts: parseFloat(putVolume.toFixed(2)), totalCalls: parseFloat(callVolume.toFixed(2)), signal, source: 'deribit_btc' }),
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
