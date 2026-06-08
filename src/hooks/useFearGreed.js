// 공포탐욕지수 훅 — 코인(Alternative.me) + 미장(CNN Money) + 국장(VKOSPI + 외국인)
// Alternative.me: CORS 지원, 직접 호출 가능
// CNN Money / 국장: CORS 차단 → 통합 게이트웨이 /api/d 프록시 경유
//
// ⚠️ fear_greed_shift 시그널 발화는 제거됨 (#366, signal-overhaul-2026-06-08) —
//    데이터 포렌식 결과 측정 결함·적중률 미입증. F&G 점수 데이터 쿼리(useFearGreedScores)는
//    다른 곳(점수 표시 등)에서 사용하므로 보존한다.
import { useQuery } from '@tanstack/react-query';

// 점수 → 레이블 매핑
export function getFgLabel(score) {
  if (score == null) return '';
  if (score <= 24)  return '극단적 공포';
  if (score <= 44)  return '공포';
  if (score <= 55)  return '중립';
  if (score <= 74)  return '탐욕';
  return '극단적 탐욕';
}

// 점수 → 색상
export function getFgColor(score) {
  if (score == null) return '#8B95A1';
  if (score <= 24)  return '#F04452';  // 극단적 공포 — 빨강
  if (score <= 44)  return '#FF6B35';  // 공포 — 주황
  if (score <= 55)  return '#8B95A1';  // 중립 — 회색
  if (score <= 74)  return '#2AC769';  // 탐욕 — 녹색
  return '#00B894';                    // 극단적 탐욕 — 진녹색
}

async function fetchCryptoFG() {
  const res = await fetch('https://api.alternative.me/fng/', {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Alternative.me ${res.status}`);
  const data = await res.json();
  const entry = data?.data?.[0];
  return {
    score: Number(entry?.value ?? 0),
    rating: entry?.value_classification ?? '',
  };
}

import { fetchFearGreed as gwFearGreed, fetchKrFearGreed as gwKrFearGreed } from '../api/_gateway.js';

async function fetchUsFG() {
  return gwFearGreed(8000);
}

async function fetchKrFG() {
  return gwKrFearGreed(8000);
}

// 3개 시장 F&G 쿼리 — useFearGreedScores/useFearGreed 양쪽에서 공유
function useFearGreedQueries() {
  const crypto = useQuery({ queryKey: ['fearGreed', 'crypto'], queryFn: fetchCryptoFG, staleTime: 15 * 60 * 1000, refetchInterval: 30 * 60 * 1000, refetchIntervalInBackground: false, retry: 1 });
  const us = useQuery({ queryKey: ['fearGreed', 'us'], queryFn: fetchUsFG, staleTime: 15 * 60 * 1000, refetchInterval: 30 * 60 * 1000, refetchIntervalInBackground: false, retry: 1 });
  const kr = useQuery({ queryKey: ['fearGreed', 'kr'], queryFn: fetchKrFG, staleTime: 10 * 60 * 1000, refetchInterval: 15 * 60 * 1000, refetchIntervalInBackground: false, retry: 1 });
  return { crypto, us, kr };
}

// 데이터 전용 — 시그널 발화 없음. useInvestorSignals 등 내부 훅에서 사용.
export function useFearGreedScores() {
  return useFearGreedQueries();
}

// 데이터 전용 — fear_greed_shift 시그널 발화는 제거됨 (#366). 점수 데이터만 반환.
export function useFearGreed() {
  return useFearGreedQueries();
}
