// 초기값 — 앱 로드 즉시 실제 API로 덮어씌워짐
// 코인: Upbit 2026-03-13 기준 실제가

function genSparkline(base, count = 20, vol = 0.015) {
  let cur = base;
  return Array.from({ length: count }, () => {
    cur *= 1 + (Math.random() - 0.5) * vol * 2;
    return parseFloat(cur.toFixed(cur > 100 ? 0 : cur > 1 ? 2 : 6));
  });
}

// ─── 국내 주식 (Yahoo Finance .KS로 실시간 갱신됨) ─────────────
export const KOREAN_STOCKS = [
  { symbol:'005930', name:'삼성전자',        market:'kr', sector:'반도체',   price:57900,  change:-200,  changePct:-0.34, volume:11000000, marketCap:345e12, high52w:88800,   low52w:49900  },
  { symbol:'000660', name:'SK하이닉스',      market:'kr', sector:'반도체',   price:187500, change:2500,  changePct:1.35,  volume:3100000,  marketCap:136e12, high52w:238500,  low52w:143000 },
  { symbol:'035420', name:'NAVER',           market:'kr', sector:'IT',       price:233500, change:1500,  changePct:0.65,  volume:750000,   marketCap:38e12,  high52w:248500,  low52w:155000 },
  { symbol:'035720', name:'카카오',          market:'kr', sector:'IT',       price:44150,  change:-350,  changePct:-0.79, volume:2000000,  marketCap:19e12,  high52w:58800,   low52w:33150  },
  { symbol:'051910', name:'LG화학',          market:'kr', sector:'화학',     price:255500, change:3000,  changePct:1.19,  volume:400000,   marketCap:18e12,  high52w:385000,  low52w:228000 },
  { symbol:'006400', name:'삼성SDI',         market:'kr', sector:'배터리',   price:168500, change:-1500, changePct:-0.88, volume:280000,   marketCap:23e12,  high52w:275000,  low52w:145500 },
  { symbol:'207940', name:'삼성바이오로직스', market:'kr', sector:'바이오',   price:840000, change:5000,  changePct:0.60,  volume:78000,    marketCap:58e12,  high52w:1050000, low52w:700000 },
  { symbol:'068270', name:'셀트리온',        market:'kr', sector:'바이오',   price:165500, change:2000,  changePct:1.22,  volume:500000,   marketCap:19e12,  high52w:220000,  low52w:140000 },
  { symbol:'005380', name:'현대차',          market:'kr', sector:'자동차',   price:208500, change:-1000, changePct:-0.48, volume:580000,   marketCap:44e12,  high52w:285000,  low52w:185000 },
  { symbol:'000270', name:'기아',            market:'kr', sector:'자동차',   price:94200,  change:1200,  changePct:1.29,  volume:1150000,  marketCap:37e12,  high52w:118000,  low52w:73800  },
  { symbol:'105560', name:'KB금융',          market:'kr', sector:'금융',     price:97500,  change:800,   changePct:0.83,  volume:750000,   marketCap:38e12,  high52w:105000,  low52w:72000  },
  { symbol:'055550', name:'신한지주',        market:'kr', sector:'금융',     price:57300,  change:300,   changePct:0.53,  volume:950000,   marketCap:27e12,  high52w:61500,   low52w:42000  },
  { symbol:'086790', name:'하나금융지주',    market:'kr', sector:'금융',     price:68200,  change:700,   changePct:1.04,  volume:680000,   marketCap:20e12,  high52w:74000,   low52w:52000  },
  { symbol:'316140', name:'우리금융지주',    market:'kr', sector:'금융',     price:16750,  change:150,   changePct:0.90,  volume:2500000,  marketCap:13e12,  high52w:18500,   low52w:13200  },
  { symbol:'032830', name:'삼성생명',        market:'kr', sector:'보험',     price:105000, change:-500,  changePct:-0.47, volume:250000,   marketCap:21e12,  high52w:122000,  low52w:78000  },
  { symbol:'018260', name:'삼성에스디에스',  market:'kr', sector:'IT서비스', price:162000, change:1000,  changePct:0.62,  volume:160000,   marketCap:13e12,  high52w:175000,  low52w:125000 },
  { symbol:'034730', name:'SK',             market:'kr', sector:'지주',     price:168000, change:-2000, changePct:-1.18, volume:110000,   marketCap:12e12,  high52w:195000,  low52w:145000 },
  { symbol:'017670', name:'SK텔레콤',       market:'kr', sector:'통신',     price:57500,  change:300,   changePct:0.52,  volume:420000,   marketCap:24e12,  high52w:61000,   low52w:47000  },
  { symbol:'030200', name:'KT',             market:'kr', sector:'통신',     price:45800,  change:350,   changePct:0.77,  volume:800000,   marketCap:12e12,  high52w:49000,   low52w:35000  },
  { symbol:'003550', name:'LG',             market:'kr', sector:'지주',     price:79500,  change:-500,  changePct:-0.63, volume:190000,   marketCap:14e12,  high52w:108000,  low52w:72000  },
  { symbol:'066570', name:'LG전자',         market:'kr', sector:'가전',     price:89600,  change:1400,  changePct:1.59,  volume:640000,   marketCap:15e12,  high52w:115000,  low52w:71400  },
  { symbol:'009150', name:'삼성전기',       market:'kr', sector:'부품',     price:118000, change:-1000, changePct:-0.84, volume:260000,   marketCap:9e12,   high52w:155000,  low52w:100000 },
  { symbol:'000100', name:'유한양행',       market:'kr', sector:'제약',     price:96200,  change:2200,  changePct:2.34,  volume:350000,   marketCap:7e12,   high52w:115000,  low52w:68000  },
  { symbol:'128940', name:'한미약품',       market:'kr', sector:'제약',     price:285000, change:-5000, changePct:-1.72, volume:78000,    marketCap:3.8e12, high52w:380000,  low52w:250000 },
  { symbol:'011200', name:'HMM',            market:'kr', sector:'해운',     price:14850,  change:350,   changePct:2.41,  volume:3200000,  marketCap:11e12,  high52w:22000,   low52w:11500  },
  { symbol:'010130', name:'고려아연',       market:'kr', sector:'금속',     price:780000, change:10000, changePct:1.30,  volume:42000,    marketCap:16e12,  high52w:890000,  low52w:600000 },
  { symbol:'047810', name:'한국항공우주',   market:'kr', sector:'방산',     price:68500,  change:1500,  changePct:2.24,  volume:580000,   marketCap:7e12,   high52w:80000,   low52w:48000  },
  { symbol:'009830', name:'한화솔루션',     market:'kr', sector:'에너지',   price:22050,  change:-250,  changePct:-1.12, volume:1600000,  marketCap:3.5e12, high52w:35000,   low52w:17800  },
  { symbol:'096770', name:'SK이노베이션',   market:'kr', sector:'에너지',   price:97500,  change:1500,  changePct:1.56,  volume:530000,   marketCap:9e12,   high52w:130000,  low52w:78000  },
  { symbol:'015760', name:'한국전력',       market:'kr', sector:'유틸리티', price:25200,  change:200,   changePct:0.80,  volume:1900000,  marketCap:16e12,  high52w:29800,   low52w:20500  },
].map(s => ({ ...s, sparkline: genSparkline(s.price, 20, 0.012) }));

