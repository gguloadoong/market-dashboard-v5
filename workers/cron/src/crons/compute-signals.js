// crons/compute-signals.js — 서버 사전계산 시그널 (CF Workers)
// Phase 1: COMPOSITE_SCORE (cross-section-v1) — Hot 200 × 3마켓 → 최대 50 시그널
// Phase 2 (future): DOUBLE_BOTTOM / RECOVERY_DETECTION (히스토리 KV 적재 후 구현)

import {
  getSnap, setSnap, SNAP_KEYS,
  recordCronFailure, recordCronSuccess,
} from '../price-cache.js';

const SIGNALS_KEY = 'signals:latest';
const SIGNALS_TTL = 1200;             // 20분 — 10분 크론 × 2배 버퍼
const COMPOSITE_SCORE_EXPIRE_MS = 15 * 60 * 1000; // client signalTypes.js SIGNAL_TTL[COMPOSITE_SCORE]와 동기화
const MAX_SIGNALS = 50;
const SCORE_THRESHOLD = 30;           // |score| >= 30 발화

function clip(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// KR 장 활성 — UTC 0-11, 23시 / 일~금 (KST 09:00-18:00 커버, index.js와 동일 기준)
function isKrActive() {
  const now = new Date();
  const h = now.getUTCHours();
  const d = now.getUTCDay();
  return (d >= 0 && d <= 5) && (h <= 11 || h === 23);
}

// US 장 활성 — UTC 0-1, 8-23시 / 월~토 (EDT/EST 프리~애프터, index.js와 동일 기준)
function isUsActive() {
  const now = new Date();
  const h = now.getUTCHours();
  const d = now.getUTCDay();
  return (d >= 1 && d <= 6) && (h <= 1 || h >= 8);
}

// 시장별 COMPOSITE_SCORE 계산
// score = 0.50 × clip(changePct / 5.0, -1, +1) × 100   (모멘텀: 5% = saturate)
//       + 0.30 × clip(log10(volume / volMedian), -1, +1) × 100  (거래량 Z: 10배 = saturate)
//       + 0.20 × clip(changePct - mktAvg, -1, +1) × 100  (상대시장: ±1%p = saturate — 빠른 이탈 의도)
function computeMarketScores(items) {
  if (!items || items.length === 0) return [];

  const mktAvg = items.reduce((s, i) => s + (i.changePct || 0), 0) / items.length;

  const volumes = items.map(i => i.volume || 0).filter(v => v > 0).sort((a, b) => a - b);
  const volMedian = volumes.length > 0 ? volumes[Math.floor(volumes.length / 2)] : 1;

  return items.map(item => {
    const changePct = item.changePct || 0;
    const volume    = Math.max(item.volume || 0, 1);

    const momentum = clip(changePct / 5.0, -1, 1) * 100;
    const volumeZ  = clip(Math.log10(volume / volMedian), -1, 1) * 100;
    const relMkt   = clip(changePct - mktAvg, -1, 1) * 100;
    const score    = 0.50 * momentum + 0.30 * volumeZ + 0.20 * relMkt;

    return { item, score, breakdown: { momentum, volumeZ, relMkt } };
  });
}

function buildSignal(item, score, breakdown) {
  const absScore  = Math.abs(score);
  // direction은 실제 가격 방향(changePct)으로 — volumeZ 가중치가 부호를 뒤집는 오라벨 방지 (#300)
  const changePct = item.changePct || 0;
  const direction = changePct > 0 ? 'bullish' : changePct < 0 ? 'bearish' : 'neutral';
  const strength  = absScore >= 70 ? 4 : 3;
  const sign      = changePct > 0 ? '+' : '';
  const arrow     = direction === 'bullish' ? '▲' : direction === 'bearish' ? '▼' : '—';
  const title     = `${arrow} ${item.name} ${sign}${changePct.toFixed(1)}%`;

  return {
    // 안정 키 — timestamp 제외로 동일 종목이 10분마다 "새 카드"로 인식되지 않음
    id:        `cs_${item.market}_${item.symbol}`,
    type:      'composite_score',
    symbol:    item.symbol,
    name:      item.name,
    market:    item.market, // 'kr' | 'us' | 'crypto'
    direction,
    strength,
    title,
    timestamp: Date.now(),
    expiresAt: Date.now() + COMPOSITE_SCORE_EXPIRE_MS,
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
  try {
    // 3마켓 Hot 200 동시 로드 (3 subrequest — CF 50 한도 이내)
    const [krHot, usHot, coinsHot] = await Promise.all([
      getSnap(SNAP_KEYS.KR_HOT),
      getSnap(SNAP_KEYS.US_HOT),
      getSnap(SNAP_KEYS.COINS_HOT),
    ]);

    // 장 마감 시간대에는 KR/US 시그널 생성 스킵 (stale 스냅에서 허위 발화 방어)
    const krItems = isKrActive() && Array.isArray(krHot) ? krHot : [];
    const usItems = isUsActive() && Array.isArray(usHot) ? usHot : [];
    // 코인 필드 정규화: snap 저장 필드(priceKrw/change24h/accTradePrice24h) → 공통 필드명으로 변환
    // market도 'crypto'로 강제 — signalEngine.js 컨벤션 (update-coins.js는 'coin'으로 저장)
    const coinsItems = Array.isArray(coinsHot)
      ? coinsHot.map(i => ({
          ...i,
          price:     i.priceKrw        ?? i.price     ?? 0,
          changePct: i.change24h       ?? i.changePct ?? 0,
          volume:    i.accTradePrice24h ?? i.volume    ?? 0,
          market:    'crypto',
        }))
      : [];

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
    await recordCronSuccess('compute-signals');

    console.info(
      `[compute-signals] ${signals.length}개 저장 ` +
      `(kr:${krItems.length} us:${usItems.length} coins:${coinsItems.length})`,
    );

    return {
      ok: true,
      count: signals.length,
      markets: { kr: krItems.length, us: usItems.length, coins: coinsItems.length },
    };
  } catch (e) {
    console.error('[compute-signals] 실패:', e?.message || e);
    try { await recordCronFailure('compute-signals', String(e?.message || e)); } catch (_) {}
    throw e;
  }
}
