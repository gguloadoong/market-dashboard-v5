// 시그널 봇 카테고리 — 단일 소스 (SignalScorecardTab + useSignalAccuracy 공용)
export const BOT_CATEGORIES = {
  event: [
    'foreign_consecutive_buy', 'foreign_consecutive_sell',
    'institutional_consecutive_buy', 'institutional_consecutive_sell',
    'volume_anomaly', 'fear_greed_shift',
    'news_sentiment_cluster', 'sector_rotation', 'put_call_ratio',
    'funding_rate_extreme', 'order_flow_imbalance', 'social_sentiment',
    'sentiment_divergence', 'market_mood_shift',
    'smart_money_flow',
  ],
  quant: ['composite_score'],
  pattern: [
    'gap_analysis', 'rebalancing_alert', 'fx_impact', 'capitulation',
    'stealth_activity', 'btc_leading', 'support_resistance_break',
    'double_bottom', 'recovery_detection', 'sector_outlier',
    'vwap_deviation', 'cross_market_correlation',
    'momentum_divergence',
    'volume_price_divergence',
  ],
};
