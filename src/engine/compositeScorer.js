// 복합 스코어링 엔진 — TA + Flow + Sentiment 3-Layer 가중합
// 종목별 방향성 점수 (-100 ~ +100) 산출

import { DIRECTIONS } from './signalTypes';
import { THRESHOLDS } from '../constants/signalThresholds';

// ─── 가중치 상수 ────────────────────────────────────────────
const WEIGHT = {
  ta: 0.40,        // 기술적 분석 (RSI, MACD, BB, MA, 거래량)
  flow: 0.35,      // 자금 흐름 (외국인, 기관, 거래량 가속)
  sentiment: 0.25,  // 심리 (공포탐욕, 펀딩비, PCR)
};

// ─── Flow 점수 계산 ─────────────────────────────────────────
/**
 * 외국인/기관 플로우 → 점수
 * @param {{ foreignBuyDays, foreignSellDays, instBuyDays, instSellDays, volumeRatio }} flow
 * @returns {number} -100 ~ +100
 */
function calcFlowScore(flow) {
  if (!flow) return 0;
  let score = 0;

  // 외국인 연속 매수매도 (15% 가중)
  const { foreignBuyDays = 0, foreignSellDays = 0, instBuyDays = 0, instSellDays = 0 } = flow;
  if (foreignBuyDays >= 3) score += Math.min(40, foreignBuyDays * 8);
  else if (foreignSellDays >= 3) score -= Math.min(40, foreignSellDays * 8);

  // 기관 동향 (10% 가중)
  if (instBuyDays >= 3) score += Math.min(30, instBuyDays * 6);
  else if (instSellDays >= 3) score -= Math.min(30, instSellDays * 6);

  // 스마트머니 부스트: 외국인+기관 동시 매수/매도
  if (foreignBuyDays >= 2 && instBuyDays >= 2) score += 15;
  else if (foreignSellDays >= 2 && instSellDays >= 2) score -= 15;

  // 거래량 가속 (10% 가중) — flow 방향이 있을 때만 부스트, 없으면 중립
  const volRatio = flow.volumeRatio ?? 1;
  if (volRatio >= 2 && score !== 0) {
    score += Math.min(20, (volRatio - 1) * 10) * (score > 0 ? 1 : -1);
  }

  return Math.max(-100, Math.min(100, score));
}

// ─── Sentiment 점수 계산 ────────────────────────────────────
/**
 * 심리 지표 → 점수
 * @param {{ fearGreed, fundingRate, pcr }} sentiment
 * @returns {number} -100 ~ +100
 */
function calcSentimentScore(sentiment) {
  if (!sentiment) return 0;
  let score = 0;

  // 공포탐욕 역발상 (10% 가중)
  const fg = sentiment.fearGreed;
  if (fg != null) {
    if (fg <= 20) score += 30;       // 극단적 공포 → 매수 기회
    else if (fg <= 35) score += 15;  // 공포
    else if (fg >= 80) score -= 30;  // 극단적 탐욕 → 매도 경고
    else if (fg >= 65) score -= 15;  // 탐욕
  }

  // 펀딩비 역발상 (8% 가중) — 과열 시 반대 방향
  const fr = sentiment.fundingRate;
  if (fr != null) {
    const frPct = fr * 100;
    if (frPct > 0.05) score -= Math.min(25, frPct * 300);  // 롱 과열
    else if (frPct < -0.05) score += Math.min(25, Math.abs(frPct) * 300); // 숏 과열
  }

  // PCR 역발상 (7% 가중)
  const pcr = sentiment.pcr;
  if (pcr != null) {
    if (pcr > THRESHOLDS.PCR.BULLISH) score += 20;
    else if (pcr > THRESHOLDS.PCR.CAUTION_HIGH) score += 10;
    else if (pcr < THRESHOLDS.PCR.BEARISH) score -= 20;
    else if (pcr < THRESHOLDS.PCR.CAUTION_LOW) score -= 10;   // 0.70~0.80: 약한 탐욕
    else if (pcr < THRESHOLDS.PCR.NEUTRAL_LOW) score -= 5;    // 0.80~0.90: 경계 초입
  }

  return Math.max(-100, Math.min(100, score));
}

// ─── 멀티타임프레임 확인 ────────────────────────────────────
/**
 * 일봉 + 주봉 방향 일치 시 부스트
 * @param {number} dailyScore - 일봉 TA 점수
 * @param {number} weeklyScore - 주봉 TA 점수 (없으면 null)
 * @returns {number} 부스트 배율 (1.0 ~ 1.3)
 */
