// src/data/krStockList.js — 국장 종목 메타 (섹터 포함)
// 코스피·코스닥 시총 상위 종목 + 섹터 매핑
// SectorMiniWidget이 krStocks.sector를 참조 → 섹터 자금흐름 집계에 사용

export const KR_STOCK_LIST = [
  // 반도체
  { symbol: '005930', name: '삼성전자',       sector: '반도체' },
  { symbol: '000660', name: 'SK하이닉스',     sector: '반도체' },
  { symbol: '009150', name: '삼성전기',        sector: '반도체' },
  { symbol: '042700', name: '한미반도체',      sector: '반도체' },
  { symbol: '336370', name: '솔브레인',        sector: '반도체' },
  // 2차전지
  { symbol: '373220', name: 'LG에너지솔루션', sector: '2차전지' },
  { symbol: '006400', name: '삼성SDI',         sector: '2차전지' },
  { symbol: '051910', name: 'LG화학',          sector: '2차전지' },
  { symbol: '247540', name: '에코프로비엠',    sector: '2차전지' },
  { symbol: '086520', name: '에코프로',        sector: '2차전지' },
  { symbol: '096770', name: 'SK이노베이션',   sector: '2차전지' },
  { symbol: '003670', name: '포스코퓨처엠',   sector: '2차전지' },
  // 바이오/제약
  { symbol: '207940', name: '삼성바이오로직스', sector: '바이오' },
  { symbol: '068270', name: '셀트리온',        sector: '바이오' },
  { symbol: '196170', name: '알테오젠',        sector: '바이오' },
  { symbol: '128940', name: '한미약품',        sector: '바이오' },
  { symbol: '145020', name: '휴젤',            sector: '바이오' },
  { symbol: '326030', name: 'SK바이오팜',      sector: '바이오' },
  { symbol: '302440', name: 'SK바이오사이언스', sector: '바이오' },
  // 자동차
  { symbol: '005380', name: '현대차',          sector: '자동차' },
  { symbol: '000270', name: '기아',            sector: '자동차' },
  { symbol: '012330', name: '현대모비스',      sector: '자동차' },
  { symbol: '018880', name: '한온시스템',      sector: '자동차' },
  // 플랫폼/IT
  { symbol: '035420', name: 'NAVER',           sector: '플랫폼' },
  { symbol: '035720', name: '카카오',          sector: '플랫폼' },
  { symbol: '066570', name: 'LG전자',          sector: '전자' },
  { symbol: '034020', name: '두산에너빌리티', sector: '원자력' },
  // 금융
  { symbol: '105560', name: 'KB금융',          sector: '금융' },
  { symbol: '055550', name: '신한지주',        sector: '금융' },
  { symbol: '086790', name: '하나금융지주',    sector: '금융' },
  { symbol: '316140', name: '우리금융지주',    sector: '금융' },
  { symbol: '024110', name: '기업은행',        sector: '금융' },
  { symbol: '003540', name: '대신증권',        sector: '금융' },
  // 방산/항공
  { symbol: '012450', name: '한화에어로스페이스', sector: '방산' },
  { symbol: '047810', name: '한국항공우주',    sector: '방산' },
  { symbol: '064350', name: '현대로템',        sector: '방산' },
  { symbol: '000880', name: '한화',            sector: '방산' },
  // 철강/소재
  { symbol: '005490', name: 'POSCO홀딩스',     sector: '철강/소재' },
  { symbol: '004020', name: '현대제철',        sector: '철강/소재' },
  // 에너지/유틸리티
  { symbol: '015760', name: '한국전력',        sector: '에너지' },
  { symbol: '036460', name: '한국가스공사',    sector: '에너지' },
  // 통신
  { symbol: '017670', name: 'SK텔레콤',        sector: '통신' },
  { symbol: '030200', name: 'KT',              sector: '통신' },
  { symbol: '032640', name: 'LG유플러스',      sector: '통신' },
  // 건설/지주
  { symbol: '028260', name: '삼성물산',        sector: '건설' },
  { symbol: '000720', name: '현대건설',        sector: '건설' },
  // 소비재/유통
  { symbol: '033780', name: 'KT&G',            sector: '소비재' },
  { symbol: '004370', name: '농심',            sector: '소비재' },
  { symbol: '271560', name: '오리온',          sector: '소비재' },
];

// symbol → sector 빠른 조회용 Map
export const KR_SECTOR_MAP = new Map(
  KR_STOCK_LIST.map(s => [s.symbol, s.sector])
);
