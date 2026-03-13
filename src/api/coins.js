// CoinGecko API - 실시간 코인 데이터

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const COIN_IDS = [
  'bitcoin', 'ethereum', 'binancecoin', 'solana', 'ripple',
  'cardano', 'dogecoin', 'avalanche-2', 'shiba-inu', 'polkadot',
  'chainlink', 'uniswap', 'litecoin', 'near', 'aptos',
  'arbitrum', 'sui', 'optimism', 'pepe', 'stellar',
];

export async function fetchCoins(krwRate = 1335) {
  const ids = COIN_IDS.join(',');
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
  const data = await res.json();

  return data.map(coin => ({
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    priceUsd: coin.current_price,
    priceKrw: coin.current_price * krwRate,
    change24h: coin.price_change_percentage_24h ?? 0,
    volume24h: coin.total_volume,
    marketCap: coin.market_cap,
    high24h: coin.high_24h,
    low24h: coin.low_24h,
    sparkline: coin.sparkline_in_7d?.price?.slice(-20) ?? [],
    image: coin.image,
  }));
}

export async function fetchExchangeRate() {
  // Yahoo Finance KRW=X via allorigins proxy
  try {
    const symbol = 'KRW=X';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('proxy error');
    const json = await res.json();
    const parsed = JSON.parse(json.contents);
    const price = parsed?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price) return price;
  } catch {
    // fallback
  }
  return 1335; // 기본값
}
