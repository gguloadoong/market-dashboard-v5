// 목업 데이터

// 스파크라인 랜덤 생성 헬퍼
function genSparkline(base, count = 20, volatility = 0.015) {
  const data = [];
  let cur = base;
  for (let i = 0; i < count; i++) {
    cur = cur * (1 + (Math.random() - 0.5) * volatility * 2);
    data.push(parseFloat(cur.toFixed(2)));
  }
  return data;
}

// 국내 주식 30개
export const KOREAN_STOCKS = [
  { symbol: '005930', name: '삼성전자', market: 'kr', sector: '반도체', price: 73400, change: 800, changePct: 1.10, volume: 12500000, marketCap: 437e12, high52w: 88800, low52w: 55500 },
  { symbol: '000660', name: 'SK하이닉스', market: 'kr', sector: '반도체', price: 198500, change: -2500, changePct: -1.24, volume: 3200000, marketCap: 144e12, high52w: 238500, low52w: 129000 },
  { symbol: '035420', name: 'NAVER', market: 'kr', sector: 'IT', price: 198000, change: 1500, changePct: 0.76, volume: 890000, marketCap: 32e12, high52w: 248500, low52w: 155000 },
  { symbol: '035720', name: '카카오', market: 'kr', sector: 'IT', price: 41650, change: -350, changePct: -0.83, volume: 2100000, marketCap: 18e12, high52w: 58800, low52w: 35100 },
  { symbol: '051910', name: 'LG화학', market: 'kr', sector: '화학', price: 298000, change: 3000, changePct: 1.02, volume: 450000, marketCap: 21e12, high52w: 385000, low52w: 258000 },
  { symbol: '006400', name: '삼성SDI', market: 'kr', sector: '배터리', price: 185500, change: -1500, changePct: -0.80, volume: 320000, marketCap: 25e12, high52w: 275000, low52w: 165000 },
  { symbol: '207940', name: '삼성바이오로직스', market: 'kr', sector: '바이오', price: 895000, change: 5000, changePct: 0.56, volume: 85000, marketCap: 62e12, high52w: 1050000, low52w: 740000 },
  { symbol: '068270', name: '셀트리온', market: 'kr', sector: '바이오', price: 178500, change: 2000, changePct: 1.13, volume: 520000, marketCap: 21e12, high52w: 220000, low52w: 145000 },
  { symbol: '005380', name: '현대차', market: 'kr', sector: '자동차', price: 228500, change: -500, changePct: -0.22, volume: 680000, marketCap: 49e12, high52w: 285000, low52w: 195000 },
  { symbol: '000270', name: '기아', market: 'kr', sector: '자동차', price: 98200, change: 1200, changePct: 1.24, volume: 1250000, marketCap: 39e12, high52w: 118000, low52w: 78000 },
  { symbol: '105560', name: 'KB금융', market: 'kr', sector: '금융', price: 88300, change: 300, changePct: 0.34, volume: 820000, marketCap: 35e12, high52w: 98000, low52w: 68000 },
  { symbol: '055550', name: '신한지주', market: 'kr', sector: '금융', price: 52800, change: -200, changePct: -0.38, volume: 1100000, marketCap: 25e12, high52w: 58500, low52w: 40000 },
  { symbol: '086790', name: '하나금융지주', market: 'kr', sector: '금융', price: 62400, change: 600, changePct: 0.97, volume: 750000, marketCap: 18e12, high52w: 72000, low52w: 48500 },
  { symbol: '316140', name: '우리금융지주', market: 'kr', sector: '금융', price: 14850, change: 150, changePct: 1.02, volume: 2800000, marketCap: 12e12, high52w: 17200, low52w: 11500 },
  { symbol: '032830', name: '삼성생명', market: 'kr', sector: '보험', price: 98500, change: -500, changePct: -0.51, volume: 280000, marketCap: 19e12, high52w: 115000, low52w: 75000 },
  { symbol: '018260', name: '삼성에스디에스', market: 'kr', sector: 'IT서비스', price: 155000, change: 1000, changePct: 0.65, volume: 180000, marketCap: 12e12, high52w: 175000, low52w: 120000 },
  { symbol: '034730', name: 'SK', market: 'kr', sector: '지주', price: 155000, change: -1000, changePct: -0.64, volume: 120000, marketCap: 11e12, high52w: 195000, low52w: 135000 },
  { symbol: '017670', name: 'SK텔레콤', market: 'kr', sector: '통신', price: 53400, change: 200, changePct: 0.38, volume: 450000, marketCap: 22e12, high52w: 58000, low52w: 44000 },
  { symbol: '030200', name: 'KT', market: 'kr', sector: '통신', price: 42500, change: 350, changePct: 0.83, volume: 880000, marketCap: 11e12, high52w: 46000, low52w: 32500 },
  { symbol: '003550', name: 'LG', market: 'kr', sector: '지주', price: 88000, change: -800, changePct: -0.90, volume: 210000, marketCap: 15e12, high52w: 108000, low52w: 72000 },
  { symbol: '066570', name: 'LG전자', market: 'kr', sector: '가전', price: 96200, change: 1200, changePct: 1.27, volume: 680000, marketCap: 16e12, high52w: 115000, low52w: 75000 },
  { symbol: '009150', name: '삼성전기', market: 'kr', sector: '부품', price: 128000, change: -1000, changePct: -0.78, volume: 290000, marketCap: 10e12, high52w: 155000, low52w: 100000 },
  { symbol: '000100', name: '유한양행', market: 'kr', sector: '제약', price: 82500, change: 1500, changePct: 1.85, volume: 380000, marketCap: 6e12, high52w: 95000, low52w: 55000 },
  { symbol: '128940', name: '한미약품', market: 'kr', sector: '제약', price: 295000, change: -5000, changePct: -1.66, volume: 85000, marketCap: 4e12, high52w: 380000, low52w: 245000 },
  { symbol: '011200', name: 'HMM', market: 'kr', sector: '해운', price: 16850, change: 350, changePct: 2.12, volume: 3500000, marketCap: 13e12, high52w: 22000, low52w: 12000 },
  { symbol: '010130', name: '고려아연', market: 'kr', sector: '금속', price: 655000, change: 5000, changePct: 0.77, volume: 45000, marketCap: 14e12, high52w: 780000, low52w: 520000 },
  { symbol: '047810', name: '한국항공우주', market: 'kr', sector: '방산', price: 58800, change: 800, changePct: 1.38, volume: 620000, marketCap: 6e12, high52w: 68000, low52w: 40000 },
  { symbol: '009830', name: '한화솔루션', market: 'kr', sector: '에너지', price: 24950, change: -250, changePct: -0.99, volume: 1800000, marketCap: 4e12, high52w: 35000, low52w: 20000 },
  { symbol: '096770', name: 'SK이노베이션', market: 'kr', sector: '에너지', price: 88500, change: 500, changePct: 0.57, volume: 580000, marketCap: 8e12, high52w: 115000, low52w: 72000 },
  { symbol: '015760', name: '한국전력', market: 'kr', sector: '유틸리티', price: 23450, change: 150, changePct: 0.64, volume: 2100000, marketCap: 15e12, high52w: 28000, low52w: 18500 },
].map(s => ({ ...s, sparkline: genSparkline(s.price, 20, 0.012) }));

