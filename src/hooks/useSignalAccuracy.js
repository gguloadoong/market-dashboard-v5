// 시그널 적중률 조회 훅 — GET /api/signal-accuracy
import { useQuery } from '@tanstack/react-query';

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

  // 봇별 데이터 가공
  const bots = raw.map((row) => ({
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
