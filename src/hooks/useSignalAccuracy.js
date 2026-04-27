// 시그널 적중률 조회 훅 — GET /api/signal-accuracy
import { useQuery } from '@tanstack/react-query';

// 제거된 레거시 시그널 타입 — Supabase 과거 레코드 차단 (#162 whale 제거 후속)
// 향후 Supabase 뷰 마이그레이션으로 whale_* 레코드 정리 완료 시 이 Set 제거
const LEGACY_SIGNAL_TYPES = new Set([
  // 제거된 whale 시그널 (#162)
  'whale_exchange_inflow',
  'whale_exchange_outflow',
  'whale_stablecoin_inflow',
  'whale_large_single',
  // trading-signal-bot 모델 타입 — v5 공용 signal_history 분리 전(~2026-04-17) 레코드
  'DNA', 'QUANT', 'SENSE', 'WALL_ST', 'SHARK', 'CONSENSUS',
]);

// 성적표에 표시되어야 할 전체 봇 타입 목록 (SignalScorecardTab의 BOT_CATEGORIES와 동기화)
const ALL_BOT_TYPES = [
  // event
  'foreign_consecutive_buy', 'foreign_consecutive_sell',
  'institutional_consecutive_buy', 'institutional_consecutive_sell',
  'volume_anomaly', 'fear_greed_shift',
  'news_sentiment_cluster', 'sector_rotation', 'put_call_ratio',
  'funding_rate_extreme', 'order_flow_imbalance', 'social_sentiment',
  'sentiment_divergence', 'market_mood_shift', 'smart_money_flow',
  // quant
  'composite_score',
  // pattern
  'gap_analysis', 'rebalancing_alert', 'fx_impact', 'capitulation',
  'stealth_activity', 'btc_leading', 'support_resistance_break',
  'double_bottom', 'recovery_detection', 'sector_outlier',
  'vwap_deviation', 'cross_market_correlation',
  'momentum_divergence', 'volume_price_divergence',
];

async function fetchSignalAccuracy() {
  const res = await fetch('/api/signal-accuracy');
  if (!res.ok) throw new Error('signal-accuracy fetch failed');
  const data = await res.json();
  return data.accuracy || [];
}

/**
 * 시그널 봇 적중률 데이터 조회
 * @returns {{ bots: Array, overallAccuracy: number, isLoading: boolean, botMap: Map }}
 */
export function useSignalAccuracy() {
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['signal-accuracy'],
    queryFn: fetchSignalAccuracy,
    staleTime: 5 * 60_000,       // 5분 캐시
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    placeholderData: [],
  });

  // 봇별 데이터 가공 — 레거시 타입(whale_*) 선차단
  const apiBotsMap = new Map(
    raw
      .filter((row) => !LEGACY_SIGNAL_TYPES.has(row.signal_type))
      .map((row) => [
        row.signal_type,
        {
          type: row.signal_type,
          totalFired: row.total_fired ?? 0,
          hitCount: row.hit_count ?? 0,
          accuracy: row.accuracy ?? 0,
          accuracy1h: row.accuracy_1h ?? null,
          accuracy4h: row.accuracy_4h ?? null,
          accuracy24h: row.accuracy_24h ?? null,
          trend: row.trend ?? 0,
          recentResults: row.recent_results ?? [],    // boolean[] — 최근 적중 여부
          recentSignals: row.recent_signals ?? [],    // 최근 시그널 상세
          isMissing: false,
        },
      ])
  );

  // API에 없는 봇도 "집계 중" 상태로 포함 (레거시 제외)
  const missingBots = ALL_BOT_TYPES
    .filter((t) => !apiBotsMap.has(t) && !LEGACY_SIGNAL_TYPES.has(t))
    .map((t) => ({
      type: t,
      totalFired: 0,
      hitCount: 0,
      accuracy: 0,
      accuracy1h: null,
      accuracy4h: null,
      accuracy24h: null,
      trend: 0,
      recentResults: [],
      recentSignals: [],
      isMissing: true,
    }));

  const bots = [...apiBotsMap.values(), ...missingBots];

  // 전체 평균 적중률 — isMissing 봇은 분모에서 제외
  const activeBots = bots.filter((b) => !b.isMissing);
  const totalFiredSum = activeBots.reduce((s, b) => s + b.totalFired, 0);
  const hitSum = activeBots.reduce((s, b) => s + b.hitCount, 0);
  const overallAccuracy = totalFiredSum > 0 ? Math.round((hitSum / totalFiredSum) * 100) : 0;

  // 타입별 빠른 조회용 Map
  const botMap = new Map(bots.map((b) => [b.type, b]));

  return { bots, overallAccuracy, isLoading, botMap };
}