// 미국 주식 (Yahoo Finance로 실시간 갱신, 여기는 초기값)
export const US_STOCKS_INITIAL = [
  { symbol: 'AAPL', name: 'Apple', market: 'us', sector: 'Technology', price: 213.49, change: 2.31, changePct: 1.09, volume: 52000000, marketCap: 3.2e12, high52w: 237.23, low52w: 164.08 },
  { symbol: 'MSFT', name: 'Microsoft', market: 'us', sector: 'Technology', price: 415.32, change: -1.85, changePct: -0.44, volume: 18000000, marketCap: 3.1e12, high52w: 468.35, low52w: 385.58 },
  { symbol: 'GOOGL', name: 'Alphabet', market: 'us', sector: 'Technology', price: 175.41, change: 1.23, changePct: 0.71, volume: 22000000, marketCap: 2.2e12, high52w: 208.70, low52w: 155.84 },
  { symbol: 'AMZN', name: 'Amazon', market: 'us', sector: 'Consumer', price: 199.62, change: -0.88, changePct: -0.44, volume: 31000000, marketCap: 2.1e12, high52w: 242.52, low52w: 158.26 },
  { symbol: 'NVDA', name: 'NVIDIA', market: 'us', sector: 'Semiconductor', price: 875.35, change: 15.42, changePct: 1.79, volume: 42000000, marketCap: 2.2e12, high52w: 974.00, low52w: 461.07 },
  { symbol: 'META', name: 'Meta', market: 'us', sector: 'Technology', price: 512.34, change: 4.56, changePct: 0.90, volume: 14000000, marketCap: 1.3e12, high52w: 604.93, low52w: 390.28 },
  { symbol: 'TSLA', name: 'Tesla', market: 'us', sector: 'EV', price: 178.21, change: -3.45, changePct: -1.90, volume: 95000000, marketCap: 0.57e12, high52w: 414.50, low52w: 138.80 },
  { symbol: 'AVGO', name: 'Broadcom', market: 'us', sector: 'Semiconductor', price: 163.50, change: 2.10, changePct: 1.30, volume: 25000000, marketCap: 0.77e12, high52w: 224.56, low52w: 127.11 },
  { symbol: 'JPM', name: 'JPMorgan', market: 'us', sector: 'Finance', price: 212.48, change: 1.05, changePct: 0.50, volume: 9000000, marketCap: 0.61e12, high52w: 260.33, low52w: 182.83 },
  { symbol: 'BRK-B', name: 'Berkshire', market: 'us', sector: 'Finance', price: 445.10, change: -0.90, changePct: -0.20, volume: 3500000, marketCap: 0.97e12, high52w: 497.27, low52w: 358.09 },
].map(s => ({ ...s, sparkline: genSparkline(s.price, 20, 0.015) }));

