import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import SurgeBanner from './components/SurgeBanner';
import StockModal from './components/StockModal';
import HomeTab from './components/HomeTab';
import KoreanTab from './components/tabs/KoreanTab';
import UsTab from './components/tabs/UsTab';
import EtfTab from './components/tabs/EtfTab';
import CoinTab from './components/tabs/CoinTab';

import { KOREAN_STOCKS, US_STOCKS_INITIAL, COINS_INITIAL, ETF_DATA, INDICES_INITIAL } from './data/mock';
import { fetchCoins, fetchExchangeRate } from './api/coins';
import { fetchUsStocksBatch, fetchIndices } from './api/stocks';
import { isUsMarketOpen } from './utils/marketHours';

const TABS = [
  { id: 'home', label: '홈' },
  { id: 'kr',   label: '국장' },
  { id: 'us',   label: '미장' },
  { id: 'etf',  label: 'ETF' },
  { id: 'coin', label: '코인' },
];

const US_SYMBOLS = US_STOCKS_INITIAL.map(s => s.symbol);

function simulateKorean(stocks) {
  return stocks.map(s => {
    const delta = s.price * (Math.random() - 0.5) * 0.005;
    const newPrice = Math.round(s.price + delta);
    const base = s.price - s.change;
    const newChange = newPrice - base;
    const newPct = base > 0 ? (newChange / base) * 100 : 0;
    return {
      ...s,
      price: newPrice,
      change: Math.round(newChange),
      changePct: parseFloat(newPct.toFixed(2)),
      sparkline: [...(s.sparkline ?? []).slice(1), newPrice],
    };
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [coins, setCoins]       = useState(COINS_INITIAL);
  const [usStocks, setUsStocks] = useState(US_STOCKS_INITIAL);
  const [krStocks, setKrStocks] = useState(KOREAN_STOCKS);
  const [etfs]                  = useState(ETF_DATA);
  const [indices, setIndices]   = useState(INDICES_INITIAL);
  const [krwRate, setKrwRate]   = useState(1335);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState(null);
  const [coinUnit]              = useState('usd');
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
    } catch (e) { console.warn('코인 로드 실패:', e.message); }
  }, []);

  const refreshUsStocks = useCallback(async () => {
    if (!isUsMarketOpen()) return;
    try {
      const data = await fetchUsStocksBatch(US_SYMBOLS);
      if (data.length > 0) {
        setUsStocks(prev => prev.map(s => {
          const u = data.find(d => d.symbol === s.symbol);
          return u ? { ...s, price: u.price ?? s.price, change: u.change ?? s.change, changePct: u.changePct ?? s.changePct, volume: u.volume ?? s.volume, sparkline: u.sparkline?.length ? u.sparkline : s.sparkline } : s;
        }));
      }
    } catch (e) { console.warn('미장 로드 실패:', e.message); }
  }, []);

  const refreshIndices = useCallback(async () => {
    try {
      const data = await fetchIndices();
      if (data.length > 0) setIndices(prev => prev.map(idx => ({ ...idx, ...(data.find(d => d.id === idx.id) ?? {}) })));
    } catch (e) { console.warn('지수 로드 실패:', e.message); }
  }, []);

  const refreshAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      await Promise.allSettled([refreshCoins(), refreshUsStocks(), refreshIndices()]);
      setLastUpdated(Date.now());
    } finally { setLoading(false); loadingRef.current = false; }
  }, [refreshCoins, refreshUsStocks, refreshIndices]);

  // 초기 로드
  useEffect(() => { refreshAll(); }, [refreshAll]);
  // 코인 10초
  useEffect(() => {
    const id = setInterval(() => refreshCoins().then(() => setLastUpdated(Date.now())), 10000);
    return () => clearInterval(id);
  }, [refreshCoins]);
  // 미장 30초
  useEffect(() => { const id = setInterval(refreshUsStocks, 30000); return () => clearInterval(id); }, [refreshUsStocks]);
  // 국장 시뮬 15초
  useEffect(() => { const id = setInterval(() => setKrStocks(p => simulateKorean(p)), 15000); return () => clearInterval(id); }, []);
  // 지수 1분
  useEffect(() => { const id = setInterval(refreshIndices, 60000); return () => clearInterval(id); }, [refreshIndices]);

  const allStocks = [...krStocks, ...usStocks];

  return (
    <div className="min-h-screen bg-[#F2F4F6]">
      <SurgeBanner stocks={allStocks} coins={coins} />
      <Header krwRate={krwRate} lastUpdated={lastUpdated} onRefresh={refreshAll} loading={loading} />

      {/* 탭 바 */}
      <div className="bg-surface border-b border-[#F2F4F6] sticky top-12 z-30">
        <div className="max-w-4xl mx-auto px-4 flex overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'coin' && <span className="ml-1 text-[9px] text-green-500 font-bold">LIVE</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 컨텐츠 */}
      <main className="max-w-4xl mx-auto px-3 pt-3">
        {activeTab === 'home' && (
          <HomeTab
            krStocks={krStocks} usStocks={usStocks} coins={coins}
            indices={indices} coinUnit={coinUnit}
            onCardClick={setModal} onTabChange={setActiveTab}
          />
        )}
        {activeTab === 'kr'   && <KoreanTab stocks={krStocks} onCardClick={setModal} />}
        {activeTab === 'us'   && <UsTab stocks={usStocks} onCardClick={setModal} />}
        {activeTab === 'etf'  && <EtfTab etfs={etfs} onCardClick={setModal} />}
        {activeTab === 'coin' && <CoinTab coins={coins} onCardClick={setModal} />}
      </main>

      {modal && <StockModal item={modal} coinUnit={coinUnit} onClose={() => setModal(null)} />}
    </div>
  );
}