function mtfBoost(dailyScore, weeklyScore) {
  if (weeklyScore == null) return 1.0;
  // 같은 방향이면 1.3x, 반대면 0.8x
  if ((dailyScore > 0 && weeklyScore > 0) || (dailyScore < 0 && weeklyScore < 0)) return 1.3;
  if ((dailyScore > 0 && weeklyScore < 0) || (dailyScore < 0 && weeklyScore > 0)) return 0.8;
  return 1.0;
}

// ─── 메인 복합 스코어 계산 ──────────────────────────────────
/**
 * 종목별 복합 방향성 점수 계산
 * @param {{ totalScore: number }} ta - TA 지표 결과 (taCalculator.calculateAllIndicators)
 * @param {{ foreignBuyDays, foreignSellDays, instBuyDays, instSellDays, volumeRatio }} flow
 * @param {{ fearGreed, fundingRate, pcr }} sentiment
 * @param {{ weeklyTaScore?: number }} options
 * @returns {{ score: number, label: string, direction: string, breakdown: object }}
 */
export function calculateCompositeScore(ta, flow, sentiment, options = {}) {
  const taScore = ta?.totalScore ?? 0;
  const flowScore = calcFlowScore(flow);
  const sentimentScore = calcSentimentScore(sentiment);

  // 가중합
  const raw = taScore * WEIGHT.ta + flowScore * WEIGHT.flow + sentimentScore * WEIGHT.sentiment;

  // 멀티타임프레임 부스트
  const boost = mtfBoost(taScore, options.weeklyTaScore ?? null);
  const score = Math.max(-100, Math.min(100, raw * boost));

  // 라벨 결정
  let label;
  let direction;
  if (score >= 70) {
    label = '강세 흐름 진행 중';
    direction = DIRECTIONS.BULLISH;
  } else if (score >= 30) {
    label = '상승 타이밍 접근 중';
    direction = DIRECTIONS.BULLISH;
  } else if (score > -30) {
    label = '관망 구간';
    direction = DIRECTIONS.NEUTRAL;
  } else if (score > -70) {
    label = '하락 압력 감지';
    direction = DIRECTIONS.BEARISH;
  } else {
    label = '강한 하락 경고';
    direction = DIRECTIONS.BEARISH;
  }

  return {
    score: +score.toFixed(1),
    label,
    direction,
    breakdown: {
      ta: { score: taScore, weight: WEIGHT.ta, weighted: +(taScore * WEIGHT.ta).toFixed(1) },
      flow: { score: flowScore, weight: WEIGHT.flow, weighted: +(flowScore * WEIGHT.flow).toFixed(1) },
      sentiment: { score: sentimentScore, weight: WEIGHT.sentiment, weighted: +(sentimentScore * WEIGHT.sentiment).toFixed(1) },
      boost,
    },
  };
}

/**
 * 시그널 엔진의 활성 시그널에서 Flow/Sentiment 데이터 추출
 * @param {Array} signals - getActiveSignals() 또는 getSignalsBySymbol()
 * @returns {{ flow: object, sentiment: object }}
 */
export function extractFlowAndSentiment(signals) {
  const flow = {
    foreignBuyDays: 0, foreignSellDays: 0,
    instBuyDays: 0, instSellDays: 0,
    volumeRatio: 1,
  };
  const sentiment = {
    fearGreed: null,
    fundingRate: null,
    pcr: null,
  };

  for (const sig of signals) {
    const meta = sig.meta || {};

    switch (sig.type) {
      case 'foreign_consecutive_buy':
        flow.foreignBuyDays = Math.max(flow.foreignBuyDays, meta.consecutiveDays || 0);
        break;
      case 'foreign_consecutive_sell':
        flow.foreignSellDays = Math.max(flow.foreignSellDays, meta.consecutiveDays || 0);
        break;
      case 'institutional_consecutive_buy':
        flow.instBuyDays = Math.max(flow.instBuyDays, meta.consecutiveDays || 0);
        break;
      case 'institutional_consecutive_sell':
        flow.instSellDays = Math.max(flow.instSellDays, meta.consecutiveDays || 0);
        break;
      case 'volume_anomaly':
        flow.volumeRatio = Math.max(flow.volumeRatio, meta.ratio || 1);
        break;
      case 'fear_greed_shift':
        sentiment.fearGreed = meta.current;
        break;
      case 'funding_rate_extreme':
        sentiment.fundingRate = meta.fundingRate;
        break;
      case 'put_call_ratio':
        sentiment.pcr = meta.pcr;
        break;
    }
  }

  return { flow, sentiment };
}