// ETF 데이터
export const ETF_DATA = [
  // 국내 ETF
  { symbol: '069500', name: 'KODEX 200', market: 'kr', sector: '국내지수', category: '지수', price: 30250, change: 250, changePct: 0.83, volume: 5200000, aum: 8.2e12 },
  { symbol: '252670', name: 'KODEX 200선물인버스2X', market: 'kr', sector: '국내인버스', category: '인버스', price: 1580, change: -28, changePct: -1.74, volume: 38000000, aum: 1.2e12 },
  { symbol: '148020', name: 'KOSEF 국고채10년', market: 'kr', sector: '채권', category: '채권', price: 106200, change: 200, changePct: 0.19, volume: 280000, aum: 0.8e12 },
  { symbol: '411060', name: 'ACE 미국나스닥100', market: 'kr', sector: '해외주식', category: '해외', price: 18250, change: 185, changePct: 1.02, volume: 1800000, aum: 3.5e12 },
  { symbol: '379800', name: 'KODEX 미국S&P500', market: 'kr', sector: '해외주식', category: '해외', price: 15800, change: 120, changePct: 0.76, volume: 2100000, aum: 4.8e12 },
  // 미국 ETF
  { symbol: 'SPY', name: 'SPDR S&P 500', market: 'us', sector: 'Index', category: '지수', price: 525.80, change: 3.21, changePct: 0.61, volume: 62000000, aum: 520e9 },
  { symbol: 'QQQ', name: 'Invesco QQQ', market: 'us', sector: 'Index', category: '지수', price: 445.32, change: 4.15, changePct: 0.94, volume: 38000000, aum: 250e9 },
  { symbol: 'VTI', name: 'Vanguard Total', market: 'us', sector: 'Index', category: '지수', price: 258.40, change: 1.85, changePct: 0.72, volume: 4500000, aum: 430e9 },
  { symbol: 'IEF', name: 'iShares 7-10Y', market: 'us', sector: 'Bond', category: '채권', price: 96.15, change: 0.32, changePct: 0.33, volume: 8500000, aum: 28e9 },
  { symbol: 'GLD', name: 'SPDR Gold', market: 'us', sector: 'Commodity', category: '원자재', price: 215.80, change: 1.20, changePct: 0.56, volume: 12000000, aum: 58e9 },
  { symbol: 'ARKK', name: 'ARK Innovation', market: 'us', sector: 'Thematic', category: '테마', price: 42.15, change: -0.85, changePct: -1.98, volume: 18000000, aum: 8e9 },
  { symbol: 'SOXX', name: 'iShares Semi', market: 'us', sector: 'Sector', category: '섹터', price: 218.40, change: 3.55, changePct: 1.65, volume: 3200000, aum: 12e9 },
].map(e => ({ ...e, sparkline: genSparkline(e.price, 20, 0.008) }));

// 주요 지수 초기값
export const INDICES_INITIAL = [
  { id: 'KOSPI', name: '코스피', value: 2612.35, change: 18.42, changePct: 0.71, market: 'kr' },
  { id: 'KOSDAQ', name: '코스닥', value: 852.18, change: -3.25, changePct: -0.38, market: 'kr' },
  { id: 'SPX', name: 'S&P 500', value: 5248.80, change: 32.15, changePct: 0.62, market: 'us' },
  { id: 'NDX', name: 'NASDAQ', value: 18357.20, change: 145.30, changePct: 0.80, market: 'us' },
  { id: 'DJI', name: 'DOW', value: 39512.80, change: -85.20, changePct: -0.22, market: 'us' },
  { id: 'DXY', name: 'USD Index', value: 104.25, change: -0.15, changePct: -0.14, market: 'us' },
];

