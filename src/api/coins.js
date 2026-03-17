// 코인 실시간 데이터: Upbit(KRW) + CoinGecko(USD·시총·스파크라인)

// ─── 코인 마스터 목록 동적 로딩 ─────────────────────────────────
const COIN_LIST_CACHE_KEY = 'market_coin_symbols';
const COIN_LIST_CACHE_TTL = 60 * 60 * 1000; // 1시간

// localStorage에서 코인 목록 캐시 읽기
function loadCoinListCache() {
  try {
    const cached = localStorage.getItem(COIN_LIST_CACHE_KEY);
    if (!cached) return null;
    const { symbols, ts } = JSON.parse(cached);
    if (Date.now() - ts < COIN_LIST_CACHE_TTL) return symbols;
  } catch {}
  return null;
}

// 코인 목록 캐시 저장
function saveCoinListCache(symbols) {
  try {
    localStorage.setItem(COIN_LIST_CACHE_KEY, JSON.stringify({ symbols, ts: Date.now() }));
  } catch {}
}

/**
 * 업비트 + 빗썸 KRW 마켓 전체 코인 심볼 목록을 동적으로 가져온다.
 * - 1시간 캐시 (localStorage)
 * - 빗썸 CORS 실패 시 업비트만 사용
 * @returns {Promise<string[]>} 'KRW-BTC' 형식의 마켓 코드 배열
 */
export async function fetchAllCoinSymbols() {
  // 캐시 우선 반환
  const cached = loadCoinListCache();
  if (cached && cached.length > 0) return cached;

  // 업비트 KRW 마켓 전체 목록
  const fetchUpbitMarkets = async () => {
    const res = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Upbit market/all ${res.status}`);
    const data = await res.json();
    return data
      .filter(m => m.market.startsWith('KRW-'))
      .map(m => m.market);
  };

  // 빗썸 KRW 마켓 전체 목록 (CORS 실패 가능)
  const fetchBithumbMarkets = async () => {
    const res = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW', {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Bithumb ticker/ALL_KRW ${res.status}`);
    const json = await res.json();
    if (json.status !== '0000') throw new Error('Bithumb status != 0000');
    // 'data' 키 아래에 심볼이 key로 존재, 'date'는 제외
    return Object.keys(json.data)
      .filter(k => k !== 'date')
      .map(sym => `KRW-${sym}`);
  };

  let upbitMarkets = [];
  let bithumbMarkets = [];

  // 두 거래소 동시 요청
  const [upbitResult, bithumbResult] = await Promise.allSettled([
    fetchUpbitMarkets(),
    fetchBithumbMarkets(),
  ]);

  if (upbitResult.status === 'fulfilled') {
    upbitMarkets = upbitResult.value;
  }
  if (bithumbResult.status === 'fulfilled') {
    bithumbMarkets = bithumbResult.value;
  }

  // 업비트 실패 시 하드코딩 기본 목록 유지
  if (!upbitMarkets.length) {
    return UPBIT_MARKETS; // fallback: 기존 하드코딩 목록
  }

  // 두 목록 병합 (중복 제거): 업비트 우선, 빗썸 전용 코인 추가
  const merged = Array.from(new Set([...upbitMarkets, ...bithumbMarkets]));

  saveCoinListCache(merged);
  return merged;
}

/**
 * 동적 로딩된 심볼 목록을 바탕으로 Upbit 시세를 100개 단위 배치로 가져온다.
 * WebSocket 과부하 방지를 위해 REST 폴링 방식 사용.
 * @param {string[]} markets 'KRW-BTC' 형식 마켓 코드 배열
 * @returns {Promise<Object>} cgId → 시세 데이터 맵
 */
