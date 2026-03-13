// 코인 실시간 데이터: Upbit(KRW) + CoinGecko(USD·시총·스파크라인)

// 업비트에 상장된 코인 마켓 목록
const UPBIT_MARKETS = [
  'KRW-BTC','KRW-ETH','KRW-SOL','KRW-XRP','KRW-ADA','KRW-DOGE',
  'KRW-AVAX','KRW-SHIB','KRW-DOT','KRW-LINK','KRW-UNI','KRW-NEAR',
  'KRW-APT','KRW-ARB','KRW-SUI','KRW-OP','KRW-PEPE','KRW-XLM',
];

// Upbit 심볼 → CoinGecko ID 매핑
const UPBIT_TO_CG = {
  'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','XRP':'ripple',
  'ADA':'cardano','DOGE':'dogecoin','AVAX':'avalanche-2','SHIB':'shiba-inu',
  'DOT':'polkadot','LINK':'chainlink','UNI':'uniswap','NEAR':'near',
  'APT':'aptos','ARB':'arbitrum','SUI':'sui','OP':'optimism',
  'PEPE':'pepe','XLM':'stellar',
  // CoinGecko-only (업비트 미상장)
  'BNB':'binancecoin','LTC':'litecoin',
};

// CoinGecko ID → Upbit 심볼
const CG_TO_UPBIT = Object.fromEntries(
  Object.entries(UPBIT_TO_CG).map(([u, cg]) => [cg, u])
);

const CG_IDS = Object.values(UPBIT_TO_CG).filter((v, i, a) => a.indexOf(v) === i);

// ─── Upbit 실시간 호가 ─────────────────────────────────────────
export async function fetchUpbit() {
  const res = await fetch(
    `https://api.upbit.com/v1/ticker?markets=${UPBIT_MARKETS.join(',')}`
  );
  if (!res.ok) throw new Error('Upbit API error');
  const data = await res.json();

  const map = {};
  for (const d of data) {
    const sym  = d.market.replace('KRW-', '');
    const cgId = UPBIT_TO_CG[sym];
    if (cgId) {
      map[cgId] = {
        priceKrw:  d.trade_price,
        change24h: d.signed_change_rate * 100,
        volume24hKrw: d.acc_trade_price_24h,
        high24hKrw:   d.high_price,
        low24hKrw:    d.low_price,
        high52wKrw:   d.highest_52_week_price,
        low52wKrw:    d.lowest_52_week_price,
      };
    }
  }
  return map;
}

// ─── CoinGecko (USD + 시총 + 스파크라인) ──────────────────────
export async function fetchCoinGecko() {
  const ids = CG_IDS.join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json();
}

// ─── 환율 (Upbit BTC로 역산) ──────────────────────────────────
export async function fetchExchangeRate() {
  try {
    const res = await fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC');
    const data = await res.json();
    const btcKrw = data[0]?.trade_price;

    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const cgData = await cgRes.json();
    const btcUsd = cgData?.bitcoin?.usd;

    if (btcKrw && btcUsd) return Math.round(btcKrw / btcUsd);
  } catch {}
  return 1466; // 폴백
}

// ─── 통합 코인 데이터 ──────────────────────────────────────────
export async function fetchCoins(krwRate = 1466) {
  const [upbitMap, cgList] = await Promise.all([
    fetchUpbit().catch(() => ({})),
    fetchCoinGecko().catch(() => []),
  ]);

  if (!cgList.length) throw new Error('CoinGecko 실패');

  return cgList.map(coin => {
    const upbit = upbitMap[coin.id] ?? {};
    const priceKrw = upbit.priceKrw ?? coin.current_price * krwRate;
    const priceUsd = coin.current_price;
    const change24h = upbit.change24h ?? coin.price_change_percentage_24h ?? 0;
    const sparkRaw  = coin.sparkline_in_7d?.price ?? [];
    const sparkline = sparkRaw.length > 20
      ? sparkRaw.filter((_, i) => i % Math.ceil(sparkRaw.length / 20) === 0).slice(0, 20)
      : sparkRaw;

    return {
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      priceUsd,
      priceKrw,
      change24h,
      volume24h: (upbit.volume24hKrw ?? 0) / krwRate || coin.total_volume,
      marketCap: coin.market_cap,
      high24h: upbit.high24hKrw ? upbit.high24hKrw / krwRate : coin.high_24h,
      low24h:  upbit.low24hKrw  ? upbit.low24hKrw  / krwRate : coin.low_24h,
      high52w: upbit.high52wKrw ? upbit.high52wKrw / krwRate : null,
      low52w:  upbit.low52wKrw  ? upbit.low52wKrw  / krwRate : null,
      sparkline,
      image: coin.image,
    };
  });
}