// 코인 초기값 (CoinGecko로 실시간 갱신)
export const COINS_INITIAL = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', priceUsd: 67234.50, priceKrw: 89800000, change24h: 2.34, volume24h: 28.5e9, marketCap: 1.32e12, sparkline: genSparkline(67234, 20, 0.02) },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', priceUsd: 3521.80, priceKrw: 4701000, change24h: 1.85, volume24h: 15.2e9, marketCap: 0.42e12, sparkline: genSparkline(3521, 20, 0.025) },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', priceUsd: 412.50, priceKrw: 550000, change24h: -0.82, volume24h: 1.8e9, marketCap: 62.5e9, sparkline: genSparkline(412, 20, 0.02) },
  { id: 'solana', symbol: 'SOL', name: 'Solana', priceUsd: 178.40, priceKrw: 238000, change24h: 3.21, volume24h: 4.5e9, marketCap: 83.5e9, sparkline: genSparkline(178, 20, 0.03) },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', priceUsd: 0.5284, priceKrw: 705, change24h: -1.25, volume24h: 1.2e9, marketCap: 29.8e9, sparkline: genSparkline(0.5284, 20, 0.025) },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', priceUsd: 0.4521, priceKrw: 603, change24h: 0.95, volume24h: 0.5e9, marketCap: 16.1e9, sparkline: genSparkline(0.4521, 20, 0.025) },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', priceUsd: 0.1428, priceKrw: 190, change24h: 4.52, volume24h: 1.5e9, marketCap: 20.8e9, sparkline: genSparkline(0.1428, 20, 0.04) },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', priceUsd: 36.82, priceKrw: 49150, change24h: -2.15, volume24h: 0.8e9, marketCap: 15.1e9, sparkline: genSparkline(36.82, 20, 0.03) },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', priceUsd: 0.0000245, priceKrw: 0.0327, change24h: 5.82, volume24h: 0.6e9, marketCap: 14.5e9, sparkline: genSparkline(0.0000245, 20, 0.05) },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', priceUsd: 7.82, priceKrw: 10440, change24h: 1.45, volume24h: 0.35e9, marketCap: 11.2e9, sparkline: genSparkline(7.82, 20, 0.025) },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', priceUsd: 14.52, priceKrw: 19380, change24h: 2.85, volume24h: 0.45e9, marketCap: 9.0e9, sparkline: genSparkline(14.52, 20, 0.03) },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', priceUsd: 8.45, priceKrw: 11280, change24h: -0.65, volume24h: 0.18e9, marketCap: 6.5e9, sparkline: genSparkline(8.45, 20, 0.025) },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', priceUsd: 82.40, priceKrw: 110000, change24h: 1.20, volume24h: 0.5e9, marketCap: 6.2e9, sparkline: genSparkline(82.4, 20, 0.02) },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', priceUsd: 5.84, priceKrw: 7795, change24h: 3.45, volume24h: 0.28e9, marketCap: 6.4e9, sparkline: genSparkline(5.84, 20, 0.035) },
  { id: 'aptos', symbol: 'APT', name: 'Aptos', priceUsd: 8.92, priceKrw: 11910, change24h: -1.85, volume24h: 0.22e9, marketCap: 3.9e9, sparkline: genSparkline(8.92, 20, 0.03) },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', priceUsd: 0.982, priceKrw: 1310, change24h: 2.10, volume24h: 0.32e9, marketCap: 3.9e9, sparkline: genSparkline(0.982, 20, 0.03) },
  { id: 'sui', symbol: 'SUI', name: 'Sui', priceUsd: 1.245, priceKrw: 1662, change24h: 4.85, volume24h: 0.55e9, marketCap: 3.5e9, sparkline: genSparkline(1.245, 20, 0.04) },
  { id: 'optimism', symbol: 'OP', name: 'Optimism', priceUsd: 2.48, priceKrw: 3310, change24h: 1.65, volume24h: 0.18e9, marketCap: 3.2e9, sparkline: genSparkline(2.48, 20, 0.03) },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', priceUsd: 0.00001245, priceKrw: 0.01662, change24h: 7.82, volume24h: 0.85e9, marketCap: 5.2e9, sparkline: genSparkline(0.00001245, 20, 0.06) },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar', priceUsd: 0.1082, priceKrw: 144, change24h: 0.45, volume24h: 0.22e9, marketCap: 3.2e9, sparkline: genSparkline(0.1082, 20, 0.02) },
];
