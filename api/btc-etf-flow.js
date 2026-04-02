// BTC · ETH ETF 일별 순유입/유출 — CoinGlass 공개 API
export const config = { runtime: 'edge' };

export default async function handler(request) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600', // 1시간 캐시
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const apiKey = process.env.COINGLASS_API_KEY;
    const baseHeaders = apiKey ? { 'coinglassSecret': apiKey } : {};

    // BTC ETF 데이터 (공개 엔드포인트)
    const [btcRes, ethRes] = await Promise.allSettled([
      fetch('https://open-api.coinglass.com/public/v2/bitcoin_etf_flow_history', {
        headers: baseHeaders,
        signal: AbortSignal.timeout(8000),
      }),
      fetch('https://open-api.coinglass.com/public/v2/ethereum_etf_flow_history', {
        headers: baseHeaders,
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    let btcData = null;
    let ethData = null;

    if (btcRes.status === 'fulfilled' && btcRes.value.ok) {
      const json = await btcRes.value.json();
      // 최신 5일 데이터만
      const list = json?.data?.slice(-5) ?? [];
      btcData = list.map(d => ({
        date: d.date ?? d.time,
        netFlow: d.netFlow ?? d.net ?? 0,  // 백만 달러 단위
        totalFlow: d.totalFlow ?? d.total ?? null,
      }));
    }

    if (ethRes.status === 'fulfilled' && ethRes.value.ok) {
      const json = await ethRes.value.json();
      const list = json?.data?.slice(-5) ?? [];
      ethData = list.map(d => ({
        date: d.date ?? d.time,
        netFlow: d.netFlow ?? d.net ?? 0,
        totalFlow: d.totalFlow ?? d.total ?? null,
      }));
    }

    return new Response(JSON.stringify({ btc: btcData, eth: ethData }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, btc: null, eth: null }), {
      status: 200, // 에러여도 200 반환 — 위젯이 빈 상태로 표시되도록
      headers,
    });
  }
}
