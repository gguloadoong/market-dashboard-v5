// 복합 시그널 훅 — TA API 폴링 + 기존 시그널 merge → 종목별 방향성 점수
import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateCompositeScore, extractFlowAndSentiment } from '../engine/compositeScorer';
import { getActiveSignals, getSignalsBySymbol, createSignal, addSignal, removeSignalByTypeAndSymbol } from '../engine/signalEngine';
import { SIGNAL_TYPES, DIRECTIONS } from '../engine/signalTypes';

const POLL_INTERVAL = 5 * 60 * 1000; // 5분
const API_URL = '/api/ta-indicators';

/**
 * TA API에서 지표를 가져와 기존 시그널과 합산 → 복합 점수 생성
 * @param {Array} allItems - 전체 종목 배열 (시그널 매칭용)
 */
export function useCompositeSignals(allItems = []) {
  const [scores, setScores] = useState({}); // { BTC: { score, label, ... }, ... }
  const [loading, setLoading] = useState(true);
  const runningRef = useRef(false);

  const fetchAndScore = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return;
      const { results } = await res.json();
      if (!results) return;

      const allSignals = getActiveSignals();
      const newScores = {};

      for (const [symbol, ta] of Object.entries(results)) {
        // 해당 종목의 기존 시그널에서 Flow/Sentiment 추출
        const symbolSignals = allSignals.filter(
          s => s.symbol === symbol || s.symbol === symbol.toUpperCase()
        );
        const { flow, sentiment } = extractFlowAndSentiment(symbolSignals);

        // 전체 시그널에서 글로벌 sentiment (공포탐욕, PCR)
        const globalSentiment = extractFlowAndSentiment(allSignals).sentiment;
        const mergedSentiment = {
          fearGreed: sentiment.fearGreed ?? globalSentiment.fearGreed,
          fundingRate: sentiment.fundingRate ?? globalSentiment.fundingRate,
          pcr: sentiment.pcr ?? globalSentiment.pcr,
        };

        const composite = calculateCompositeScore(ta, flow, mergedSentiment);
        newScores[symbol] = {
          ...composite,
          ta,
          symbol,
          market: ta.market,
        };

        // 강한 시그널(±50 이상)만 시그널 엔진에 등록
        if (Math.abs(composite.score) >= 50) {
          removeSignalByTypeAndSymbol('composite_score', symbol);
          const signal = createSignal({
            type: SIGNAL_TYPES.COMPOSITE_SCORE,
            symbol,
            name: findName(symbol, allItems) || symbol,
            market: ta.market === 'coin' ? 'crypto' : ta.market,
            direction: composite.direction,
            strength: Math.abs(composite.score) >= 70 ? 4 : 3,
            title: `${findName(symbol, allItems) || symbol} ${composite.label} (${composite.score > 0 ? '+' : ''}${composite.score})`,
            meta: {
              compositeScore: composite.score,
              breakdown: composite.breakdown,
              rsi: ta.rsi?.value,
              macd: ta.macd?.histogram,
            },
          });
          addSignal(signal);
        }
      }

      setScores(newScores);
    } catch {
      // 에러 무시 — 다음 폴링에서 재시도
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [allItems]);

  useEffect(() => {
    // 초기 로드 (3초 대기 — 가격 데이터 로딩 여유)
    const initTimer = setTimeout(fetchAndScore, 3000);

    // 5분 간격 폴링
    const interval = setInterval(() => {
      if (!document.hidden) fetchAndScore();
    }, POLL_INTERVAL);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [fetchAndScore]);

  return { scores, loading };
}

/** 종목명 찾기 헬퍼 */
function findName(symbol, allItems) {
  const item = allItems.find(
    i => (i.symbol || '').toUpperCase() === symbol.toUpperCase()
  );
  return item?.name || null;
}

/**
 * 특정 종목의 복합 점수 조회 (ChartSidePanel용)
 * @param {string} symbol
 * @param {object} scores - useCompositeSignals의 scores
 */
export function getCompositeScore(symbol, scores) {
  return scores[symbol?.toUpperCase()] || scores[symbol] || null;
}
