// 시그널 임계값 단일 소스 — signalEngine.js + DerivativesWidget.jsx 모두 여기서 import
//
// ⚠️ #366 (signal-overhaul-2026-06-08): 죽은 시그널 26종 제거에 따라 그 전용 임계값
//    (SOCIAL/CROSS_MARKET/SENTIMENT_DIV/MOMENTUM/VOL_PRICE/SMART_MONEY/GAP/REBALANCING/FX/
//     MARKET_MOOD/CAPITULATION/STEALTH/BTC_LEADING/SECTOR_OUTLIER/RECOVERY/NEWS_CLUSTER)도 제거됨.
//    PCR/FUNDING/ORDER_FLOW는 compositeScorer.js(KEEP) + DerivativesWidget.jsx가 독립 소비하므로 보존.
//    SUPPORT_RESISTANCE/DOUBLE_BOTTOM은 KEEP 패턴(서버 발화)용으로 보존.
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
};
