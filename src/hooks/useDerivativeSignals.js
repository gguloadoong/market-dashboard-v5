// 파생/소셜 시그널 폴링 훅 — PCR, 펀딩비, 주문장 불균형, VWAP, 소셜 감성
import { useEffect, useRef } from 'react';
import { fetchPCR, fetchFundingRate, fetchOrderFlow, fetchSocialSentiment } from '../api/_gateway';
import {
  createPCRSignal,
  createFundingRateSignal,
  createOrderFlowSignal,
  createVWAPSignal,
  createSocialSentimentSignal,
} from '../engine/signalEngine';

// VWAP 계산 — sparkline(가격 배열) 기반 단순 평균 (실제 거래량 없어 단순 이동평균 대체)
function calcVWAPFromSparkline(sparkline) {
  if (!sparkline?.length) return null;
  return sparkline.reduce((s, p) => s + p, 0) / sparkline.length;
}

export function useDerivativeSignals({ usStocks = [], krStocks = [], watchlistSymbols = [] } = {}) {
  const usStocksRef = useRef(usStocks);
  const krStocksRef = useRef(krStocks);
  const watchlistRef = useRef(watchlistSymbols);
  usStocksRef.current = usStocks;
  krStocksRef.current = krStocks;
  watchlistRef.current = watchlistSymbols;

  useEffect(() => {
    let pcrTimer, frTimer, ofTimer, socialTimer, vwapTimer;

    // PCR 폴링 (5분)
    async function runPCR() {
      try {
        const data = await fetchPCR();
        if (data?.pcr != null) createPCRSignal(data.pcr, data.totalPuts, data.totalCalls);
      } catch {}
    }

    // 펀딩비 폴링 (5분, BTC + ETH)
    async function runFundingRate() {
      try {
        const symbols = ['BTCUSDT', 'ETHUSDT'];
        await Promise.allSettled(symbols.map(async sym => {
          const data = await fetchFundingRate(sym);
          if (data?.fundingRate != null) {
            const display = sym.replace('USDT', '');
            createFundingRateSignal(display, data.fundingRate, data.openInterest);
          }
        }));
      } catch {}
    }

    // 주문장 불균형 폴링 (1분, BTC)
    async function runOrderFlow() {
      try {
        const data = await fetchOrderFlow('BTCUSDT');
        if (data?.imbalance != null) createOrderFlowSignal('BTC', data.bidVolume, data.askVolume);
      } catch {}
    }

    // 소셜 감성 폴링 (5분, watchlist 상위 3개 or 기본 종목)
    async function runSocial() {
      try {
        const defaultSymbols = ['AAPL', 'NVDA', 'TSLA'];
        const symbols = watchlistRef.current.slice(0, 3).length
          ? watchlistRef.current.slice(0, 3)
          : defaultSymbols;

        await Promise.allSettled(symbols.map(async sym => {
          const data = await fetchSocialSentiment(sym);
          if (data?.bullRatio != null) {
            const stock = usStocksRef.current.find(s => s.symbol === sym);
            const name = stock?.name || sym;
            createSocialSentimentSignal(sym, name, 'us', data.bullRatio, data.sentimentMessages);
          }
        }));
      } catch {}
    }

    // VWAP 계산 (5분, 기존 데이터 활용)
    function runVWAP() {
      try {
        const allStocks = [
          ...usStocksRef.current.map(s => ({ ...s, market: 'us' })),
          ...krStocksRef.current.map(s => ({ ...s, market: 'kr' })),
        ];
        for (const stock of allStocks) {
          if (!stock.price || !stock.sparkline?.length) continue;
          const vwap = calcVWAPFromSparkline(stock.sparkline);
          if (vwap) createVWAPSignal(stock.symbol, stock.name || stock.symbol, stock.market, stock.price, vwap);
        }
      } catch {}
    }

    // 초기 실행
    runPCR();
    runFundingRate();
    runOrderFlow();
    runSocial();
    setTimeout(() => { if (!document.hidden) runVWAP(); }, 30000);

    // 폴링 설정
    pcrTimer = setInterval(() => { if (!document.hidden) runPCR(); }, 5 * 60 * 1000);
    frTimer = setInterval(() => { if (!document.hidden) runFundingRate(); }, 5 * 60 * 1000);
    ofTimer = setInterval(() => { if (!document.hidden) runOrderFlow(); }, 60 * 1000);
    socialTimer = setInterval(() => { if (!document.hidden) runSocial(); }, 5 * 60 * 1000);
    vwapTimer = setInterval(() => { if (!document.hidden) runVWAP(); }, 5 * 60 * 1000);

    return () => {
      clearInterval(pcrTimer);
      clearInterval(frTimer);
      clearInterval(ofTimer);
      clearInterval(socialTimer);
      clearInterval(vwapTimer);
    };
  }, []); // ref 패턴 — 의존성 없음
}