// ─── 미국 주식 (Yahoo Finance로 실시간 갱신) ─────────────────
export const US_STOCKS_INITIAL = [
  { symbol:'AAPL',  name:'Apple',      market:'us', sector:'Technology',    price:222.13, change:3.21,  changePct:1.47,  volume:52000000,  marketCap:3.33e12, high52w:260.10,  low52w:164.08 },
  { symbol:'MSFT',  name:'Microsoft',  market:'us', sector:'Technology',    price:398.82, change:-2.15, changePct:-0.54, volume:18000000,  marketCap:2.97e12, high52w:468.35,  low52w:344.79 },
  { symbol:'GOOGL', name:'Alphabet',   market:'us', sector:'Technology',    price:169.74, change:1.82,  changePct:1.08,  volume:22000000,  marketCap:2.08e12, high52w:208.70,  low52w:140.53 },
  { symbol:'AMZN',  name:'Amazon',     market:'us', sector:'Consumer',      price:199.88, change:-1.23, changePct:-0.61, volume:31000000,  marketCap:2.14e12, high52w:242.52,  low52w:151.61 },
  { symbol:'NVDA',  name:'NVIDIA',     market:'us', sector:'Semiconductor', price:117.93, change:4.52,  changePct:3.99,  volume:280000000, marketCap:2.87e12, high52w:153.13,  low52w:66.25  },
  { symbol:'META',  name:'Meta',       market:'us', sector:'Technology',    price:607.11, change:8.45,  changePct:1.41,  volume:14000000,  marketCap:1.53e12, high52w:740.91,  low52w:414.50 },
  { symbol:'TSLA',  name:'Tesla',      market:'us', sector:'EV',            price:275.35, change:-8.45, changePct:-2.98, volume:95000000,  marketCap:0.88e12, high52w:488.54,  low52w:138.80 },
  { symbol:'AVGO',  name:'Broadcom',   market:'us', sector:'Semiconductor', price:197.82, change:2.10,  changePct:1.07,  volume:25000000,  marketCap:0.93e12, high52w:251.88,  low52w:120.39 },
  { symbol:'JPM',   name:'JPMorgan',   market:'us', sector:'Finance',       price:249.88, change:2.15,  changePct:0.87,  volume:9000000,   marketCap:0.72e12, high52w:280.25,  low52w:185.04 },
  { symbol:'BRK-B', name:'Berkshire',  market:'us', sector:'Finance',       price:522.14, change:-1.52, changePct:-0.29, volume:3500000,   marketCap:1.14e12, high52w:545.19,  low52w:358.09 },
].map(s => ({ ...s, sparkline: genSparkline(s.price, 20, 0.015) }));

