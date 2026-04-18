import { DEFAULT_KRW_RATE } from '../constants/market';
import { fetchUpbitMarket, fetchUpbitTicker, fetchUpbitTickerAll } from './_gateway';
// 코인 실시간 데이터 — 다중 소스 최적화
// 가격: Upbit(KRW, ticker/all 단일 요청) + Binance(USD) — 키 불필요
// 메타/이미지: CoinPaprika 1순위 → CoinGecko fallback (클라이언트 rate limit 보호)
// 스파크라인: CoinGecko — 유일한 소스, 5분 간격
// 커버리지: 시총 상위 250개 + 업비트 상장 전체
import { getCoinSector } from '../data/coinSectors';

// ─── 주요 코인 한국어명 매핑 (CoinPaprika 영문명 → 한국어) ──────
// Upbit korean_name 기준, 사용자가 익숙한 한국어명으로 표시
const COIN_KO_NAME = {
  BTC: '비트코인', ETH: '이더리움', XRP: '리플', SOL: '솔라나',
  ADA: '에이다', DOGE: '도지코인', BNB: 'BNB', AVAX: '아발란체',
  DOT: '폴카닷', LINK: '체인링크', PEPE: '페페', SUI: '수이',
  APT: '앱토스', NEAR: '니어', ATOM: '코스모스', TON: '톤코인',
  UNI: '유니스왑', OP: '옵티미즘', ARB: '아비트럼', INJ: '인젝티브',
  SHIB: '시바이누', XLM: '스텔라루멘', FIL: '파일코인', ICP: '인터넷컴퓨터',
  HBAR: '헤데라', ETC: '이더리움클래식', SAND: '샌드박스', MANA: '디센트럴랜드',
  SEI: '세이', LTC: '라이트코인', TRX: '트론', BCH: '비트코인캐시',
  AAVE: '에이브', MKR: '메이커', RENDER: '렌더', FET: '페치AI',
  TAO: '비텐서', WLD: '월드코인', JUP: '주피터', ONDO: '온도',
  PENDLE: '펜들', STX: '스택스', TIA: '셀레스티아', PYTH: '피스',
  BONK: '봉크', WIF: '위프', FLOKI: '플로키', GALA: '갈라',
  IMX: '이뮤터블X', EOS: '이오스', MATIC: '폴리곤',
};

/** CoinPaprika 영문명 → 한국어명 변환 (매핑 없으면 원본 반환) */
function getCoinKoName(symbol, englishName) {
  return COIN_KO_NAME[symbol] || englishName;
}

// 필터링 대상: 가격 변동이 없거나 원본 자산의 래핑본인 토큰
const EXCLUDED_SYMBOLS = new Set([
  'USDT','USDC','DAI','BUSD','TUSD','PYUSD','USDS','USDE','FDUSD','FRAX',
  'LUSD','USDP','GUSD','SUSD','ALUSD','CRVUSD','GHO','CUSD','EURI','USDD',
  'WBTC','WETH','STETH','WSTETH','CBETH','RETH','WEETH','EZETH','RSETH',
]);

// ─── localStorage 캐시 유틸 ─────────────────────────────────
const META_CACHE_KEY = 'coin_meta_cache';
const META_CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간

function saveMetaCache(coins) {
  try {
    const slim = coins.map(c => ({ id: c.id, symbol: c.symbol, name: c.name, image: c.image, marketCap: c.marketCap }));
    localStorage.setItem(META_CACHE_KEY, JSON.stringify({ data: slim, ts: Date.now() }));
  } catch {}
}

function loadMetaCache() {
  try {
    const raw = localStorage.getItem(META_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < META_CACHE_TTL && data?.length) return data;
  } catch {}
  return null;
}

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

// ─── CoinPaprika — 코인 목록 + USD 가격 + 시총 (키 불필요) ──────
// rate limit 관대 (~10 req/s), 이미지 URL 패턴: static.coinpaprika.com/coin/{id}/logo.png
export async function fetchCoinPaprika() {
  const res = await fetch(
    'https://api.coinpaprika.com/v1/tickers?limit=250',
    { signal: AbortSignal.timeout(12000) }
  );
  if (!res.ok) throw new Error(`CoinPaprika ${res.status}`);
  return await res.json();
}