export async function fetchUpbitBatch(markets) {
  const BATCH_SIZE = 100; // 업비트 단일 요청 최대 100개
  const results = {};

  // 100개 단위로 나눠서 순차 요청
  for (let i = 0; i < markets.length; i += BATCH_SIZE) {
    const batch = markets.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(
        `https://api.upbit.com/v1/ticker?markets=${batch.join(',')}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const d of data) {
        const sym  = d.market.replace('KRW-', '');
        const cgId = UPBIT_TO_CG[sym] ?? sym.toLowerCase(); // 매핑 없으면 소문자 심볼
        results[cgId] = {
          symbol:       sym,
          market:       d.market,
          priceKrw:     d.trade_price,
          change24h:    d.signed_change_rate * 100,
          volume24hKrw: d.acc_trade_price_24h,
          high24hKrw:   d.high_price,
          low24hKrw:    d.low_price,
          high52wKrw:   d.highest_52_week_price,
          low52wKrw:    d.lowest_52_week_price,
        };
      }
    } catch {
      // 배치 실패 시 해당 배치 skip, 다음 배치 계속
    }
  }
  return results;
}

// 업비트에 상장된 코인 마켓 목록 (기본값, fetchAllCoinSymbols()로 동적 갱신)
const UPBIT_MARKETS = [
  'KRW-BTC','KRW-ETH','KRW-SOL','KRW-XRP','KRW-ADA','KRW-DOGE',
  'KRW-AVAX','KRW-SHIB','KRW-DOT','KRW-LINK','KRW-UNI','KRW-NEAR',
  'KRW-APT','KRW-ARB','KRW-SUI','KRW-OP','KRW-PEPE','KRW-XLM',
  // 추가 코인 (업비트 상장)
  'KRW-TON','KRW-ATOM','KRW-FIL','KRW-ICP','KRW-HBAR',
  'KRW-ETC','KRW-SAND','KRW-MANA','KRW-INJ','KRW-SEI',
  // LTC, BNB 실시간 연결 추가 (업비트 상장)
  'KRW-LTC','KRW-BNB',
];

// Upbit 심볼 → CoinGecko ID 매핑
const UPBIT_TO_CG = {
  'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','XRP':'ripple',
  'ADA':'cardano','DOGE':'dogecoin','AVAX':'avalanche-2','SHIB':'shiba-inu',
  'DOT':'polkadot','LINK':'chainlink','UNI':'uniswap','NEAR':'near',
  'APT':'aptos','ARB':'arbitrum','SUI':'sui','OP':'optimism',
  'PEPE':'pepe','XLM':'stellar',
  // 추가 코인
  'TON':'the-open-network','ATOM':'cosmos','FIL':'filecoin',
  'ICP':'internet-computer','HBAR':'hedera-hashgraph','ETC':'ethereum-classic',
  'SAND':'the-sandbox','MANA':'decentraland','INJ':'injective-protocol','SEI':'sei-network',
  // 업비트 상장 (LTC, BNB 실시간 연결 추가)
  'LTC':'litecoin','BNB':'binancecoin',
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

// ─── CoinGecko (USD + 시총 + 스파크라인) — 60초 간격 권장 ────
export async function fetchCoinGecko() {
  const ids = CG_IDS.join(',');
  // x_cg_demo_api_key 없이도 동작하는 공개 엔드포인트 (rate: ~30req/min)
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json();
}

// CoinGecko 캐시 — 마지막 성공한 데이터 보존
let cgCache = [];

// ─── 환율: Binance(1순위) → Upbit+CoinGecko(2순위) → localStorage 캐시(3순위) → 하드코딩(최후) ─
const RATE_CACHE_KEY = 'market_krw_rate';
const RATE_FALLBACK  = 1466;

// 환율을 localStorage에 저장 (성공 시 호출)
function saveRateCache(rate) {
  try {
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }));
  } catch {}
}

// localStorage에서 24시간 내 캐시된 환율 읽기
function loadRateCache() {
  try {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (!cached) return null;
    const { rate, ts } = JSON.parse(cached);
    if (Date.now() - ts < 24 * 60 * 60 * 1000) return rate; // 24시간 이내
  } catch {}
  return null;
}

export async function fetchExchangeRate() {
  // 1순위: Binance BTCUSDT + Upbit BTCKRW
  try {
    const [upbitRes, binanceRes] = await Promise.all([
      fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC', { signal: AbortSignal.timeout(4000) }),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', { signal: AbortSignal.timeout(4000) }),
    ]);
    const [upbitData, binanceData] = await Promise.all([upbitRes.json(), binanceRes.json()]);
    const btcKrw = upbitData[0]?.trade_price;
    const btcUsd = parseFloat(binanceData?.price);
    if (btcKrw && btcUsd) {
      const rate = Math.round(btcKrw / btcUsd);
      saveRateCache(rate); // 성공 시 localStorage에 저장
      return rate;
    }
  } catch {}

  // 2순위: Upbit + CoinGecko (기존 방식)
  try {
    const res = await fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC', { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const btcKrw = data[0]?.trade_price;
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
    const cgData = await cgRes.json();
    const btcUsd = cgData?.bitcoin?.usd;
    if (btcKrw && btcUsd) {
      const rate = Math.round(btcKrw / btcUsd);
      saveRateCache(rate); // 성공 시 localStorage에 저장
      return rate;
    }
  } catch {}

  // 3순위: localStorage 캐시 (24시간 이내 저장값) — 실제 환율과 크게 차이 안 남
  const cachedRate = loadRateCache();
  if (cachedRate) return cachedRate;

  // 최후 fallback: 하드코딩 기본값
  return RATE_FALLBACK;
}

// ─── Upbit만으로 빠른 가격 갱신 (10초 폴링용) ─────────────────
export async function fetchCoinsUpbitOnly(prevCoins = [], krwRate = 1466) {
  const upbitMap = await fetchUpbit().catch(() => ({}));
  if (!Object.keys(upbitMap).length) return prevCoins;

  return prevCoins.map(coin => {
    const upbit = upbitMap[coin.id];
    if (!upbit) return coin; // Upbit 미상장 코인은 기존 데이터(coingecko) 유지
    return {
      ...coin,
      priceKrw:    upbit.priceKrw,
      priceUsd:    upbit.priceKrw / krwRate,
      change24h:   upbit.change24h,
      volume24h:   upbit.volume24hKrw / krwRate,
      priceSource: 'upbit', // 10초 폴링은 항상 Upbit 소스
    };
  });
}

// ─── 통합 코인 데이터 (CoinGecko 포함 — 60초 폴링용) ──────────
export async function fetchCoins(krwRate = 1466) {
  const [upbitMap, cgListRaw] = await Promise.all([
    fetchUpbit().catch(() => ({})),
    fetchCoinGecko().catch(() => null),
  ]);

  // CoinGecko 실패 시 캐시 사용
  const cgList = cgListRaw ?? cgCache;
  if (!cgList.length) throw new Error('CoinGecko 실패 (캐시 없음)');
  if (cgListRaw) cgCache = cgListRaw; // 성공하면 캐시 갱신

  return cgList.map(coin => {
    const upbit = upbitMap[coin.id] ?? {};
    const priceKrw = upbit.priceKrw ?? coin.current_price * krwRate;
    const priceUsd = coin.current_price;
    const change24h = upbit.change24h ?? coin.price_change_percentage_24h ?? 0;
    const sparkRaw  = coin.sparkline_in_7d?.price ?? [];
    const sparkline = sparkRaw.length > 20
      ? sparkRaw.filter((_, i) => i % Math.ceil(sparkRaw.length / 20) === 0).slice(0, 20)
      : sparkRaw;

    // 가격 소스: Upbit 우선, 없으면 CoinGecko fallback
    const hasUpbit = !!upbit.priceKrw;

    return {
      id:       coin.id,
      symbol:   coin.symbol.toUpperCase(),
      name:     coin.name,
      priceUsd,
      priceKrw,
      change24h,
      volume24h: (upbit.volume24hKrw ?? 0) / krwRate || coin.total_volume,
      // CoinGecko 전용: 시총·도미넌스 계산에 사용
      marketCap: coin.market_cap,
      high24h: upbit.high24hKrw ? upbit.high24hKrw / krwRate : coin.high_24h,
      low24h:  upbit.low24hKrw  ? upbit.low24hKrw  / krwRate : coin.low_24h,
      high52w: upbit.high52wKrw ? upbit.high52wKrw / krwRate : null,
      low52w:  upbit.low52wKrw  ? upbit.low52wKrw  / krwRate : null,
      // CoinGecko 전용: 스파크라인 7일치
      sparkline,
      image: coin.image,
      // 가격 기준 명시: 프론트에서 출처 배지 표시 가능
      priceSource: hasUpbit ? 'upbit' : 'coingecko',
    };
  });
}