// ─── 코인 초기값 (Upbit 2026-03-13 실제가, CoinGecko로 즉시 갱신됨) ─
const KRW_RATE = 1466;
export const COINS_INITIAL = [
  { id:'bitcoin',     symbol:'BTC',  name:'Bitcoin',      priceKrw:105943000, priceUsd:105943000/KRW_RATE, change24h:2.61,  volume24h:209e9/KRW_RATE, marketCap:1.43e12 },
  { id:'ethereum',    symbol:'ETH',  name:'Ethereum',     priceKrw:3112000,   priceUsd:3112000/KRW_RATE,   change24h:2.60,  volume24h:15e9,           marketCap:374e9   },
  { id:'solana',      symbol:'SOL',  name:'Solana',       priceKrw:132000,    priceUsd:132000/KRW_RATE,    change24h:3.94,  volume24h:4.5e9,          marketCap:45e9    },
  { id:'ripple',      symbol:'XRP',  name:'XRP',          priceKrw:2090,      priceUsd:2090/KRW_RATE,      change24h:3.21,  volume24h:3e9,            marketCap:130e9   },
  { id:'cardano',     symbol:'ADA',  name:'Cardano',      priceKrw:402,       priceUsd:402/KRW_RATE,       change24h:4.15,  volume24h:0.5e9,          marketCap:14e9    },
  { id:'dogecoin',    symbol:'DOGE', name:'Dogecoin',     priceKrw:145,       priceUsd:145/KRW_RATE,       change24h:5.07,  volume24h:1.5e9,          marketCap:21e9    },
  { id:'avalanche-2', symbol:'AVAX', name:'Avalanche',    priceKrw:14690,     priceUsd:14690/KRW_RATE,     change24h:3.60,  volume24h:0.8e9,          marketCap:6e9     },
  { id:'shiba-inu',   symbol:'SHIB', name:'Shiba Inu',    priceKrw:0.0137,    priceUsd:0.0137/KRW_RATE,    change24h:3.82,  volume24h:0.6e9,          marketCap:8e9     },
  { id:'polkadot',    symbol:'DOT',  name:'Polkadot',     priceKrw:2233,      priceUsd:2233/KRW_RATE,      change24h:0.63,  volume24h:0.35e9,         marketCap:3.5e9   },
  { id:'chainlink',   symbol:'LINK', name:'Chainlink',    priceKrw:13600,     priceUsd:13600/KRW_RATE,     change24h:2.72,  volume24h:0.45e9,         marketCap:9e9     },
  { id:'uniswap',     symbol:'UNI',  name:'Uniswap',      priceKrw:5980,      priceUsd:5980/KRW_RATE,      change24h:4.09,  volume24h:0.18e9,         marketCap:4.5e9   },
  { id:'near',        symbol:'NEAR', name:'NEAR Protocol', priceKrw:1984,     priceUsd:1984/KRW_RATE,      change24h:-0.95, volume24h:0.28e9,         marketCap:2.4e9   },
  { id:'aptos',       symbol:'APT',  name:'Aptos',        priceKrw:1369,      priceUsd:1369/KRW_RATE,      change24h:1.94,  volume24h:0.22e9,         marketCap:2.0e9   },
  { id:'arbitrum',    symbol:'ARB',  name:'Arbitrum',     priceKrw:154,       priceUsd:154/KRW_RATE,       change24h:4.05,  volume24h:0.32e9,         marketCap:2.0e9   },
  { id:'sui',         symbol:'SUI',  name:'Sui',          priceKrw:1530,      priceUsd:1530/KRW_RATE,      change24h:5.66,  volume24h:0.55e9,         marketCap:5.2e9   },
  { id:'optimism',    symbol:'OP',   name:'Optimism',     priceKrw:183,       priceUsd:183/KRW_RATE,       change24h:3.98,  volume24h:0.18e9,         marketCap:0.9e9   },
  { id:'pepe',        symbol:'PEPE', name:'Pepe',         priceKrw:0.0138,    priceUsd:0.0138/KRW_RATE,    change24h:6.52,  volume24h:0.85e9,         marketCap:5.8e9   },
  { id:'stellar',     symbol:'XLM',  name:'Stellar',      priceKrw:243,       priceUsd:243/KRW_RATE,       change24h:3.85,  volume24h:0.22e9,         marketCap:7.3e9   },
  { id:'binancecoin', symbol:'BNB',  name:'BNB',          priceKrw:0,         priceUsd:618.5,              change24h:1.80,  volume24h:1.8e9,          marketCap:87e9    },
  { id:'litecoin',    symbol:'LTC',  name:'Litecoin',     priceKrw:0,         priceUsd:105.5,              change24h:1.20,  volume24h:0.5e9,          marketCap:7.9e9   },
].map(c => ({ ...c, sparkline: genSparkline(c.priceUsd || c.priceKrw/KRW_RATE, 20, 0.025) }));

