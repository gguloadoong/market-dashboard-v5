// crons/compute-signals.js — 서버 사전계산 시그널 (CF Workers)
// Phase 1: COMPOSITE_SCORE (cross-section-v1) — Hot 200 × 3마켓 → 최대 50 시그널
// Phase 2 (future): DOUBLE_BOTTOM / RECOVERY_DETECTION (히스토리 KV 적재 후 구현)

import { getSnap, setSnap, SNAP_KEYS } from '../price-cache.js';

const SIGNALS_KEY = 'signals:latest';
const SIGNALS_TTL = 1200; // 20분 — 10분 크론 × 2배 버퍼
const MAX_SIGNALS = 50;
const SCORE_THRESHOLD = 30; // |score| >= 30 발화

function clip(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// 시장별 COMPOSITE_SCORE 계산
// score = 0.50 × clip(changePct / 5.0, -1, +1) × 100   (모멘텀)
//       + 0.30 × clip(log10(volume / volMedian), -1, +1) × 100  (거래량 Z)
//       + 0.20 × clip(changePct - mktAvg, -1, +1) × 100          (상대 시장)
function computeMarketScores(items) {
  if (!items || items.length === 0) return [];

  const mktAvg = items.reduce((s, i) => s + (i.changePct || 0), 0) / items.length;

  const volumes = items.map(i => i.volume || 0).filter(v => v > 0).sort((a, b) => a - b);
  const volMedian = volumes.length > 0 ? volumes[Math.floor(volumes.length / 2)] : 1;

  return items.map(item => {
    const changePct = item.changePct || 0;
    const volume = Math.max(item.volume || 0, 1);

    const momentum = clip(changePct / 5.0, -1, 1) * 100;
    const volumeZ  = clip(Math.log10(volume / volMedian), -1, 1) * 100;
    const relMkt   = clip(changePct - mktAvg, -1, 1) * 100;
    const score    = 0.50 * momentum + 0.30 * volumeZ + 0.20 * relMkt;

    return { item, score, breakdown: { momentum, volumeZ, relMkt } };
  });
}

function buildSignal(item, score, breakdown) {
  const absScore  = Math.abs(score);
  const direction = score >= 0 ? 'bullish' : 'bearish';
  const strength  = absScore >= 70 ? 4 : 3;
  const sign      = (item.changePct || 0) >= 0 ? '+' : '';
  const title     = `${direction === 'bullish' ? '▲' : '▼'} ${item.name} ${sign}${(item.changePct || 0).toFixed(1)}%`;

  return {
    id:        `cs_${item.market}_${item.symbol}_${Date.now()}`,
    type:      'composite_score',
    symbol:    item.symbol,
    name:      item.name,
    market:    item.market, // 'kr' | 'us' | 'crypto' — signalEngine.js 컨벤션
    direction,
    strength,
    title,
    timestamp: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000,
    meta: {
      compositeScore: Math.round(score * 10) / 10,
      method: 'cross-section-v1',
      breakdown: {
        momentum: Math.round(breakdown.momentum * 10) / 10,
        volumeZ:  Math.round(breakdown.volumeZ  * 10) / 10,
        relMkt:   Math.round(breakdown.relMkt   * 10) / 10,
      },
      currentPrice: item.price || 0,
      changePct:    item.changePct || 0,
    },
  };
}

export async function computeSignals(env) {
  // 3마켓 Hot 200 동시 로드 (3 subrequest — CF 50 한도 이내)
  const [krHot, usHot, coinsHot] = await Promise.all([
    getSnap(SNAP_KEYS.KR_HOT),
    getSnap(SNAP_KEYS.US_HOT),
    getSnap(SNAP_KEYS.COINS_HOT),
  ]);

  const krItems    = Array.isArray(krHot)    ? krHot    : [];
  const usItems    = Array.isArray(usHot)    ? usHot    : [];
  // 코인 market 필드 강제 'crypto' — signalEngine.js 컨벤션 (snap 저장 시 'crypto'이지만 방어적 정규화)
  const coinsItems = (Array.isArray(coinsHot) ? coinsHot : []).map(i => ({ ...i, market: 'crypto' }));

  // 시장별 스코어 계산 → |score| >= SCORE_THRESHOLD 필터
  const candidates = [
    ...computeMarketScores(krItems),
    ...computeMarketScores(usItems),
    ...computeMarketScores(coinsItems),
  ].filter(c => Math.abs(c.score) >= SCORE_THRESHOLD);

  // 절대 점수 내림차순 → 상위 MAX_SIGNALS
  candidates.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const top = candidates.slice(0, MAX_SIGNALS);

  const signals = top.map(({ item, score, breakdown }) => buildSignal(item, score, breakdown));

  const payload = {
    ts:          Date.now(),
    generatedAt: new Date().toISOString(),
    count:       signals.length,
    signals,
  };

  await setSnap(SIGNALS_KEY, payload, SIGNALS_TTL);

  console.info(
    `[compute-signals] ${signals.length}개 저장 ` +
    `(kr:${krItems.length} us:${usItems.length} coins:${coinsItems.length})`,
  );

  return {
    ok: true,
    count: signals.length,
    markets: { kr: krItems.length, us: usItems.length, coins: coinsItems.length },
  };
}
