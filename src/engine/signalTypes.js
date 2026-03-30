// 시그널 타입 상수 — 시그널 엔진 전체에서 공유
export const SIGNAL_TYPES = {
  FOREIGN_CONSECUTIVE_BUY: 'foreign_consecutive_buy',
  FOREIGN_CONSECUTIVE_SELL: 'foreign_consecutive_sell',
  INSTITUTIONAL_CONSECUTIVE_BUY: 'institutional_consecutive_buy',
  INSTITUTIONAL_CONSECUTIVE_SELL: 'institutional_consecutive_sell',
  VOLUME_ANOMALY: 'volume_anomaly',
  WHALE_EXCHANGE_INFLOW: 'whale_exchange_inflow',
  WHALE_EXCHANGE_OUTFLOW: 'whale_exchange_outflow',
  WHALE_STABLECOIN_INFLOW: 'whale_stablecoin_inflow',
  WHALE_LARGE_SINGLE: 'whale_large_single',
  FEAR_GREED_SHIFT: 'fear_greed_shift',
  NEWS_SENTIMENT_CLUSTER: 'news_sentiment_cluster',
  SECTOR_ROTATION: 'sector_rotation',
};

// 시그널 방향
export const DIRECTIONS = {
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  NEUTRAL: 'neutral',
};

// 시그널 만료 시간 (ms) — 미등록 타입은 기본 2시간
const DEFAULT_TTL = 2 * 3600000;

export const SIGNAL_TTL = {
  [SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY]: 24 * 3600000,
  [SIGNAL_TYPES.FOREIGN_CONSECUTIVE_SELL]: 24 * 3600000,
  [SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_BUY]: 24 * 3600000,
  [SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_SELL]: 24 * 3600000,
  [SIGNAL_TYPES.VOLUME_ANOMALY]: 2 * 3600000,
  [SIGNAL_TYPES.WHALE_EXCHANGE_INFLOW]: 30 * 60000,
  [SIGNAL_TYPES.WHALE_EXCHANGE_OUTFLOW]: 30 * 60000,
  [SIGNAL_TYPES.WHALE_STABLECOIN_INFLOW]: 30 * 60000,
  [SIGNAL_TYPES.WHALE_LARGE_SINGLE]: 30 * 60000,
  [SIGNAL_TYPES.FEAR_GREED_SHIFT]: 12 * 3600000,
  [SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER]: 2 * 3600000,
  [SIGNAL_TYPES.SECTOR_ROTATION]: 6 * 3600000,
};

/** 시그널 타입별 TTL 조회 (기본값 2시간) */
export function getTTL(type) {
  return SIGNAL_TTL[type] ?? DEFAULT_TTL;
}

// 시그널 방향별 스타일 매핑 (아이콘/색상/배경/라벨)
export const SIGNAL_STYLE = {
  bullish: { emoji: '🟢', color: '#2AC769', bg: '#F0FFF6', label: '강세' },
  bearish: { emoji: '🔴', color: '#F04452', bg: '#FFF0F1', label: '약세' },
  neutral: { emoji: '🟡', color: '#FF9500', bg: '#FFF4E6', label: '중립' },
};
