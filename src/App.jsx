import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import SurgeBanner from './components/SurgeBanner';
import IndexSummary from './components/IndexSummary';
import StockModal from './components/StockModal';
import AllTab from './components/tabs/AllTab';
import KoreanTab from './components/tabs/KoreanTab';
import UsTab from './components/tabs/UsTab';
import EtfTab from './components/tabs/EtfTab';
import CoinTab from './components/tabs/CoinTab';

import { KOREAN_STOCKS, US_STOCKS_INITIAL, COINS_INITIAL, ETF_DATA, INDICES_INITIAL } from './data/mock';
import { fetchCoins, fetchExchangeRate } from './api/coins';
import { fetchUsStocksBatch, fetchIndices } from './api/stocks';
import { isUsMarketOpen } from './utils/marketHours';

const TABS = [
  { id: 'all',  label: '전체' },
  { id: 'kr',   label: '국장' },
  { id: 'us',   label: '미장' },
  { id: 'etf',  label: 'ETF' },
  { id: 'coin', label: '코인' },
];

const US_SYMBOLS = US_STOCKS_INITIAL.map(s => s.symbol);

function simulateKorean(stocks) {
  return stocks.map(s => {
    const delta = s.price * (Math.random() - 0.5) * 0.006;
    const newPrice = Math.round(s.price + delta);
    const base = s.price - s.change;
    const newChange = newPrice - base;
    const newPct = base > 0 ? (newChange / base) * 100 : 0;
    const newSparkline = [...(s.sparkline ?? []).slice(1), newPrice];
    return { ...s, price: newPrice, change: Math.round(newChange), changePct: parseFloat(newPct.toFixed(2)), sparkline: newSparkline };
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState('all');
  const [coins, setCoins] = useState(COINS_INITIAL);
  const [usStocks, setUsStocks] = useState(US_STOCKS_INITIAL);
  const [krStocks, setKrStocks] = useState(KOREAN_STOCKS);
  const [etfs] = useState(ETF_DATA);
  const [indices, setIndices] = useState(INDICES_INITIAL);
  const [krwRate, setKrwRate] = useState(1335);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [coinUnit] = useState('usd');

  const loadingRef = useRef(false);

  const refreshCoins = useCallback(async () => {
    try {
      const rate = await fetchExchangeRate();
      setKrwRate(rate);
      const data = await fetchCoins(rate);
      if (data.length > 0) {
        setCoins(prev => data.map(c => {
          const old = prev.find(p => p.id === c.id);
          return { ...c, sparkline: c.sparkline?.length ? c.sparkline : old?.sparkline ?? [] };
        }));
      }
    } catch (err) {
      console.warn('코인 데이터 로드 실패:', err.message);
    }
  }, []);

  const refreshUsStocks = useCallback(async () => {
    if (!isUsMarketOpen()) return;
    try {
      const data = await fetchUsStocksBatch(US_SYMBOLS);
      if (data.length > 0) {
        setUsStocks(prev => prev.map(s => {
          const updated = data.find(d => d.symbol === s.symbol);
          if (!updated) return s;
          return {
            ...s,
            price: updated.price ?? s.price,
            change: updated.change ?? s.change,
            changePct: updated.changePct ?? s.changePct,
            volume: updated.volume ?? s.volume,
            sparkline: updated.sparkline?.length ? updated.sparkline : s.sparkline,
          };
        }));
      }
    } catch (err) {
      console.warn('미장 데이터 로드 실패:', err.message);
    }
  }, []);

  const refreshIndices = useCallback(async () => {
    try {
      const data = await fetchIndices();
      if (data.length > 0) {
        setIndices(prev => prev.map(idx => {
          const updated = data.find(d => d.id === idx.id);
          return updated ? { ...idx, ...updated } : idx;
        }));
      }
    } catch (err) {
      console.warn('지수 데이터 로드 실패:', err.message);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      await Promise.allSettled([refreshCoins(), refreshUsStocks(), refreshIndices()]);
      setLastUpdated(Date.now());
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [refreshCoins, refreshUsStocks, refreshIndices]);

  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => {
    const id = setInterval(() => refreshCoins().then(() => setLastUpdated(Date.now())), 10000);
    return () => clearInterval(id);
  }, [refreshCoins]);
  useEffect(() => {
    const id = setInterval(refreshUsStocks, 30000);
    return () => clearInterval(id);
  }, [refreshUsStocks]);
  useEffect(() => {
    const id = setInterval(() => setKrStocks(prev => simulateKorean(prev)), 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(refreshIndices, 60000);
    return () => clearInterval(id);
  }, [refreshIndices]);

  const allStocks = [...krStocks, ...usStocks];

  return (
    <div className="min-h-screen bg-bg">
      <SurgeBanner stocks={allStocks} coins={coins} />
      <Header krwRate={krwRate} lastUpdated={lastUpdated} onRefresh={refreshAll} loading={loading} />

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <IndexSummary indices={indices} />

        <div className="bg-surface border-b border-border -mx-4 px-4 flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'coin' && (
                <span className="ml-1.5 text-[9px] text-green-500 font-semibold">LIVE</span>
              )}
            </button>
          ))}
        </div>

        <div className="animate-slideUp">
          {activeTab === 'all'  && <AllTab stocks={allStocks} coins={coins} coinUnit={coinUnit} onCardClick={setModal} />}
          {activeTab === 'kr'   && <KoreanTab stocks={krStocks} onCardClick={setModal} />}
          {activeTab === 'us'   && <UsTab stocks={usStocks} onCardClick={setModal} />}
          {activeTab === 'etf'  && <EtfTab etfs={etfs} onCardClick={setModal} />}
          {activeTab === 'coin' && <CoinTab coins={coins} onCardClick={setModal} />}
        </div>
      </main>

      {modal && <StockModal item={modal} coinUnit={coinUnit} onClose={() => setModal(null)} />}
    </div>
  );
}