// ─── Binance — USDT 페어 24h 가격 (키 불필요) ──────────────────
// 주요 코인만 명시적으로 요청 (전체 1500+ 쌍 → 상위 코인만)
const BINANCE_SYMBOLS = [
  'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','SHIB','DOT','LINK',
  'UNI','NEAR','APT','ARB','SUI','OP','PEPE','XLM','TON','ATOM',
  'FIL','ICP','HBAR','ETC','SAND','MANA','INJ','SEI','LTC','BNB',
  'MATIC','TRX','BCH','AAVE','MKR','RENDER','FET','TAO','WLD','JUP',
  'ONDO','PENDLE','STX','TIA','PYTH','BONK','WIF','FLOKI','GALA','IMX',
];

export async function fetchBinancePrices() {
  // 개별 심볼로 요청 (전체 ticker 대신 ~50개만)
  const symbols = BINANCE_SYMBOLS.map(s => `"${s}USDT"`).join(',');
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const data = await res.json();

  const map = {};
  for (const t of data) {
    if (!t.symbol.endsWith('USDT')) continue;
    const sym = t.symbol.replace('USDT', '');
    map[sym] = {
      priceUsd: parseFloat(t.lastPrice),
      change24h: parseFloat(t.priceChangePercent),
      volume24hUsd: parseFloat(t.quoteVolume),
    };
  }
  return map;
}

// ─── CoinGecko — 스파크라인 전용 (5분 간격) ────────────────────
const CG_API_KEY = import.meta.env.VITE_COINGECKO_API_KEY ?? '';
const CG_HEADERS = CG_API_KEY ? { 'x-cg-demo-api-key': CG_API_KEY } : {};

let cgSparklineCache = {};
let cgFullCache = [];

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
  cgFullCache = data;

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

// 스파크라인만 반환 (이전 fetchCoins 결과에 병합용)
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

// ─── 통합 코인 데이터 (다중 소스 병합) ─────────────────────────
// #132: 클라이언트는 CoinPaprika 우선 유지 (CoinGecko rate limit 보호)
// 서버(Worker)에서 CoinGecko 우선 → Redis snapshot에 메타 반영
// 1순위: CoinPaprika (코인 목록 + USD 가격 + 시총)
// 2순위: CoinGecko (fallback + 스파크라인)
// + Upbit (KRW 가격 덮어쓰기 — 업비트 상장 코인은 항상 우선)
// + Binance (USD 가격 보강)
export async function fetchCoins(krwRate = DEFAULT_KRW_RATE) {
  // 3개 소스 병렬 호출 (CoinGecko는 스파크라인 전용, 별도 경로)
  const [upbitMap, paprikaRaw, binanceMap] = await Promise.all([
    fetchUpbit().catch(() => ({})),
    fetchCoinPaprika().catch(() => null),
    fetchBinancePrices().catch(() => ({})),
  ]);

  // 1순위: CoinPaprika
  if (paprikaRaw?.length) {
    const coins = buildFromPaprika(paprikaRaw, upbitMap, binanceMap, krwRate);
    if (coins.length) {
      saveMetaCache(coins);
      return coins;
    }
  }

  // 2순위: CoinGecko fallback (CoinPaprika 402 시 여기로)
  const cgList = cgFullCache?.length ? cgFullCache : await fetchCoinGecko().catch(() => null);
  if (cgList?.length) {
    const coins = buildFromCoinGecko(cgList, upbitMap, krwRate);
    if (coins.length) {
      saveMetaCache(coins);
      return coins;
    }
  }

  // 모두 실패 → localStorage 메타 캐시 + Upbit/Binance 가격
  const metaCache = loadMetaCache();
  if (metaCache?.length) {
    return metaCache.map(c => {
      const sym = c.symbol;
      const upbit = upbitMap[sym] ?? {};
      const binance = binanceMap[sym] ?? {};
      const priceKrw = upbit.priceKrw ?? (binance.priceUsd ?? 0) * krwRate;
      return {
        ...c,
        priceUsd:    binance.priceUsd ?? priceKrw / krwRate,
        priceKrw,
        change24h:   upbit.change24h ?? binance.change24h ?? 0,
        volume24h:   (upbit.volume24hKrw ?? 0) / krwRate || (binance.volume24hUsd ?? 0),
        sparkline:   cgSparklineCache[sym] ?? [],
        sector:      getCoinSector(sym),
        market:      'coin',
        priceSource: upbit.priceKrw ? 'upbit' : binance.priceUsd ? 'binance' : 'cache',
      };
    });
  }

  throw new Error('모든 코인 소스 실패');
}

