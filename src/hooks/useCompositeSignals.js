// 복합 시그널 훅 — TA API 폴링 + 기존 시그널 merge → 종목별 방향성 점수
import { useState, useEffect, useRef } from 'react';
import { calculateCompositeScore, extractFlowAndSentiment } from '../engine/compositeScorer';
import { getActiveSignals, createSignal, addSignal, removeSignalByTypeAndSymbol } from '../engine/signalEngine';
import { SIGNAL_TYPES } from '../engine/signalTypes';

const POLL_INTERVAL = 5 * 60 * 1000; // 5분
const API_URL = '/api/ta-indicators';

// 마켓별 요청 분리 — 타임아웃 방지 (25종목 한번에 X → 3회 분리)
const MARKET_REQUESTS = [
  { market: 'coin', symbols: 'BTC,ETH,SOL,XRP,DOGE,ADA,AVAX,DOT,LINK,BNB' },
  { market: 'us', symbols: 'NVDA,AAPL,TSLA,MSFT,META,GOOGL,AMZN,AMD,COIN,MSTR' },
  { market: 'kr', symbols: '005930,000660,005380,373220,035420' },
];

/**
 * TA API에서 지표를 가져와 기존 시그널과 합산 → 복합 점수 생성
 * @param {Array} allItems - 전체 종목 배열 (시그널 매칭용)
 */
export function useCompositeSignals(allItems = []) {
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const runningRef = useRef(false);
  const allItemsRef = useRef(allItems);
  allItemsRef.current = allItems;

  useEffect(() => {
    async function fetchAndScore() {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        // 마켓별 순차 요청 (각 10초 타임아웃)
        const allResults = {};
        for (const { market, symbols } of MARKET_REQUESTS) {
          try {
            const res = await fetch(
              `${API_URL}?market=${market}&symbols=${symbols}`,
              { signal: AbortSignal.timeout(10000) }
            );
            if (res.ok) {
              const { results } = await res.json();
              if (results) Object.assign(allResults, results);
            }
          } catch {
            // 개별 마켓 실패 무시 — 다른 마켓은 계속 진행
          }
        }

        if (!Object.keys(allResults).length) return;

        const allSignals = getActiveSignals();
        const items = allItemsRef.current;
        const newScores = {};

        // 글로벌 sentiment 1회만 추출
        const globalSentiment = extractFlowAndSentiment(allSignals).sentiment;

        for (const [symbol, ta] of Object.entries(allResults)) {
          const symbolSignals = allSignals.filter(
            s => s.symbol === symbol || s.symbol === symbol.toUpperCase()
          );
          const { flow, sentiment } = extractFlowAndSentiment(symbolSignals);

          const mergedSentiment = {
            fearGreed: sentiment.fearGreed ?? globalSentiment.fearGreed,
            fundingRate: sentiment.fundingRate ?? globalSentiment.fundingRate,
            pcr: sentiment.pcr ?? globalSentiment.pcr,
          };

          const composite = calculateCompositeScore(ta, flow, mergedSentiment);
          newScores[symbol] = { ...composite, ta, symbol, market: ta.market };

          // 강한 시그널(±50 이상)만 시그널 엔진에 등록
          if (Math.abs(composite.score) >= 50) {
            removeSignalByTypeAndSymbol('composite_score', symbol);
            const name = findName(symbol, items) || symbol;
            addSignal(createSignal({
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
            }));
          }
        }

        setScores(newScores);
      } catch {
        // 전체 실패 — 다음 폴링에서 재시도
      } finally {
        runningRef.current = false;
        setLoading(false);
      }
    }

    const initTimer = setTimeout(fetchAndScore, 3000);
    const interval = setInterval(() => {
      if (!document.hidden) fetchAndScore();
    }, POLL_INTERVAL);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { scores, loading };
}

function findName(symbol, allItems) {
  const item = allItems.find(i => (i.symbol || '').toUpperCase() === symbol.toUpperCase());
  return item?.name || null;
}

export function getCompositeScore(symbol, scores) {
  return scores[symbol?.toUpperCase()] || scores[symbol] || null;
}
