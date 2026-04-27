// 시그널 임계값 단일 소스 — signalEngine.js + DerivativesWidget.jsx 모두 여기서 import
export const THRESHOLDS = {
  PCR: {
    BULLISH_STRONG: 1.5,  // PCR > 1.5: 극도공포 → 강한 역발상 매수
    BULLISH:        1.2,  // PCR > 1.2: 공포 → 역발상 매수
    CAUTION_HIGH:   1.05, // PCR > 1.05: 경계 시작 (P1 강화: 1.0→1.05 과도 발화 억제)
    NEUTRAL_HIGH:   0.90, // PCR 0.90~1.05: 중립 상단 (compositeScorer 미사용 — createPCRSignal 로직 개선 시 활용)
    NEUTRAL_LOW:    0.90, // PCR 0.90 이하: 경계 시작 (compositeScorer.js:78에서 참조)
    CAUTION_LOW:    0.80, // PCR 0.80~0.90: 경계 (P1 강화: 0.7→0.80 과도 발화 억제)
    BEARISH:        0.7,  // PCR < 0.7: 탐욕 → 역발상 매도
    BEARISH_STRONG: 0.5,  // PCR < 0.5: 극도탐욕 → 강한 매도
  },
  FUNDING: {
    BEARISH_STRONG: 0.10, // > +0.10%: 강한 롱 과열
    BEARISH:        0.05, // > +0.05%: 롱 과열
    CAUTION_BULL:   0.03, // > +0.03%: 롱 과열 징후 (P1 강화: 0.02→0.03 과도 발화 억제)
    CAUTION_BEAR:  -0.03, // < -0.03%: 숏 과열 징후 (P1 강화: -0.02→-0.03 과도 발화 억제)
    BULLISH:       -0.05, // < -0.05%: 숏 과열
    BULLISH_STRONG:-0.10, // < -0.10%: 강한 숏 과열
  },
  ORDER_FLOW: {
    STRONG:  0.30, // |imbalance| > 30%: 강한 불균형 시그널
    CAUTION: 0.15, // |imbalance| > 15%: 주의 시그널 (P1 강화: 0.10→0.15 과도 발화 억제)
  },
  SOCIAL: {
    BULLISH_STRONG: 0.85,
    BULLISH:        0.70,
    BEARISH:        0.30,
    BEARISH_STRONG: 0.15,
    MIN_MESSAGES:    8,   // 8건 이상 (P1 강화: 5→8 과도 발화 억제)
  },
  CROSS_MARKET: {
    DIVERGENCE: 3,        // 괴리율 3% 이상 시 시그널 (완화: 5→3)
    STRONG: 10,           // 10% 이상 강한 괴리
  },
  SENTIMENT_DIV: {
    PRICE_MIN: 2,         // 가격 변동 최소 2%
    SENTIMENT_MIN: 0.5,   // 감성 점수 최소 절대값
    STRONG: 1.5,          // 강한 괴리 기준
    MIN_NEWS: 2,          // 최소 뉴스 2건
  },
  MOMENTUM: {
    MIN_SLOPE: 1.0,       // 최소 기울기 1.0% (P1 강화: 0.5→1.0 과도 발화 억제)
    STRONG: 3,            // 강한 모멘텀 3%
    MID: 1.5,             // 중간 모멘텀 1.5%
    MIN_SPARKLINE: 10,    // 최소 스파크라인 데이터 10개
  },
  VOL_PRICE: {
    HIGH_VOL_LOW_PRICE_RATIO: 2.0, // 거래량 2.0배 이상인데 가격 정체 (P1 강화: 1.5→2.0 과도 발화 억제)
    HIGH_VOL_MAX_PRICE: 1.5,       // 가격 변동 1.5% 이하면 정체 (완화: 1→1.5, 2%는 국장 기준 정체 아님)
    BIG_PRICE_MIN: 5,              // 큰 가격 변동 최소 5%
    STRONG_RATIO: 5,               // 거래량 5배 이상 — 강한 누적 시그널
  },
  SMART_MONEY: {
    MIN_DAYS: 2,                 // 외국인+기관 동시 매수/매도 최소 일수
  },
  GAP: {
    MIN_PCT: 2,              // 갭 최소 2% 이상 시 시그널
    MAX_SCORE: 20,           // 최대 점수 ±20
  },
  REBALANCING: {
    BUSINESS_DAYS: 3,        // 월말/분기말 D-3 영업일부터 시그널
    QUARTER_STRENGTH: 4,     // 분기말 strength
    MONTH_STRENGTH: 2,       // 월말 strength
  },
  FX: {
    MIN_CHANGE_PCT: 0.3,     // 환율 변동 최소 0.3% 이상 시 시그널 (완화: 0.5→0.3)
    STRONG_CHANGE_PCT: 1.0,  // 강한 변동 1% 이상
  },
  MARKET_MOOD: {
    DIRECTION_THRESHOLD: 0.5,    // 방향 판단 기준 0.5% (완화: 1→0.5)
    MIN_FLIPS: 2,                // 최소 전환 시장 수
    STALE_MS: 20 * 60 * 1000,    // 이전 상태 유효 시간 20분 (완화: 10분→20분)
  },
  CAPITULATION: {
    PRICE_DROP: -4,              // 가격 하락 -4% 이상 (중간값: -5→-4, -3은 정상 하락 포함 우려)
    VOLUME_RATIO: 3,             // 거래량 평소 3배 이상
    FEAR_GREED_MAX: 30,          // 공포탐욕 30 이하 (중간값: 25→30, 35는 투매 정의 희석 우려)
  },
  STEALTH: {
    VOLUME_RATIO: 2.5,           // 거래량 평소 2.5배 이상 (P1 강화: 2→2.5 과도 발화 억제)
    NEWS_WINDOW_MS: 4 * 3600000, // 4시간 내 뉴스 클러스터 없어야 함
  },
  BTC_LEADING: {
    BTC_MIN_CHANGE: 2,           // BTC 최소 1시간 변동률 2% (완화: 3→2)
    ALT_MAX_CHANGE: 1.5,         // 알트코인 최대 변동률 1.5% (완화: 1→1.5)
    ALT_SYMBOLS: ['ETH', 'SOL', 'XRP', 'DOGE'], // 추적 대상 알트코인
  },
  SUPPORT_RESISTANCE: {
    CLUSTER_PCT: 2,              // 가격 수준 클러스터 범위 2%
    MIN_TOUCHES: 2,              // 지지/저항 최소 접촉 횟수
    BREAK_PCT: 1,                // 돌파 판정 최소 이탈 1%
    LOOKBACK_DAYS: 60,           // 60일 캔들 데이터
  },
  DOUBLE_BOTTOM: {
    PRICE_TOLERANCE: 3,          // 두 바닥 가격 차이 최대 3%
    NECKLINE_MIN_PCT: 5,         // 넥라인 최소 높이 (바닥 대비 5%)
    LOOKBACK_DAYS: 60,           // 60일 캔들 데이터
  },
  RECOVERY: {
    DRAWDOWN_MIN: -7,            // 5일 최대 낙폭 -7% 이상 (완화: -10→-7)
    DRAWDOWN_DAYS: 5,            // 낙폭 측정 기간 5일
    BB_BANDWIDTH_SHRINK: 0.7,    // BB 밴드폭 이전 대비 70% 이하로 축소
    VOLUME_NORMALIZE_RATIO: 1.5, // 거래량 정상화 (1.5배 이하)
  },
  SECTOR_OUTLIER: {
    MIN_DEVIATION: 2.0,          // 섹터 평균 대비 최소 2.0σ 이탈 (P1 강화: 1.5→2.0 과도 발화 억제)
    MIN_SECTOR_SIZE: 3,          // 섹터 최소 종목 수
  },
  NEWS_CLUSTER: {
    WINDOW_MS: 4 * 3600000,      // 4시간 (원본 유지 — 8h는 집중 아님)
    MIN_CLUSTER: 3,              // P1 강화: 2→3 (#221 시그널 품질 개선)
  },
};
