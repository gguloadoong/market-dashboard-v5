import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import SurgeBanner from './components/SurgeBanner';
import StockModal from './components/StockModal';
import HomeTab from './components/HomeTab';
import KoreanTab from './components/tabs/KoreanTab';
import UsTab from './components/tabs/UsTab';
import EtfTab from './components/tabs/EtfTab';
import CoinTab from './components/tabs/CoinTab';
import NewsTab from './components/tabs/NewsTab';

import { KOREAN_STOCKS, US_STOCKS_INITIAL, COINS_INITIAL, ETF_DATA, INDICES_INITIAL } from './data/mock';
import { fetchCoins, fetchExchangeRate } from './api/coins';
import { fetchUsStocksBatch, fetchKoreanStocksBatch, fetchIndices } from './api/stocks';

const TABS = [
  { id: 'home', label: '홈'  },
  { id: 'kr',   label: '국장' },
  { id: 'us',   label: '미장' },
  { id: 'coin', label: '코인' },
  { id: 'etf',  label: 'ETF' },
  { id: 'news', label: '뉴스' },
];

const US_SYMBOLS = US_STOCKS_INITIAL.map(s => s.symbol);

function simulateKorean(stocks) {
  return stocks.map(s => {
    const delta    = s.price * (Math.random() - 0.5) * 0.003;
    const newPrice = Math.round(s.price + delta);
    const base     = newPrice - s.change;
    return {
      ...s,
      price:     newPrice,
      change:    Math.round(s.change + delta * 0.7),
      changePct: base > 0 ? parseFloat(((newPrice - base) / base * 100).toFixed(2)) : s.changePct,
      sparkline: [...(s.sparkline ?? []).slice(1), newPrice],
    };
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [coins, setCoins]         = useState(COINS_INITIAL);
  const [usStocks, setUsStocks]   = useState(US_STOCKS_INITIAL);
  const [krStocks, setKrStocks]   = useState(KOREAN_STOCKS);
  const [etfs]                    = useState(ETF_DATA);
  const [indices, setIndices]     = useState(INDICES_INITIAL);
  const [krwRate, setKrwRate]     = useState(1466);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [modal, setModal]         = useState(null);
  const [coinUnit]                = useState('usd');
  const loadingRef = useRef(false);

  const refreshCoins = useCallback(async () => {
    try {
      const rate = await fetchExchangeRate().catch(() => krwRate);
      setKrwRate(rate);
      const data = await fetchCoins(rate);
      if (data.length > 0) {
        setCoins(prev => data.map(c => {
          const old = prev.find(p => p.id === c.id);
          return { ...c, sparkline: c.sparkline?.length ? c.sparkline : old?.sparkline ?? [] };
        }));
      }
    } catch (e) { console.warn('코인:', e.message); }
  }, [krwRate]);

  const refreshUsStocks = useCallback(async () => {
    try {
      const data = await fetchUsStocksBatch(US_SYMBOLS);
      if (data.length > 0) {
        setUsStocks(prev => prev.map(s => {
          const u = data.find(d => d.symbol === s.symbol);
          return u?.price ? { ...s, ...u, sparkline: u.sparkline?.length ? u.sparkline : s.sparkline } : s;
        }));
      }
    } catch (e) { console.warn('미장:', e.message); }
  }, []);

  const refreshKoreanStocks = useCallback(async () => {
    try {
      const data = await fetchKoreanStocksBatch(KOREAN_STOCKS);
      if (data.length > 0) {
        setKrStocks(prev => prev.map(s => {
          const u = data.find(d => d.symbol === s.symbol);
          return u?.price ? { ...s, ...u, sparkline: [...s.sparkline.slice(1), u.price] } : s;
        }));
      }
    } catch (e) { console.warn('국장:', e.message); }
  }, []);

  const refreshIndices = useCallback(async () => {
    try {
      const data = await fetchIndices();
      if (data.length > 0) setIndices(prev => prev.map(idx => ({ ...idx, ...(data.find(d => d.id === idx.id) ?? {}) })));
    } catch (e) { console.warn('지수:', e.message); }
  }, []);

  const refreshAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      await Promise.allSettled([refreshCoins(), refreshUsStocks(), refreshKoreanStocks(), refreshIndices()]);
      setLastUpdated(Date.now());
    } finally { setLoading(false); loadingRef.current = false; }
  }, [refreshCoins, refreshUsStocks, refreshKoreanStocks, refreshIndices]);

  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => { const id = setInterval(() => refreshCoins().then(() => setLastUpdated(Date.now())), 10000); return () => clearInterval(id); }, [refreshCoins]);
  useEffect(() => { const id = setInterval(refreshUsStocks,    30000); return () => clearInterval(id); }, [refreshUsStocks]);
  useEffect(() => { const id = setInterval(refreshKoreanStocks,30000); return () => clearInterval(id); }, [refreshKoreanStocks]);
  useEffect(() => { const id = setInterval(() => setKrStocks(p => simulateKorean(p)), 15000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(refreshIndices,     60000); return () => clearInterval(id); }, [refreshIndices]);

  const allStocks = [...krStocks, ...usStocks];

  return (
    <div className="min-h-screen bg-[#F2F4F6]">
      {/* 실시간 티커 배너 */}
      <SurgeBanner stocks={allStocks} coins={coins} />

      {/* 헤더 */}
      <Header krwRate={krwRate} lastUpdated={lastUpdated} onRefresh={refreshAll} loading={loading} />

      {/* 탭 바 */}
      <div className="bg-white sticky top-[52px] z-30" style={{ borderBottom: '1px solid #F2F4F6' }}>
        <div className="max-w-[480px] mx-auto px-1 flex overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'coin' && (
                <span className="ml-1 text-[9px] font-bold" style={{ color: '#2AC769' }}>●</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <main className="max-w-[480px] mx-auto px-2.5 pt-2.5">
        {activeTab === 'home' && <HomeTab krStocks={krStocks} usStocks={usStocks} coins={coins} indices={indices} coinUnit={coinUnit} onCardClick={setModal} onTabChange={setActiveTab} />}
        {activeTab === 'kr'   && <KoreanTab stocks={krStocks} onCardClick={setModal} />}
        {activeTab === 'us'   && <UsTab stocks={usStocks} onCardClick={setModal} />}
        {activeTab === 'coin' && <CoinTab coins={coins} onCardClick={setModal} />}
        {activeTab === 'etf'  && <EtfTab etfs={etfs} onCardClick={setModal} />}
        {activeTab === 'news' && <NewsTab />}
      </main>

      {modal && <StockModal item={modal} coinUnit={coinUnit} onClose={() => setModal(null)} />}
    </div>
  );
}
