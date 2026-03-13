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
import { fetchUsStocksBatch, fetchKoreanStocksBatch, fetchIndices } from './api/stocks';

const TABS = [
  { id: 'home', label: '홈' },
  { id: 'kr',   label: '국장' },
  { id: 'us',   label: '미장' },
  { id: 'etf',  label: 'ETF' },
  { id: 'coin', label: '코인' },
];

const US_SYMBOLS = US_STOCKS_INITIAL.map(s => s.symbol);

// 국장 장중 시뮬레이션 (실제 API 실패 시 fallback)
function simulateKorean(stocks) {
  return stocks.map(s => {
    const delta = s.price * (Math.random() - 0.5) * 0.003;
    const newPrice = Math.round(s.price + delta);
    const base = newPrice - s.change;
    const newChange = newPrice - base;
    const newPct = base > 0 ? (newChange / base) * 100 : 0;
    return {
      ...s,
      price: newPrice,
      change: Math.round(s.change + delta),
      changePct: parseFloat(newPct.toFixed(2)),
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

  // ── 코인: Upbit(KRW) + CoinGecko(USD·시총·스파크라인) ────────
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
    } catch (e) { console.warn('코인 로드 실패:', e.message); }
  }, [krwRate]);

  // ── 미국 주식: Yahoo Finance ─────────────────────────────────
  const refreshUsStocks = useCallback(async () => {
    try {
      const data = await fetchUsStocksBatch(US_SYMBOLS);
      if (data.length > 0) {
        setUsStocks(prev => prev.map(s => {
          const u = data.find(d => d.symbol === s.symbol);
          if (!u || !u.price) return s;
          return { ...s, price: u.price, change: u.change ?? s.change, changePct: u.changePct ?? s.changePct, volume: u.volume ?? s.volume, marketCap: u.marketCap ?? s.marketCap, high52w: u.high52w ?? s.high52w, low52w: u.low52w ?? s.low52w, sparkline: u.sparkline?.length ? u.sparkline : s.sparkline };
        }));
      }
    } catch (e) { console.warn('미장 로드 실패:', e.message); }
  }, []);

  // ── 국장: Yahoo Finance .KS, 실패 시 시뮬레이션 ──────────────
  const refreshKoreanStocks = useCallback(async () => {
    try {
      const data = await fetchKoreanStocksBatch(KOREAN_STOCKS);
      if (data.length > 0) {
        setKrStocks(prev => prev.map(s => {
          const u = data.find(d => d.symbol === s.symbol);
          if (!u || !u.price) return s;
          return { ...s, price: u.price, change: u.change ?? s.change, changePct: u.changePct ?? s.changePct, volume: u.volume ?? s.volume, marketCap: u.marketCap ?? s.marketCap, high52w: u.high52w ?? s.high52w, low52w: u.low52w ?? s.low52w, sparkline: [...s.sparkline.slice(1), u.price] };
        }));
      }
    } catch (e) {
      console.warn('국장 로드 실패, 시뮬레이션 유지:', e.message);
    }
  }, []);

  // ── 지수 ─────────────────────────────────────────────────────
  const refreshIndices = useCallback(async () => {
    try {
      const data = await fetchIndices();
      if (data.length > 0) setIndices(prev => prev.map(idx => ({ ...idx, ...(data.find(d => d.id === idx.id) ?? {}) })));
    } catch (e) { console.warn('지수 로드 실패:', e.message); }
  }, []);

  // ── 전체 새로고침 ─────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      await Promise.allSettled([refreshCoins(), refreshUsStocks(), refreshKoreanStocks(), refreshIndices()]);
      setLastUpdated(Date.now());
    } finally { setLoading(false); loadingRef.current = false; }
  }, [refreshCoins, refreshUsStocks, refreshKoreanStocks, refreshIndices]);

  // 초기 로드
  useEffect(() => { refreshAll(); }, [refreshAll]);
  // 코인 10초 (Upbit 실시간)
  useEffect(() => {
    const id = setInterval(() => refreshCoins().then(() => setLastUpdated(Date.now())), 10000);
    return () => clearInterval(id);
  }, [refreshCoins]);
  // 미장 30초
  useEffect(() => { const id = setInterval(refreshUsStocks, 30000); return () => clearInterval(id); }, [refreshUsStocks]);
  // 국장 30초 (장중) + 15초 시뮬레이션 fallback
  useEffect(() => { const id = setInterval(refreshKoreanStocks, 30000); return () => clearInterval(id); }, [refreshKoreanStocks]);
  useEffect(() => { const id = setInterval(() => setKrStocks(p => simulateKorean(p)), 15000); return () => clearInterval(id); }, []);
  // 지수 1분
  useEffect(() => { const id = setInterval(refreshIndices, 60000); return () => clearInterval(id); }, [refreshIndices]);

  const allStocks = [...krStocks, ...usStocks];

  return (
    <div className="min-h-screen bg-[#F2F4F6]">
      <SurgeBanner stocks={allStocks} coins={coins} />
      <Header krwRate={krwRate} lastUpdated={lastUpdated} onRefresh={refreshAll} loading={loading} />

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

      <main className="max-w-4xl mx-auto px-3 pt-3">
        {activeTab === 'home' && <HomeTab krStocks={krStocks} usStocks={usStocks} coins={coins} indices={indices} coinUnit={coinUnit} onCardClick={setModal} onTabChange={setActiveTab} />}
        {activeTab === 'kr'   && <KoreanTab stocks={krStocks} onCardClick={setModal} />}
        {activeTab === 'us'   && <UsTab stocks={usStocks} onCardClick={setModal} />}
        {activeTab === 'etf'  && <EtfTab etfs={etfs} onCardClick={setModal} />}
        {activeTab === 'coin' && <CoinTab coins={coins} onCardClick={setModal} />}
      </main>

      {modal && <StockModal item={modal} coinUnit={coinUnit} onClose={() => setModal(null)} />}
    </div>
  );
}
