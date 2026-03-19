// 코인 가격 폴링 + Upbit WebSocket 훅
import { useState, useEffect, useCallback, useRef } from 'react';
import { COINS_INITIAL } from '../data/mock';
import { fetchCoins, fetchCoinsUpbitOnly, fetchExchangeRate, fetchUpbitAllSymbols } from '../api/coins';
import { subscribeCoinPrices, unsubscribeCoinPrices } from '../api/coinWs';
import { setWhaleBtcKrwPrice } from '../api/whale';
import { checkAndAlertBatch } from '../utils/priceAlert';

export function useCoins(krwRateRef) {
  const [coins, setCoins]   = useState(COINS_INITIAL);
  const [coinError, setCoinError] = useState(false);
  const wsTickBufRef  = useRef({});
  const wsFlushTimer  = useRef(null);

  // 빠른 갱신 (10초, Upbit만)
  const refreshCoinsQuick = useCallback(async () => {
    try {
      setCoins(prev => {
        if (!prev.length) return prev;
        fetchCoinsUpbitOnly(prev, krwRateRef.current)
          .then(data => { if (data.length) { setCoins(data); checkAndAlertBatch(data, 'coin'); } })
          .catch(() => {});
        return prev;
      });
    } catch {}
  }, [krwRateRef]);

  // 전체 갱신 (60초, CoinGecko 포함)
  const refreshCoins = useCallback(async () => {
    try {
      const data = await fetchCoins(krwRateRef.current);
      if (data.length > 0) {
        setCoins(prev => data.map(c => {
          const old = prev.find(p => p.id === c.id);
          return { ...c, sparkline: c.sparkline?.length ? c.sparkline : old?.sparkline ?? [] };
        }));
        setCoinError(false);
      }
    } catch { setCoinError(true); }
  }, [krwRateRef]);

  // BTC KRW 가격 → whale 모듈
  useEffect(() => {
    const btc = coins.find(c => c.symbol === 'BTC');
    if (btc?.priceKrw) setWhaleBtcKrwPrice(btc.priceKrw);
  }, [coins]);

  // 폴링 인터벌
  useEffect(() => {
    const quickId  = setInterval(() => refreshCoinsQuick(), 10000);
    const fullId   = setInterval(refreshCoins, 60000);
    return () => { clearInterval(quickId); clearInterval(fullId); };
  }, [refreshCoinsQuick, refreshCoins]);

  // Upbit WebSocket
  useEffect(() => {
    let cancelled = false;
    const flushTicks = () => {
      wsFlushTimer.current = null;
      const buf = wsTickBufRef.current;
      if (!Object.keys(buf).length) return;
      wsTickBufRef.current = {};
      setCoins(prev => {
        const rate    = krwRateRef.current;
        const updated = [...prev];
        let changed   = false;
        for (const sym of Object.keys(buf)) {
          const tick = buf[sym];
          const idx  = updated.findIndex(c => c.symbol === sym);
          if (idx === -1) continue;
          updated[idx] = { ...updated[idx], priceKrw: tick.priceKrw, priceUsd: tick.priceKrw / rate, change24h: tick.change24h, priceSource: 'upbit-ws' };
          changed = true;
        }
        return changed ? updated : prev;
      });
    };
    const wsHandler = (tick) => {
      if (tick._connected) return;
      wsTickBufRef.current[tick.symbol] = tick;
      if (!wsFlushTimer.current) wsFlushTimer.current = setTimeout(flushTicks, 200);
    };
    subscribeCoinPrices(COINS_INITIAL.map(c => c.symbol), wsHandler);
    fetchUpbitAllSymbols()
      .then(symbols => { if (!cancelled) subscribeCoinPrices(symbols, wsHandler); })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(wsFlushTimer.current);
      wsFlushTimer.current = null;
      unsubscribeCoinPrices();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { coins, setCoins, coinError, refreshCoins, refreshCoinsQuick };
}
