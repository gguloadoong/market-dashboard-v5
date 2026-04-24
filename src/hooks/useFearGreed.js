// 공포탐욕지수 훅 — 코인(Alternative.me) + 미장(CNN Money) + 국장(VKOSPI + 외국인)
// Alternative.me: CORS 지원, 직접 호출 가능
// CNN Money / 국장: CORS 차단 → 통합 게이트웨이 /api/d 프록시 경유
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { fetchFearGreed as gwFearGreed, fetchKrFearGreed as gwKrFearGreed } from '../api/_gateway.js';
import { createSignal, addSignal, removeSignalByTypeAndSymbol } from '../engine/signalEngine';
import { SIGNAL_TYPES, DIRECTIONS } from '../engine/signalTypes';

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

async function fetchUsFG() {
  return gwFearGreed(8000);
}

async function fetchKrFG() {
  return gwKrFearGreed(8000);
}

// 점수 → 구간 번호 (비교용)
function getZone(score) {
  if (score == null) return -1;
  if (score <= 24) return 0; // 극단적 공포
  if (score <= 44) return 1; // 공포
  if (score <= 55) return 2; // 중립
  if (score <= 74) return 3; // 탐욕
  return 4;                  // 극단적 탐욕
}

// 구간 전환 시 시그널 방향 결정
function getShiftDirection(prevZone, curZone) {
  if (curZone > prevZone) return DIRECTIONS.BULLISH;  // 공포→탐욕 방향
  if (curZone < prevZone) return DIRECTIONS.BEARISH;  // 탐욕→공포 방향
  return null;
}

// F&G 구간 전환 감지 + 시그널 발행 훅
function useFearGreedSignal(score, market, storageKey) {
  const prevRef = useRef(null);
  // 극단값 발화 여부 — localStorage 영속 (새로고침 시 재발화 방지)
  const extremeKey = `fg_extreme_alerted_${storageKey}`;
  const extremeAlertedRef = useRef(localStorage.getItem(extremeKey) === '1');

  useEffect(() => {
    if (score == null) return;

    // 이전 값 복원 (localStorage)
    if (prevRef.current === null) {
      const stored = localStorage.getItem(storageKey);
      prevRef.current = stored != null ? Number(stored) : score;
    }

    const prevZone = getZone(prevRef.current);
    const curZone = getZone(score);

    // 극단값(zone 0=극단적 공포 / zone 4=극단적 탐욕) 우선 처리
    // — getZone 경계(≤24, ≥75)와 단일 소스화하여 라벨/트리거 불일치 방지
    const isExtreme = curZone === 0 || curZone === 4;
    let extremeFired = false;

    if (isExtreme) {
      if (!extremeAlertedRef.current) {
        // curZone === 4 (극단적 탐욕, score ≥75) → 역발상 매도, zone 0 (극단적 공포) → 역발상 매수
        // score >= 80 대신 curZone 기준 — getZone 경계(75)와 일치시켜 라벨↔방향 충돌 방지
        const direction = curZone === 4 ? DIRECTIONS.BEARISH : DIRECTIONS.BULLISH;
        const prevLabel = getFgLabel(prevRef.current);
        const curLabel = getFgLabel(score);
        // 기존 zone-shift 시그널(strength 4) 제거 후 극단값 시그널(strength 5) 발화
        // — TTL 내 기존 시그널이 남아있으면 dedupe로 silent drop되는 버그 방지
        removeSignalByTypeAndSymbol(SIGNAL_TYPES.FEAR_GREED_SHIFT, market);
        const sig = createSignal({
          type: SIGNAL_TYPES.FEAR_GREED_SHIFT,
          symbol: market,
          name: `${market} 공포탐욕`,
          market,
          direction,
          strength: 5,
          title: `${market} ${curLabel} 극단값 (${score}) — 역발상 기회`,
          // from/to 키 — 구간 전환 meta 구조와 동일하게 통일
          meta: {
            from: prevLabel,
            to: curLabel,
            prevScore: prevRef.current,
            curScore: score,
            prevLabel,
            curLabel,
            current: score,
            extreme: true,
          },
        });
        addSignal(sig);
        extremeAlertedRef.current = true;
        localStorage.setItem(extremeKey, '1');
        extremeFired = true;
      }
    } else {
      // 극단 구간 탈출 → 다음 재진입 시 재발화 가능
      extremeAlertedRef.current = false;
      localStorage.removeItem(extremeKey);
    }

    // 구간 전환 — 극단값이 발화된 같은 tick에서는 skip (dedupe 충돌 회피)
    if (!extremeFired && prevZone !== -1 && curZone !== -1 && prevZone !== curZone) {
      const direction = getShiftDirection(prevZone, curZone);
      if (direction) {
        const prevLabel = getFgLabel(prevRef.current);
        const curLabel = getFgLabel(score);
        const sig = createSignal({
          type: SIGNAL_TYPES.FEAR_GREED_SHIFT,
          symbol: market, // 시장별 고유 키 — null이면 3시장 중복 제거됨
          name: `${market} 공포탐욕`,
          market,
          direction,
          strength: Math.abs(curZone - prevZone) >= 2 ? 4 : 2, // 2구간 이상 점프 시 강도 4
          title: `${market} 공포탐욕 구간 전환: ${prevLabel} → ${curLabel}`,
          meta: {
            from: prevLabel,
            to: curLabel,
            prevScore: prevRef.current,
            curScore: score,
            prevLabel,
            curLabel,
            current: score,
          },
        });
        addSignal(sig);
      }
    }

    // 현재 값 저장
    prevRef.current = score;
    localStorage.setItem(storageKey, String(score));
  }, [score, market, storageKey]);
}

// 데이터 전용 — 시그널 발화 없음. useInvestorSignals 등 내부 훅에서 사용.
// useFearGreed()는 시그널 발화 side-effect가 있어 다중 호출 시 중복 발화됨.
export function useFearGreedScores() {
  const crypto = useQuery({
    queryKey: ['fearGreed', 'crypto'],
    queryFn: fetchCryptoFG,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const us = useQuery({
    queryKey: ['fearGreed', 'us'],
    queryFn: fetchUsFG,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const kr = useQuery({
    queryKey: ['fearGreed', 'kr'],
    queryFn: fetchKrFG,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  return { crypto, us, kr };
}

export function useFearGreed() {
  const crypto = useQuery({
    queryKey: ['fearGreed', 'crypto'],
    queryFn: fetchCryptoFG,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const us = useQuery({
    queryKey: ['fearGreed', 'us'],
    queryFn: fetchUsFG,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const kr = useQuery({
    queryKey: ['fearGreed', 'kr'],
    queryFn: fetchKrFG,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  // F&G 구간 전환 시 시그널 엔진에 이벤트 발행
  useFearGreedSignal(crypto.data?.score, 'crypto', 'fg_prev_crypto');
  useFearGreedSignal(us.data?.score, 'us', 'fg_prev_us');
  useFearGreedSignal(kr.data?.score, 'kr', 'fg_prev_kr');

  return { crypto, us, kr };
}
