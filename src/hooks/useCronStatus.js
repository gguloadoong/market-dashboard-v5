// useCronStatus.js — /api/ops/cron-status 폴링 훅 (#164 Phase B)
// 30초 폴링, 공개 모드 응답 사용 (failCount + healthy 불린만).
// 에러 상세는 토큰 필요해서 별도 CLI 에서만 조회.
import { useQuery } from '@tanstack/react-query';

async function fetchCronStatus() {
  const res = await fetch('/api/ops/cron-status', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`ops cron-status HTTP ${res.status}`);
  return res.json();
}

/**
 * @returns {{
 *   status: 'ok' | 'warn' | 'unknown',
 *   unhealthyCount: number,
 *   unhealthyNames: string[],
 *   isLoading: boolean,
 * }}
 */
export function useCronStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['ops-cron-status'],
    queryFn: fetchCronStatus,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
    placeholderData: null,
  });

  if (!data?.crons) {
    return { status: 'unknown', unhealthyCount: 0, unhealthyNames: [], isLoading };
  }

  const names = Object.keys(data.crons);
  const unhealthyNames = names.filter((n) => data.crons[n].healthy === false);
  const status = unhealthyNames.length > 0 ? 'warn' : 'ok';

  return {
    status,
    unhealthyCount: unhealthyNames.length,
    unhealthyNames,
    isLoading,
  };
}
