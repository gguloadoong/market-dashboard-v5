// 연관 종목 매핑 테이블
// 코인 → ETF / 관련 주식, 미국 주식 → 섹터 클러스터, 국장 → 동일 섹터 종목
// ChartSidePanel 상세 패널 + MoverRow 호버 툴팁에서 사용

export const RELATED_ASSETS = {
  // ── 코인 → 미국 현물 ETF + 관련 주식 ───────────────────────
  BTC:  { label: 'Bitcoin',   etfs: ['IBIT','FBTC','GBTC'], stocks: ['MSTR','COIN','RIOT','MARA'], sector: '비트코인' },
  ETH:  { label: 'Ethereum',  etfs: ['ETHA','FETH','ETHE'], stocks: ['COIN'],                      sector: '이더리움' },
  SOL:  { label: 'Solana',    etfs: ['SOLT'],                stocks: ['COIN'],                      sector: '알트코인' },
  XRP:  { label: 'Ripple',    etfs: [],                      stocks: ['COIN'],                      sector: '알트코인' },
  BNB:  { label: 'BNB',       etfs: [],                      stocks: ['COIN'],                      sector: '알트코인' },
  DOGE: { label: 'Dogecoin',  etfs: [],                      stocks: ['TSLA','COIN'],               sector: '알트코인' },
  AVAX: { label: 'Avalanche', etfs: [],                      stocks: ['COIN'],                      sector: '알트코인' },
  LINK: { label: 'Chainlink', etfs: [],                      stocks: ['COIN'],                      sector: '알트코인' },
  ADA:  { label: 'Cardano',   etfs: [],                      stocks: [],                            sector: '알트코인' },

  // ── 미국 빅테크 ──────────────────────────────────────────────
  AAPL: { label: 'Apple',     etfs: ['QQQ','XLK'], stocks: ['MSFT','GOOGL','META'],                sector: '빅테크'   },
  MSFT: { label: 'Microsoft', etfs: ['QQQ','XLK'], stocks: ['AAPL','GOOGL','META'],                sector: '빅테크'   },
  GOOGL:{ label: 'Alphabet',  etfs: ['QQQ','XLK'], stocks: ['META','AAPL','MSFT'],                 sector: '빅테크'   },
  META: { label: 'Meta',      etfs: ['QQQ','XLK'], stocks: ['GOOGL','SNAP','AAPL'],                sector: '빅테크'   },
  AMZN: { label: 'Amazon',    etfs: ['QQQ','XLK'], stocks: ['MSFT','GOOGL'],                       sector: '빅테크'   },

  // ── 반도체 클러스터 ───────────────────────────────────────────
  NVDA: { label: 'NVIDIA',    etfs: ['SOXX','SMH'], stocks: ['AMD','TSM','SMCI','ARM','INTC'],      sector: '반도체'   },
  AMD:  { label: 'AMD',       etfs: ['SOXX','SMH'], stocks: ['NVDA','INTC','TSM'],                  sector: '반도체'   },
  TSM:  { label: 'TSMC',      etfs: ['SOXX','SMH'], stocks: ['NVDA','AMD','INTC'],                  sector: '반도체'   },
  INTC: { label: 'Intel',     etfs: ['SOXX','SMH'], stocks: ['AMD','NVDA','TSM'],                   sector: '반도체'   },
  SMCI: { label: 'Super Micro',etfs: [],            stocks: ['NVDA','AMD'],                         sector: '반도체'   },
  ARM:  { label: 'ARM',       etfs: ['SOXX'],        stocks: ['NVDA','QCOM'],                        sector: '반도체'   },
  QCOM: { label: 'Qualcomm',  etfs: ['SOXX','SMH'], stocks: ['ARM','NVDA','INTC'],                  sector: '반도체'   },

  // ── EV / 자동차 ───────────────────────────────────────────────
  TSLA: { label: 'Tesla',     etfs: ['DRIV'],       stocks: ['RIVN','NIO','LCID','BTC'],            sector: 'EV'       },
  RIVN: { label: 'Rivian',    etfs: [],             stocks: ['TSLA','NIO','LCID'],                  sector: 'EV'       },
  NIO:  { label: 'NIO',       etfs: [],             stocks: ['TSLA','RIVN','LCID'],                 sector: 'EV'       },

  // ── 국내 반도체 ───────────────────────────────────────────────
  '삼성전자':   { label: 'Samsung',     etfs: [],   stocks: ['SK하이닉스','DB하이텍'],              sector: '반도체'   },
  'SK하이닉스': { label: 'SK Hynix',    etfs: [],   stocks: ['삼성전자','NVDA','AMD'],              sector: '반도체'   },

  // ── 국내 자동차 ───────────────────────────────────────────────
  '현대차':     { label: 'Hyundai',     etfs: [],   stocks: ['기아','현대모비스'],                  sector: '자동차'   },
  '기아':       { label: 'Kia',         etfs: [],   stocks: ['현대차','현대모비스'],                sector: '자동차'   },
  '현대모비스': { label: 'Hyundai Mobis',etfs: [],  stocks: ['현대차','기아'],                      sector: '자동차'   },

  // ── 국내 플랫폼 ───────────────────────────────────────────────
  '카카오':     { label: 'Kakao',       etfs: [],   stocks: ['네이버'],                             sector: '플랫폼'   },
  '네이버':     { label: 'Naver',       etfs: [],   stocks: ['카카오'],                             sector: '플랫폼'   },

  // ── 국내 에너지/화학 ──────────────────────────────────────────
  'POSCO홀딩스':{ label: 'POSCO',       etfs: [],   stocks: ['LG화학','롯데케미칼'],                sector: '소재'     },
  'LG화학':     { label: 'LG Chem',     etfs: [],   stocks: ['POSCO홀딩스','삼성SDI'],              sector: '소재'     },
  '삼성SDI':    { label: 'Samsung SDI', etfs: [],   stocks: ['LG에너지솔루션','LG화학'],            sector: '배터리'   },
  'LG에너지솔루션':{ label: 'LGES',     etfs: [],   stocks: ['삼성SDI','SK이노베이션'],             sector: '배터리'   },
};

/**
 * 종목의 연관 종목 티커 목록 반환
 * @param {string} symbol - 종목 심볼 또는 한글명
 * @returns {string[]} 연관 종목 티커 배열 (ETF + 주식)
 */
export function getRelatedTickers(symbol) {
  const info = RELATED_ASSETS[symbol];
  if (!info) return [];
  return [...(info.etfs || []), ...(info.stocks || [])];
}

/**
 * 전체 시장 데이터에서 연관 종목 찾기
 * @param {string} symbol
 * @param {Object} dataMap - { symbol: item } 형태의 전체 시장 데이터 맵
 * @returns {{ ticker: string, item: object|null, isEtf: boolean }[]}
 */
export function findRelatedItems(symbol, dataMap) {
  const info = RELATED_ASSETS[symbol];
  if (!info) return [];

  const result = [];

  // ETF 먼저
  for (const ticker of (info.etfs || [])) {
    result.push({ ticker, item: dataMap[ticker] || null, isEtf: true });
  }
  // 관련 주식
  for (const ticker of (info.stocks || [])) {
    result.push({ ticker, item: dataMap[ticker] || null, isEtf: false });
  }

  return result.slice(0, 6); // 최대 6개
}
