// 시그널 임계값 단일 소스 — signalEngine.js + DerivativesWidget.jsx 모두 여기서 import
export const THRESHOLDS = {
  PCR: {
    BULLISH_STRONG: 1.5,  // PCR > 1.5: 극도공포 → 강한 역발상 매수
    BULLISH:        1.2,  // PCR > 1.2: 공포 → 역발상 매수
    CAUTION_HIGH:   1.0,  // PCR > 1.0: 경계 시작 (신규: 경고 시그널)
    NEUTRAL_HIGH:   0.85, // PCR 0.85~1.0: 중립 상단
    NEUTRAL_LOW:    0.85, // PCR 0.85 이하: 경계 시작
    CAUTION_LOW:    0.7,  // PCR 0.7~0.85: 경계 (신규)
    BEARISH:        0.7,  // PCR < 0.7: 탐욕 → 역발상 매도
    BEARISH_STRONG: 0.5,  // PCR < 0.5: 극도탐욕 → 강한 매도
  },
  FUNDING: {
    BEARISH_STRONG: 0.10, // > +0.10%: 강한 롱 과열
    BEARISH:        0.05, // > +0.05%: 롱 과열
    CAUTION_BULL:   0.03, // > +0.03%: 롱 과열 징후 (신규)
    CAUTION_BEAR:  -0.03, // < -0.03%: 숏 과열 징후 (신규)
    BULLISH:       -0.05, // < -0.05%: 숏 과열
    BULLISH_STRONG:-0.10, // < -0.10%: 강한 숏 과열
  },
  ORDER_FLOW: {
    STRONG:  0.30, // |imbalance| > 30%: 강한 불균형 시그널
    CAUTION: 0.15, // |imbalance| > 15%: 주의 시그널 (신규)
  },
  SOCIAL: {
    BULLISH_STRONG: 0.85,
    BULLISH:        0.70,
    BEARISH:        0.30,
    BEARISH_STRONG: 0.15,
    MIN_MESSAGES:    5,   // 5건 이상 (기존 10 → 5 완화)
  },
  CROSS_MARKET: {
    DIVERGENCE: 5,        // 괴리율 5% 이상 시 시그널
    STRONG: 10,           // 10% 이상 강한 괴리
  },
  SENTIMENT_DIV: {
    PRICE_MIN: 2,         // 가격 변동 최소 2%
    SENTIMENT_MIN: 0.5,   // 감성 점수 최소 절대값
    STRONG: 1.5,          // 강한 괴리 기준
    MIN_NEWS: 2,          // 최소 뉴스 2건
  },
  MOMENTUM: {
    MIN_SLOPE: 0.5,       // 최소 기울기 0.5%
    STRONG: 3,            // 강한 모멘텀 3%
    MID: 1.5,             // 중간 모멘텀 1.5%
    MIN_SPARKLINE: 10,    // 최소 스파크라인 데이터 10개
  },
  VOL_PRICE: {
    HIGH_VOL_LOW_PRICE_RATIO: 2, // 거래량 2배 이상인데 가격 정체
    HIGH_VOL_MAX_PRICE: 1,       // 가격 변동 1% 이하면 정체
    BIG_PRICE_MIN: 5,            // 큰 가격 변동 최소 5%
  },
  MARKET_MOOD: {
    DIRECTION_THRESHOLD: 1,      // 방향 판단 기준 1%
    MIN_FLIPS: 2,                // 최소 전환 시장 수
  },
};
