// 시그널 타입 상수 — 시그널 엔진 전체에서 공유

// 스테이블코인 심볼 집합 — 투자자 시그널 스테이블코인 필터링
export const STABLECOIN_SYMBOLS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD']);

export const SIGNAL_TYPES = {
  FOREIGN_CONSECUTIVE_BUY: 'foreign_consecutive_buy',
  FOREIGN_CONSECUTIVE_SELL: 'foreign_consecutive_sell',
  INSTITUTIONAL_CONSECUTIVE_BUY: 'institutional_consecutive_buy',
  INSTITUTIONAL_CONSECUTIVE_SELL: 'institutional_consecutive_sell',
  VOLUME_ANOMALY: 'volume_anomaly',
  FEAR_GREED_SHIFT: 'fear_greed_shift',
  NEWS_SENTIMENT_CLUSTER: 'news_sentiment_cluster',
  SECTOR_ROTATION: 'sector_rotation',
  PUT_CALL_RATIO: 'put_call_ratio',
  FUNDING_RATE_EXTREME: 'funding_rate_extreme',
  ORDER_FLOW_IMBALANCE: 'order_flow_imbalance',
  VWAP_DEVIATION: 'vwap_deviation',
  SOCIAL_SENTIMENT: 'social_sentiment',
  CROSS_MARKET_CORRELATION: 'cross_market_correlation',
  SENTIMENT_DIVERGENCE: 'sentiment_divergence',
  SMART_MONEY_FLOW: 'smart_money_flow',
  MOMENTUM_DIVERGENCE: 'momentum_divergence',
  VOLUME_PRICE_DIVERGENCE: 'volume_price_divergence',
  MARKET_MOOD_SHIFT: 'market_mood_shift',
  COMPOSITE_SCORE: 'composite_score',
  GAP_ANALYSIS: 'gap_analysis',
  REBALANCING_ALERT: 'rebalancing_alert',
  FX_IMPACT: 'fx_impact',
  CAPITULATION: 'capitulation',
  STEALTH_ACTIVITY: 'stealth_activity',
  BTC_LEADING: 'btc_leading',
  SUPPORT_RESISTANCE_BREAK: 'support_resistance_break',
  DOUBLE_BOTTOM: 'double_bottom',
  RECOVERY_DETECTION: 'recovery_detection',
  SECTOR_OUTLIER: 'sector_outlier',
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
  [SIGNAL_TYPES.FEAR_GREED_SHIFT]: 12 * 3600000,
  [SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER]: 2 * 3600000,
  [SIGNAL_TYPES.SECTOR_ROTATION]: 6 * 3600000,
  [SIGNAL_TYPES.PUT_CALL_RATIO]: 4 * 3600000,
  [SIGNAL_TYPES.FUNDING_RATE_EXTREME]: 8 * 3600000,
  [SIGNAL_TYPES.ORDER_FLOW_IMBALANCE]: 15 * 60000,
  [SIGNAL_TYPES.VWAP_DEVIATION]: 2 * 3600000,
  [SIGNAL_TYPES.SOCIAL_SENTIMENT]: 4 * 3600000,
  [SIGNAL_TYPES.CROSS_MARKET_CORRELATION]: 2 * 3600000,
  [SIGNAL_TYPES.SENTIMENT_DIVERGENCE]: 2 * 3600000,
  [SIGNAL_TYPES.SMART_MONEY_FLOW]: 24 * 3600000,
  [SIGNAL_TYPES.MOMENTUM_DIVERGENCE]: 2 * 3600000,
  [SIGNAL_TYPES.VOLUME_PRICE_DIVERGENCE]: 2 * 3600000,
  [SIGNAL_TYPES.MARKET_MOOD_SHIFT]: 4 * 3600000,
  [SIGNAL_TYPES.COMPOSITE_SCORE]: 15 * 60000, // 15분 (완화: 10분→15분, 5분 크론 × 3)
  [SIGNAL_TYPES.GAP_ANALYSIS]: 4 * 3600000,       // 4시간
  [SIGNAL_TYPES.REBALANCING_ALERT]: 24 * 3600000,  // 24시간
  [SIGNAL_TYPES.FX_IMPACT]: 8 * 3600000,           // 8시간
  [SIGNAL_TYPES.CAPITULATION]: 4 * 3600000,          // 4시간 — 투매 이벤트
  [SIGNAL_TYPES.STEALTH_ACTIVITY]: 2 * 3600000,      // 2시간 — 뉴스 없는 거래 폭발
  [SIGNAL_TYPES.BTC_LEADING]: 2 * 3600000,           // 2시간 — BTC 선행 신호
  [SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK]: 4 * 3600000, // 4시간 — 지지/저항선 돌파
  [SIGNAL_TYPES.DOUBLE_BOTTOM]: 8 * 3600000,         // 8시간 — 이중바닥 패턴
  [SIGNAL_TYPES.RECOVERY_DETECTION]: 6 * 3600000,    // 6시간 — 회복 감지
  [SIGNAL_TYPES.SECTOR_OUTLIER]: 4 * 3600000,        // 4시간 — 섹터 이탈 종목
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

// ── "우리만의 언어" — 일반 투자자가 3초 안에 이해할 수 있는 시그널 설명 ──
// easyLabel: 한 줄 요약 (행동 힌트 + 이모지 강도)
// easyDesc: (meta) => string — 시그널 meta 객체를 받아 동적 메시지 생성
export const TYPE_META = {
  [SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY]: {
    easyLabel: '외국인이 사모으는 중 🔥',
    easyDesc: (m) => `${m.name || '종목'}을 ${m.consecutiveDays || m.days || '?'}일째 외국인이 사고 있어요`,
  },
  [SIGNAL_TYPES.FOREIGN_CONSECUTIVE_SELL]: {
    easyLabel: '외국인이 빠지고 있어요 ⚠️',
    easyDesc: (m) => `${m.name || '종목'}에서 외국인이 ${m.consecutiveDays || m.days || '?'}일째 팔고 있어요`,
  },
  [SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_BUY]: {
    easyLabel: '기관이 담고 있어요 🔥',
    easyDesc: (m) => `기관이 ${m.name || '종목'}을 ${m.consecutiveDays || m.days || '?'}일째 매수 중`,
  },
  [SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_SELL]: {
    easyLabel: '기관이 빠지고 있어요 ⚠️',
    easyDesc: (m) => `기관이 ${m.name || '종목'}에서 ${m.consecutiveDays || m.days || '?'}일째 매도 중`,
  },
  [SIGNAL_TYPES.VOLUME_ANOMALY]: {
    easyLabel: (m) => {
      const pct = m?.changePct ?? 0;
      if (pct <= -1) return '급락 속 거래 폭발 💥';
      if (pct >= 1) return '급등 속 거래 폭발 🔥';
      return '거래가 평소보다 폭발 💥';
    },
    easyDesc: (m) => {
      const pct = m?.changePct ?? 0;
      const name = m?.name || '종목';
      if (pct <= -1) return `${name} 하락 중 거래량 ${m?.ratio || '?'}배 폭발 — 이상 거래량 감지`;
      if (pct >= 1) return `${name} 상승 중 거래량 ${m?.ratio || '?'}배 폭발 — 강한 매수세`;
      return `${name} 거래량이 평소의 ${m?.ratio || '?'}배 — 뭔가 일어나고 있어요`;
    },
  },
  [SIGNAL_TYPES.FEAR_GREED_SHIFT]: {
    easyLabel: '시장 심리가 바뀌고 있어요 🔄',
    easyDesc: (m) => `시장이 ${m.from || '?'}에서 ${m.to || '?'}로 전환 중 — 역발상 기회?`,
  },
  [SIGNAL_TYPES.PUT_CALL_RATIO]: {
    easyLabel: '하락 보험 변동 📊',
    easyDesc: (m) => {
      const pcr = m.pcr ?? m.ratio ?? 0;
      if (pcr > 1) return '하락 보험 급증 — 큰손들이 걱정하는 신호';
      if (pcr < 0.7) return '하락 보험 감소 — 낙관적 분위기';
      return '풋콜비율 중립 구간';
    },
  },
  [SIGNAL_TYPES.FUNDING_RATE_EXTREME]: {
    easyLabel: '레버리지가 한쪽으로 쏠렸어요 ⚡',
    easyDesc: (m) => {
      const rate = m.rate ?? m.fundingRate ?? 0;
      if (rate > 0) return '롱 포지션 과열 — 급락 주의';
      if (rate < 0) return '숏 포지션 과열 — 반등 가능성';
      return '펀딩비 중립';
    },
  },
  [SIGNAL_TYPES.ORDER_FLOW_IMBALANCE]: {
    easyLabel: '매수/매도 힘 균형이 깨졌어요 ⚖️',
    easyDesc: (m) => `지금 ${m.direction === 'bullish' ? '매수' : '매도'}세가 ${m.pct || '?'}% 더 강해요`,
  },
  [SIGNAL_TYPES.VWAP_DEVIATION]: {
    easyLabel: '평균가에서 벗어났어요 📏',
    easyDesc: (m) => {
      const above = (m.deviation ?? 0) > 0;
      return above
        ? '평균보다 비싸게 거래 중 — 과열?'
        : '평균보다 싸게 거래 중 — 기회?';
    },
  },
  [SIGNAL_TYPES.SOCIAL_SENTIMENT]: {
    easyLabel: 'SNS에서 화제 📱',
    easyDesc: (m) => `소셜에서 ${m.symbol || '종목'} 관련 ${m.direction === 'bullish' ? '긍정' : '부정'} 의견이 ${m.pct || '?'}%`,
  },
  [SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER]: {
    easyLabel: '관련 뉴스가 쏟아지고 있어요 📰',
    easyDesc: (m) => `${m.name || '종목'} 관련 뉴스 ${m.count || '다수'}건 집중 — 주목`,
  },
  [SIGNAL_TYPES.SECTOR_ROTATION]: {
    easyLabel: '돈이 섹터로 몰리고 있어요 🔄',
    easyDesc: (m) => `${m.sector || '?'} 섹터 ${m.direction === 'bullish' ? '강세' : '약세'} — 자금 흐름 변화 감지`,
  },
  [SIGNAL_TYPES.CROSS_MARKET_CORRELATION]: {
    easyLabel: '다른 시장이 먼저 움직였어요 🌐',
    easyDesc: (m) => `${m.leaderName || m.leader} ${m.leaderPct > 0 ? '+' : ''}${m.leaderPct}% → ${m.laggerName || m.lagger} ${m.laggerPct > 0 ? '+' : ''}${m.laggerPct}% — 따라갈 수 있어요`,
  },
  [SIGNAL_TYPES.SENTIMENT_DIVERGENCE]: {
    easyLabel: '가격과 뉴스가 엇갈리고 있어요 🤔',
    easyDesc: (m) => `${m.name} ${m.pricePct > 0 ? '오르는데' : '내리는데'} 뉴스는 ${m.avgSentiment > 0 ? '호재' : '악재'} — 괴리 주의`,
  },
  [SIGNAL_TYPES.SMART_MONEY_FLOW]: {
    easyLabel: '외국인+기관 스마트머니 감지 💎',
    easyDesc: (m) => `${m.name}을 외국인(${m.foreignDays}일)+기관(${m.instDays}일) 동시 ${m.action} 중`,
  },
  [SIGNAL_TYPES.MOMENTUM_DIVERGENCE]: {
    easyLabel: '흐름이 바뀌고 있어요 🔀',
    easyDesc: (m) => `${m.name} ${m.shortDirection === 'up' ? '반등' : '꺾임'} 시작 — 최근 5봉 ${m.shortSlope > 0 ? '+' : ''}${m.shortSlope}%`,
  },
  [SIGNAL_TYPES.VOLUME_PRICE_DIVERGENCE]: {
    easyLabel: '거래량과 가격이 따로 놀아요 🧩',
    easyDesc: (m) => m.pattern === 'accumulation' ? `${m.name} 조용히 거래 폭발 — 누군가 모으는 중?` : `${m.name} ${m.pricePct > 0 ? '올랐지만' : '빠졌지만'} 거래량 부족 — 약한 움직임`,
  },
  [SIGNAL_TYPES.MARKET_MOOD_SHIFT]: {
    easyLabel: '시장 분위기 변화 감지 🌊',
    easyDesc: (m) => m.moodType === 'consensus' ? `국장·미장·코인 모두 ${m.direction === 'bullish' ? '상승' : '하락'} — 강한 흐름` : `${m.flippedMarkets.join('·')} 방향 전환 — 변곡점 주의`,
  },
  [SIGNAL_TYPES.GAP_ANALYSIS]: {
    easyLabel: (m) => (m?.gapPct ?? 0) >= 0 ? '갭 상승 출발 🚀' : '갭 하락 출발 ⚡',
    easyDesc: (m) => {
      const pct = m?.gapPct ?? 0;
      if (pct >= 0) return `전일 종가 대비 +${pct.toFixed(1)}% 갭 상승 — 매수세 유입`;
      return `전일 종가 대비 ${pct.toFixed(1)}% 갭 하락 — 매도 압력`;
    },
  },
  [SIGNAL_TYPES.REBALANCING_ALERT]: {
    easyLabel: '기관 리밸런싱 주의 📅',
    easyDesc: (m) => `${m?.isQuarterEnd ? '분기말' : '월말'} D-${m?.daysLeft ?? '?'} — 기관 매물 출회 가능`,
  },
  [SIGNAL_TYPES.FX_IMPACT]: {
    easyLabel: '환율 변동 주의 💱',
    easyDesc: (m) => `원/달러 ${m?.rate ?? '?'}원 (${(m?.change ?? 0) > 0 ? '+' : ''}${(m?.change ?? 0).toFixed(1)}%) — ${m?.impact ?? ''}`,
  },
  [SIGNAL_TYPES.CAPITULATION]: {
    easyLabel: '투매 감지 — 역발상 기회? 🔥',
    easyDesc: (m) => `${m.name || '종목'} 공포 속 투매 발생 — 과거 패턴상 바닥 근처`,
  },
  [SIGNAL_TYPES.STEALTH_ACTIVITY]: {
    easyLabel: '뉴스 없는 거래 폭발 👀',
    easyDesc: (m) => `${m.name || '종목'} 뉴스 없이 거래량 폭발 — 거래 패턴 변화 감지`,
  },
  [SIGNAL_TYPES.BTC_LEADING]: {
    easyLabel: (m) => `BTC 선행 — ${m?.alt || '알트코인'} 따라갈 가능성 🎯`,
    easyDesc: (m) => `BTC ${(m?.btcChange ?? 0) > 0 ? '+' : ''}${(m?.btcChange ?? 0).toFixed(1)}% 움직임 — ${m?.alt || '알트코인'} 아직 미반영`,
  },
  [SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK]: {
    easyLabel: (m) => m?.breakType === 'resistance' ? '저항선 뚫고 올라갔어요 🚀' : '지지선 깨졌어요 ⚠️',
    easyDesc: (m) => m?.breakType === 'resistance'
      ? `${m.name || '종목'} ${m.level?.toLocaleString() || '?'}원 저항선 돌파 — 상승 탄력`
      : `${m.name || '종목'} ${m.level?.toLocaleString() || '?'}원 지지선 이탈 — 추가 하락 주의`,
  },
  [SIGNAL_TYPES.DOUBLE_BOTTOM]: {
    easyLabel: (m) => m?.broken
      ? '바닥 두 번 찍고 돌파 🚀'
      : '바닥 두 번 — 반등 시도 중 📈',
    easyDesc: (m) => `${m.name || '종목'} ${m.bottom1?.toLocaleString() || '?'}원 근처에서 두 번 바닥 형성 — 넥라인 ${m.neckline?.toLocaleString() || '?'}원 ${m.broken ? '돌파됨' : '돌파 시 반등'}`,
  },
  [SIGNAL_TYPES.RECOVERY_DETECTION]: {
    easyLabel: '급락 후 진정세 — 반등 가능성 🌱',
    easyDesc: (m) => `${m.name || '종목'} ${Math.abs(m?.drawdown ?? 0).toFixed(1)}% 급락 후 변동성 축소 — 회복 신호`,
  },
  [SIGNAL_TYPES.SECTOR_OUTLIER]: {
    easyLabel: (m) => m?.above ? '섹터 대비 급등 — 독자 강세 💪' : '섹터 대비 급락 — 이탈 주의 ⚠️',
    easyDesc: (m) => m?.above
      ? `${m.name || '종목'} 섹터 평균 대비 ${m.deviation?.toFixed(1) || '?'}σ 초과 상승 — 독자 행보`
      : `${m.name || '종목'} 섹터 평균 대비 ${Math.abs(m?.deviation ?? 0).toFixed(1)}σ 이탈 하락 — 개별 악재 의심`,
  },
  [SIGNAL_TYPES.COMPOSITE_SCORE]: {
    easyLabel: (m) => {
      const s = m?.compositeScore ?? 0;
      if (s >= 70) return '여러 지표 동시 강세 🔥';
      if (s >= 30) return '오를 분위기 감지 중 📈';
      if (s <= -70) return '여러 지표 동시 약세 🚨';
      if (s <= -30) return '내릴 분위기 감지 ⚠️';
      return '방향 탐색 중 👀';
    },
    easyDesc: (m) => {
      const parts = [];
      if (m?.rsi != null) parts.push(`RSI ${m.rsi}`);
      if (m?.macd != null) parts.push(`MACD ${m.macd > 0 ? '상승' : '하락'}`);
      return `복합 분석 점수 ${m?.compositeScore > 0 ? '+' : ''}${m?.compositeScore ?? 0}${parts.length ? ` (${parts.join(', ')})` : ''}`;
    },
  },
};
