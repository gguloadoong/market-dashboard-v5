// 복합 시그널 훅 — TA API 폴링 + 기존 시그널 merge → 종목별 방향성 점수
import { useState, useEffect, useRef } from 'react';
import { calculateCompositeScore, extractFlowAndSentiment } from '../engine/compositeScorer';
import { getActiveSignals, createSignal, addSignal, removeSignalByTypeAndSymbol } from '../engine/signalEngine';
import { SIGNAL_TYPES } from '../engine/signalTypes';

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
  const allItemsRef = useRef(allItems); // ref로 감싸서 무한 루프 방지
  allItemsRef.current = allItems;

  useEffect(() => {
    async function fetchAndScore() {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const res = await fetch(API_URL, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) return;
        const { results } = await res.json();
        if (!results) return;

        const allSignals = getActiveSignals();
        const items = allItemsRef.current;
        const newScores = {};

        // 글로벌 sentiment 1회만 추출 (루프 밖)
        const globalSentiment = extractFlowAndSentiment(allSignals).sentiment;

        for (const [symbol, ta] of Object.entries(results)) {
          // 해당 종목의 기존 시그널에서 Flow/Sentiment 추출
          const symbolSignals = allSignals.filter(
            s => s.symbol === symbol || s.symbol === symbol.toUpperCase()
          );
          const { flow, sentiment } = extractFlowAndSentiment(symbolSignals);

          // 종목별 sentiment + 글로벌 sentiment 병합
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
            const name = findName(symbol, items) || symbol;
            const signal = createSignal({
              type: SIGNAL_TYPES.COMPOSITE_SCORE,
              symbol,
              name,
              market: ta.market === 'coin' ? 'crypto' : ta.market,
              direction: composite.direction,
              strength: Math.abs(composite.score) >= 70 ? 4 : 3,
              title: `${name} ${composite.label} (${composite.score > 0 ? '+' : ''}${composite.score})`,
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
    }

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
  }, []); // deps 비움 — allItems는 ref로 접근

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
