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
  const bots = raw
    .filter((row) => !LEGACY_SIGNAL_TYPES.has(row.signal_type))
    .map((row) => ({
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
    }));

  // 전체 평균 적중률
  const totalFiredSum = bots.reduce((s, b) => s + b.totalFired, 0);
  const hitSum = bots.reduce((s, b) => s + b.hitCount, 0);
  const overallAccuracy = totalFiredSum > 0 ? Math.round((hitSum / totalFiredSum) * 100) : 0;

  // 타입별 빠른 조회용 Map
  const botMap = new Map(bots.map((b) => [b.type, b]));

  return { bots, overallAccuracy, isLoading, botMap };
}