// ─── ETF ─────────────────────────────────────────────────────
export const ETF_DATA = [
  { symbol:'069500', name:'KODEX 200',          market:'kr', sector:'국내지수', category:'지수',   price:31250,  change:250,  changePct:0.81,  volume:5000000,  aum:8.2e12 },
  { symbol:'252670', name:'KODEX 200선물인버스2X', market:'kr', sector:'국내인버스', category:'인버스', price:1540,  change:-28,  changePct:-1.79, volume:35000000, aum:1.1e12 },
  { symbol:'148020', name:'KOSEF 국고채10년',   market:'kr', sector:'채권',    category:'채권',   price:107300, change:200,  changePct:0.19,  volume:250000,   aum:0.8e12 },
  { symbol:'411060', name:'ACE 미국나스닥100',  market:'kr', sector:'해외주식', category:'해외',   price:19850,  change:285,  changePct:1.46,  volume:1700000,  aum:3.8e12 },
  { symbol:'379800', name:'KODEX 미국S&P500',   market:'kr', sector:'해외주식', category:'해외',   price:17200,  change:180,  changePct:1.06,  volume:2000000,  aum:5.1e12 },
  { symbol:'SPY',    name:'SPDR S&P 500',       market:'us', sector:'Index',   category:'지수',   price:566.13, change:4.82, changePct:0.86,  volume:62000000, aum:570e9  },
  { symbol:'QQQ',    name:'Invesco QQQ',         market:'us', sector:'Index',   category:'지수',   price:479.88, change:5.25, changePct:1.11,  volume:38000000, aum:290e9  },
  { symbol:'VTI',    name:'Vanguard Total',      market:'us', sector:'Index',   category:'지수',   price:278.54, change:2.15, changePct:0.78,  volume:4500000,  aum:450e9  },
  { symbol:'IEF',    name:'iShares 7-10Y',       market:'us', sector:'Bond',    category:'채권',   price:93.85,  change:0.22, changePct:0.23,  volume:8500000,  aum:26e9   },
  { symbol:'GLD',    name:'SPDR Gold',           market:'us', sector:'Commodity',category:'원자재', price:270.15, change:2.80, changePct:1.05,  volume:12000000, aum:75e9   },
  { symbol:'ARKK',   name:'ARK Innovation',      market:'us', sector:'Thematic', category:'테마',  price:54.32,  change:-0.95,changePct:-1.72, volume:18000000, aum:9e9    },
  { symbol:'SOXX',   name:'iShares Semi',        market:'us', sector:'Sector',  category:'섹터',   price:196.45, change:4.21, changePct:2.19,  volume:3200000,  aum:11e9   },
].map(e => ({ ...e, sparkline: genSparkline(e.price, 20, 0.008) }));

// ─── 지수 초기값 ──────────────────────────────────────────────
export const INDICES_INITIAL = [
  { id:'KOSPI',  name:'코스피',   value:2643.12, change:18.52, changePct:0.71,  market:'kr' },
  { id:'KOSDAQ', name:'코스닥',   value:775.18,  change:-3.25, changePct:-0.42, market:'kr' },
  { id:'SPX',    name:'S&P 500', value:5614.56, change:38.25, changePct:0.69,  market:'us' },
  { id:'NDX',    name:'NASDAQ',  value:19560.20,change:215.30,changePct:1.11,  market:'us' },
  { id:'DJI',    name:'DOW',     value:41985.80,change:-85.20,changePct:-0.20, market:'us' },
  { id:'DXY',    name:'USD Index',value:103.82,  change:-0.18, changePct:-0.17, market:'us' },
];
