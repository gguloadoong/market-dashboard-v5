import { DEFAULT_KRW_RATE } from '../constants/market';
import { fetchUpbitMarket, fetchUpbitTicker, fetchUpbitTickerAll } from './_gateway';
// 코인 실시간 데이터 — Upbit 전용
// 가격: Upbit(KRW, ticker/all 단일 요청) — 키 불필요
// 스파크라인: CoinGecko — 유일한 소스, 5분 간격
// 커버리지: 업비트 상장 전체

// ─── Upbit 전체 KRW 마켓 목록 (동적 캐시, 30분 TTL) ──────────
let upbitMarketCache   = null;
let upbitMarketCacheAt = 0;

export async function fetchUpbitAllSymbols() {
  const now = Date.now();
  if (upbitMarketCache && now - upbitMarketCacheAt < 30 * 60 * 1000) {
    return upbitMarketCache;
  }
  // #136: Upbit 직접 호출 → /api/d 게이트웨이 경유 (CORS 우회)
  const data = await fetchUpbitMarket(5000);
  if (!Array.isArray(data)) throw new Error('Upbit market list error');
  const symbols = data
    .filter(m => m.market.startsWith('KRW-'))
    .map(m => m.market.replace('KRW-', ''));
  upbitMarketCache   = symbols;
  upbitMarketCacheAt = now;
  return symbols;
}

// ─── Upbit 실시간 호가 — ticker/all 단일 요청 (#133) ──────────
// 기존: fetchUpbitAllSymbols() + 100개 청크 N회 → 신규: ticker/all 1회
export async function fetchUpbit() {
  const toMap = (data) => {
    const map = {};
    for (const d of data) {
      if (!d.market?.startsWith('KRW-')) continue;
      const sym = d.market.replace('KRW-', '');
      map[sym] = {
        priceKrw:     d.trade_price,
        change24h:    d.signed_change_rate * 100,
        volume24hKrw: d.acc_trade_price_24h,
        high24hKrw:   d.high_price,
        low24hKrw:    d.low_price,
        high52wKrw:   d.highest_52_week_price,
        low52wKrw:    d.lowest_52_week_price,
      };
    }
    return map;
  };

  // 1순위: ticker/all (전종목 1회) — #136 게이트웨이 경유
  try {
    const data = await fetchUpbitTickerAll(8000);
    if (Array.isArray(data) && data.length > 0) return toMap(data);
  } catch { /* fallback */ }

  // 2순위: 기존 청크 방식 (ticker/all 실패 시)
  const symbols = await fetchUpbitAllSymbols().catch(() => [
    'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','SHIB','DOT','LINK',
    'UNI','NEAR','APT','ARB','SUI','OP','PEPE','XLM','TON','ATOM',
    'FIL','ICP','HBAR','ETC','SAND','MANA','INJ','SEI','LTC','BNB',
  ]);
  const markets = symbols.map(s => `KRW-${s}`);
  const CHUNK = 100;
  const chunks = [];
  for (let i = 0; i < markets.length; i += CHUNK) {
    chunks.push(markets.slice(i, i + CHUNK));
  }
  // #136: 게이트웨이 경유
  const results = await Promise.all(
    chunks.map(chunk =>
      fetchUpbitTicker(chunk.join(','), 8000).catch(() => []),
    ),
  );
  return toMap(results.flat());
}


// ─── CoinGecko — 스파크라인 전용 (5분 간격) ────────────────────
const CG_API_KEY = import.meta.env.VITE_COINGECKO_API_KEY ?? '';
const CG_HEADERS = CG_API_KEY ? { 'x-cg-demo-api-key': CG_API_KEY } : {};

let cgSparklineCache = {};

export async function fetchCoinGecko() {
  const url = [
    'https://api.coingecko.com/api/v3/coins/markets',
    '?vs_currency=usd',
    '&order=market_cap_desc',
    '&per_page=250',
    '&page=1',
    '&sparkline=true',
    '&price_change_percentage=24h',
  ].join('');
  const res = await fetch(url, { headers: CG_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();

  // 스파크라인 캐시 (심볼 기준)
  for (const coin of data) {
    const sym = coin.symbol.toUpperCase();
    const sparkRaw = coin.sparkline_in_7d?.price ?? [];
    if (sparkRaw.length > 20) {
      cgSparklineCache[sym] = sparkRaw.filter((_, i) => i % Math.ceil(sparkRaw.length / 20) === 0).slice(0, 20);
    } else if (sparkRaw.length) {
      cgSparklineCache[sym] = sparkRaw;
    }
  }
  return data;
}

// 스파크라인 캐시 반환 (refreshSparklines에서 병합용)
export function getSparklineCache() {
  return cgSparklineCache;
}

// ─── 환율 ──────────────────────────────────────────────────────
const RATE_CACHE_KEY = 'market_krw_rate';
const RATE_FALLBACK  = DEFAULT_KRW_RATE;

function saveRateCache(rate) {
  try { localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() })); } catch {}
}
function loadRateCache() {
  try {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (!cached) return null;
    const { rate, ts } = JSON.parse(cached);
    if (Date.now() - ts < 24 * 60 * 60 * 1000) return rate;
  } catch {}
  return null;
}

export async function fetchExchangeRate() {
  // 1순위: Binance BTCUSDT + Upbit BTCKRW
  try {
    // #136: Upbit은 게이트웨이 경유, Binance는 CORS OK 유지
    const [upbitData, binanceRes] = await Promise.all([
      fetchUpbitTicker('KRW-BTC', 4000),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', { signal: AbortSignal.timeout(4000) }),
    ]);
    const binanceData = await binanceRes.json();
    const btcKrw = upbitData[0]?.trade_price;
    const btcUsd = parseFloat(binanceData?.price);
    if (btcKrw && btcUsd) {
      const rate = Math.round(btcKrw / btcUsd);
      saveRateCache(rate);
      return { rate, isFallback: false };
    }
  } catch {}

  // 2순위: Upbit + CoinGecko
  try {
    // #136: 게이트웨이 경유
    const data = await fetchUpbitTicker('KRW-BTC', 4000);
    const btcKrw = data[0]?.trade_price;
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { headers: CG_HEADERS, signal: AbortSignal.timeout(5000) });
    const cgData = await cgRes.json();
    const btcUsd = cgData?.bitcoin?.usd;
    if (btcKrw && btcUsd) {
      const rate = Math.round(btcKrw / btcUsd);
      saveRateCache(rate);
      return { rate, isFallback: false };
    }
  } catch {}

  // 캐시(24h)는 실제값 기반이므로 isFallback:false
  const cachedRate = loadRateCache();
  if (cachedRate) return { rate: cachedRate, isFallback: false };
  // 모든 실시간/캐시 실패 → 하드코딩 폴백 (#113 Codex P2: loaded 플래그용)
  return { rate: RATE_FALLBACK, isFallback: true };
}

// ─── Upbit만으로 빠른 가격 갱신 (10초 폴링용) ─────────────────
export async function fetchCoinsUpbitOnly(prevCoins = [], krwRate = DEFAULT_KRW_RATE) {
  const upbitMap = await fetchUpbit().catch(() => ({}));
  if (!Object.keys(upbitMap).length) return prevCoins;

  return prevCoins.map(coin => {
    const upbit = upbitMap[coin.symbol];
    if (!upbit) return coin;
    return {
      ...coin,
      priceKrw:    upbit.priceKrw,
      priceUsd:    upbit.priceKrw / krwRate,
      change24h:   upbit.change24h,
      volume24h:   upbit.volume24hKrw / krwRate,
      priceSource: 'upbit',
    };
  });
}
