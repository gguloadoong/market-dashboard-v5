// 시장 온도 계산 유틸리티 — MarketSentimentWidget에서 추출
import { getPct } from '../components/home/utils';

// ── 시그널 기반 온도 계산 ──
export function calcTemperature(signals) {
  if (!signals.length) return { score: 0, label: '중립', count: 0, bullCount: 0, bearCount: 0, neutralCount: 0 };
  let bullWeight = 0, bearWeight = 0, neutralCount = 0;
  for (const sig of signals) {
    const w = sig.strength || 1;
    if (sig.direction === 'bullish') bullWeight += w;
    else if (sig.direction === 'bearish') bearWeight += w;
    else neutralCount++;
  }
  const total = bullWeight + bearWeight;
  const score = total === 0 ? 0 : (bullWeight - bearWeight) / total;
  // 시그널 3개 미만이면 극단 라벨 방지 — 최대 "중립"까지만 허용
  const hasEnoughSignals = signals.length >= 3;
  let label;
  if (score <= -0.5) label = hasEnoughSignals ? '강한 경계' : '중립';
  else if (score <= -0.15) label = hasEnoughSignals ? '약세 우위' : '중립';
  else if (score < 0.15) label = '중립';
  else if (score < 0.5) label = hasEnoughSignals ? '강세 징후' : '중립';
  else label = hasEnoughSignals ? '강한 강세' : '중립';
  return { score, label, count: signals.length,
    bullCount: signals.filter(s => s.direction === 'bullish').length,
    bearCount: signals.filter(s => s.direction === 'bearish').length,
    neutralCount };
}

// ── 가격 기반 fallback 온도 계산 ──
export function calcFallbackTemperature(allItems) {
  if (!allItems?.length) return null;
  const pcts = allItems.map(i => getPct(i)).filter(p => !isNaN(p));
  if (!pcts.length) return null;
  const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  // 평균 등락률을 -1 ~ +1 스코어로 변환 (+-5% 기준 클램핑)
  const score = Math.max(-1, Math.min(1, avg / 5));
  let label;
  if (score <= -0.5) label = '강한 경계';
  else if (score <= -0.15) label = '약세 우위';
  else if (score < 0.15) label = '중립';
  else if (score < 0.5) label = '강세 징후';
  else label = '강한 강세';
  return { score, label, avgPct: avg };
}