// ─── CoinPaprika 데이터로 코인 리스트 빌드 ─────────────────────
function buildFromPaprika(paprikaList, upbitMap, binanceMap, krwRate) {
  return paprikaList
    .filter(c => c.rank > 0 && !EXCLUDED_SYMBOLS.has(c.symbol))
    .map(coin => {
      const sym = coin.symbol;
      const usd = coin.quotes?.USD ?? {};
      const upbit = upbitMap[sym] ?? {};
      const binance = binanceMap[sym] ?? {};

      // USD 가격: CoinPaprika → Binance
      const priceUsd = usd.price || binance.priceUsd || 0;
      const priceKrw = upbit.priceKrw ?? priceUsd * krwRate;
      const change24h = upbit.change24h ?? usd.percent_change_24h ?? binance.change24h ?? 0;
      const hasUpbit = !!upbit.priceKrw;

      return {
        id:        coin.id,
        symbol:    sym,
        name:      getCoinKoName(sym, coin.name),
        nameEn:    coin.name,
        priceUsd,
        priceKrw,
        change24h,
        volume24h: (upbit.volume24hKrw ?? 0) / krwRate || usd.volume_24h || binance.volume24hUsd || 0,
        marketCap: usd.market_cap || 0,
        high24h:   upbit.high24hKrw ? upbit.high24hKrw / krwRate : null,
        low24h:    upbit.low24hKrw  ? upbit.low24hKrw  / krwRate : null,
        high52w:   upbit.high52wKrw ? upbit.high52wKrw / krwRate : null,
        low52w:    upbit.low52wKrw  ? upbit.low52wKrw  / krwRate : null,
        sparkline: cgSparklineCache[sym] ?? [],
        // CoinPaprika 이미지 패턴
        image:     `https://static.coinpaprika.com/coin/${coin.id}/logo.png`,
        sector:    getCoinSector(sym),
        market:    'coin',
        priceSource: hasUpbit ? 'upbit' : 'paprika',
      };
    });
}

// ─── CoinGecko 데이터로 코인 리스트 빌드 (fallback) ─────────────
function buildFromCoinGecko(cgList, upbitMap, krwRate) {
  return cgList
    .filter(coin => !EXCLUDED_SYMBOLS.has(coin.symbol.toUpperCase()))
    .map(coin => {
      const sym = coin.symbol.toUpperCase();
      const upbit = upbitMap[sym] ?? {};
      const priceKrw = upbit.priceKrw ?? coin.current_price * krwRate;
      const priceUsd = coin.current_price;
      const change24h = upbit.change24h ?? coin.price_change_percentage_24h ?? 0;
      const sparkRaw = coin.sparkline_in_7d?.price ?? [];
      const sparkline = sparkRaw.length > 20
        ? sparkRaw.filter((_, i) => i % Math.ceil(sparkRaw.length / 20) === 0).slice(0, 20)
        : sparkRaw;
      const hasUpbit = !!upbit.priceKrw;

      // 스파크라인 캐시 업데이트
      if (sparkline.length) cgSparklineCache[sym] = sparkline;

      return {
        id:        coin.id,
        symbol:    sym,
        name:      getCoinKoName(sym, coin.name),
        nameEn:    coin.name,
        priceUsd,
        priceKrw,
        change24h,
        volume24h: (upbit.volume24hKrw ?? 0) / krwRate || coin.total_volume,
        marketCap: coin.market_cap,
        high24h:   upbit.high24hKrw ? upbit.high24hKrw / krwRate : coin.high_24h,
        low24h:    upbit.low24hKrw  ? upbit.low24hKrw  / krwRate : coin.low_24h,
        high52w:   upbit.high52wKrw ? upbit.high52wKrw / krwRate : null,
        low52w:    upbit.low52wKrw  ? upbit.low52wKrw  / krwRate : null,
        sparkline,
        image:     coin.image,
        sector:    getCoinSector(sym),
        market:    'coin',
        priceSource: hasUpbit ? 'upbit' : 'coingecko',
      };
    });
}
