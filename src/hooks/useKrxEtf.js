// KRX ETF 전체 목록 — 앱 로드 시 1회 fetch, 6시간 캐싱
import { useQuery } from '@tanstack/react-query';
import { fetchKrxEtf as gwKrxEtf } from '../api/_gateway.js';
import { useAfterIdle } from './useAfterIdle';

async function fetchKrxEtf() {
  const data = await gwKrxEtf();
  return data.etfs ?? [];
}

export function useKrxEtf() {
  // afterIdle 게이팅 (#로딩최적화) — ke는 콜드로드 mount에서 최대 12s+500이라 임계경로에서 가장 무거움.
  // 6h staleTime 정적 데이터라 첫 페인트 비임계 → idle 후 1콜.
  const afterIdle = useAfterIdle();
  return useQuery({
    queryKey:  ['krx-etf'],
    queryFn:   fetchKrxEtf,
    staleTime: 6 * 60 * 60 * 1000, // 6시간
    retry:     1,
    enabled:   afterIdle,
  });
}
