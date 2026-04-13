// 시장 온도 계산 유틸리티 — MarketSentimentWidget에서 추출
import { getPct } from '../components/home/utils';

function labelFromScore(score, { directionalCount = 0, recentDirectionalCount = 0 } = {}) {
  const hasModerateCoverage = directionalCount >= 4;
  const hasStrongCoverage = directionalCount >= 8 && recentDirectionalCount >= 3;

  if (score <= -0.6) return hasStrongCoverage ? '강한 경계' : '약세 우위';
  if (score <= -0.22) return hasModerateCoverage ? '약세 우위' : '중립';
  if (score < 0.22) return '중립';
  if (score < 0.6) return hasModerateCoverage ? '강세 징후' : '중립';
  return hasStrongCoverage ? '강한 강세' : '강세 징후';
}

// ── 시그널 기반 온도 계산 ──
export function calcTemperature(signals) {
  if (!signals.length) {
    return {
      score: 0,
      label: '중립',
      count: 0,
      bullCount: 0,
      bearCount: 0,
      neutralCount: 0,
      directionalCount: 0,
      recentDirectionalCount: 0,
      freshness: 0,
      latestSignalAt: null,
    };
  }

  const now = Date.now();
  const recentWindowMs = 3 * 60 * 1000;
  let bullWeight = 0;
  let bearWeight = 0;
  let neutralCount = 0;
  let bullCount = 0;
  let bearCount = 0;
  let directionalCount = 0;
  let recentDirectionalCount = 0;
  let freshnessSum = 0;
  let latestSignalAt = 0;

  for (const sig of signals) {
    const createdAt = sig.timestamp ?? now;
    const ttl = Math.max(1, (sig.expiresAt ?? now) - createdAt);
    const age = Math.max(0, now - createdAt);
    const freshness = Math.max(0.35, 1 - (age / ttl) * 0.65);
    const weight = (sig.strength || 1) * freshness;

    latestSignalAt = Math.max(latestSignalAt, createdAt);
    freshnessSum += freshness;

    if (sig.direction === 'bullish') {
      bullWeight += weight;
      bullCount++;
      directionalCount++;
      if (age <= recentWindowMs) recentDirectionalCount++;
    } else if (sig.direction === 'bearish') {
      bearWeight += weight;
      bearCount++;
      directionalCount++;
      if (age <= recentWindowMs) recentDirectionalCount++;
    } else {
      neutralCount++;
    }
  }

  const total = bullWeight + bearWeight;
  const rawScore = total === 0 ? 0 : (bullWeight - bearWeight) / total;
  const coverage = Math.min(1, directionalCount / 8);
  const recency = Math.min(1, recentDirectionalCount / 4);
  const confidence = directionalCount === 0 ? 0 : Math.max(0.3, (coverage * 0.65) + (recency * 0.35));
  const score = rawScore * confidence;
  const label = labelFromScore(score, { directionalCount, recentDirectionalCount });

  return {
    score,
    rawScore,
    label,
    count: signals.length,
    bullCount,
    bearCount,
    neutralCount,
    directionalCount,
    recentDirectionalCount,
    freshness: signals.length ? freshnessSum / signals.length : 0,
    latestSignalAt: latestSignalAt || null,
  };
}

// ── 가격 기반 fallback 온도 계산 ──
export function calcFallbackTemperature(allItems) {
  if (!allItems?.length) return null;
  const groups = { KR: [], US: [], COIN: [] };

  for (const item of allItems) {
    const pct = getPct(item);
    if (!Number.isFinite(pct)) continue;
    const market = item._market || (item.id || item.market === 'coin' ? 'COIN' : item.market === 'kr' ? 'KR' : item.market === 'us' ? 'US' : null);
    if (market && groups[market]) groups[market].push(pct);
  }

  const activeMarkets = Object.entries(groups).filter(([, values]) => values.length > 0);
  if (!activeMarkets.length) return null;

  const marketScores = activeMarkets.map(([market, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const trim = sorted.length >= 8 ? Math.floor(sorted.length * 0.15) : 0;
    const trimmed = trim > 0 ? sorted.slice(trim, sorted.length - trim) : sorted;
    const avg = trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
    const score = Math.max(-1, Math.min(1, avg / 3.5));
    return { market, avgPct: avg, score, count: values.length };
  });

  const score = marketScores.reduce((sum, market) => sum + market.score, 0) / marketScores.length;
  const avgPct = marketScores.reduce((sum, market) => sum + market.avgPct, 0) / marketScores.length;
  const label = labelFromScore(score, {
    directionalCount: marketScores.length * 3,
    recentDirectionalCount: marketScores.length * 2,
  });

  return { score, label, avgPct, marketScores, partial: marketScores.length < 2 };
}

export function mergeTemperature(signalTemp, fallbackTemp) {
  if (!fallbackTemp) return { ...signalTemp, source: 'signals' };
  if (fallbackTemp.partial) {
    if (!signalTemp?.count) return { score: 0, label: '중립', count: 0, source: 'pending' };
    return { ...signalTemp, source: 'signals' };
  }
  if (!signalTemp?.count) return { ...fallbackTemp, count: 0, source: 'fallback' };

  const directionalCount = signalTemp.directionalCount ?? 0;
  const recentDirectionalCount = signalTemp.recentDirectionalCount ?? 0;
  const shouldBlend = directionalCount < 6 || recentDirectionalCount < 3;
  if (!shouldBlend) return { ...signalTemp, source: 'signals' };

  const signalWeight = directionalCount < 4 ? 0.4 : 0.6;
  const fallbackWeight = 1 - signalWeight;
  const score = (signalTemp.score * signalWeight) + (fallbackTemp.score * fallbackWeight);
  const label = labelFromScore(score, { directionalCount, recentDirectionalCount });

  return {
    ...signalTemp,
    score,
    label,
    fallbackScore: fallbackTemp.score,
    fallbackLabel: fallbackTemp.label,
    source: 'blended',
  };
}
