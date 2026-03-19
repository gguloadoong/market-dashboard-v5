import { useState, useMemo } from 'react';
import SectorRotation from '../SectorRotation';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPct, findRelatedNewsMulti } from './utils';
import MarketPulseWidget from './widgets/MarketPulseWidget';
import WatchlistWidget from './widgets/WatchlistWidget';
import TopMoversWidget from './widgets/TopMoversWidget';
import NewsFeedWidget from './widgets/NewsFeedWidget';
import SignalWidget from './widgets/SignalWidget';
import MarketInvestorSection from './MarketInvestorSection';
import EventCalendar from './EventCalendar';
import CoinListingSection from './CoinListingSection';

export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [], etfs = [],
  krwRate = 1466, onItemClick,
}) {
  const { data: allNews = [] } = useAllNewsQuery();
  const { watchlist, toggle, isWatched } = useWatchlist();
  const [collapsed, setCollapsed] = useState(true);

  // 마켓 태그
  const krItems   = useMemo(() => [
    ...krStocks.map(s => ({ ...s, _market: 'KR' })),
    ...etfs.filter(e => e.market === 'kr').map(e => ({ ...e, _market: 'KR', _isEtf: true })),
  ], [krStocks, etfs]);
  const usItems   = useMemo(() => [
    ...usStocks.map(s => ({ ...s, _market: 'US' })),
    ...etfs.filter(e => e.market === 'us').map(e => ({ ...e, _market: 'US', _isEtf: true })),
  ], [usStocks, etfs]);
  const coinItems = useMemo(() => coins.map(c => ({ ...c, _market: 'COIN' })), [coins]);
  const allItems  = useMemo(() => [...krItems, ...usItems, ...coinItems], [krItems, usItems, coinItems]);

  // 7일 이내 뉴스
  const recentNews = useMemo(() => {
    if (!allNews.length) return [];
    const cutoff = 7 * 24 * 60 * 60 * 1000;
    return allNews.filter(n => {
      if (!n.pubDate) return false;
      try { return Date.now() - new Date(n.pubDate).getTime() < cutoff; } catch { return false; }
    });
  }, [allNews]);

  // WIDGET 2: 관심종목
  const watchedItems = useMemo(
    () => allItems.filter(i => isWatched(i.id || i.symbol)),
    [allItems, watchlist] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // WIDGET 3: 급등/급락 TOP5
  const krHot   = useMemo(() => [...krItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [krItems]);
  const usHot   = useMemo(() => [...usItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [usItems]);
  const coinHot = useMemo(() => [...coinItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [coinItems]);
  const krDrop  = useMemo(() => [...krItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [krItems]);
  const usDrop  = useMemo(() => [...usItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [usItems]);
  const coinDrop= useMemo(() => [...coinItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [coinItems]);

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0 || etfs.length > 0;

  return (
    <div className="space-y-4">

      {/* ─── WIDGET 1: Market Pulse ───────────────────────── */}
      <MarketPulseWidget indices={indices} krwRate={krwRate} />

      {/* ─── WIDGET 2: 관심종목 ────────────────────────────── */}
      <WatchlistWidget watchedItems={watchedItems} toggle={toggle} onItemClick={onItemClick} />

      {/* ─── WIDGET 5: Signal (이유 있는 움직임 + 선행신호) ── */}
      {hasData && (
        <SignalWidget
          allItems={allItems}
          recentNews={recentNews}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {/* ─── 시장 투자자 동향 ─────────────────────────────── */}
      <MarketInvestorSection />

      {/* ─── WIDGET 3: 급등/급락 ─────────────────────────── */}
      <TopMoversWidget
        hasData={hasData}
        krHot={krHot} usHot={usHot} coinHot={coinHot}
        krDrop={krDrop} usDrop={usDrop} coinDrop={coinDrop}
        krwRate={krwRate}
        onItemClick={onItemClick}
      />

      {/* ─── WIDGET 4: 뉴스 피드 ──────────────────────────── */}
      <NewsFeedWidget allNews={allNews} />

      {/* ─── 코인 거래소 공지 ─────────────────────────────── */}
      <CoinListingSection />

      {/* ─── 하단 접힘: 섹터 로테이션 + 이벤트 캘린더 ──────── */}
      <div>
        <button
          onClick={() => setCollapsed(p => !p)}
          className="w-full flex items-center justify-center gap-2 py-2 text-[12px] text-[#8B95A1] hover:text-[#4E5968] transition-colors"
        >
          <div className="flex-1 h-px bg-[#F2F4F6]" />
          <span>{collapsed ? '▼ 더보기 (섹터·캘린더)' : '▲ 접기'}</span>
          <div className="flex-1 h-px bg-[#F2F4F6]" />
        </button>

        {!collapsed && (
          <div className="space-y-4 mt-2">
            {(krStocks.length > 0 || usStocks.length > 0 || coins.length > 0) && (
              <SectorRotation krStocks={krStocks} usStocks={usStocks} coins={coins} />
            )}
            <EventCalendar />
          </div>
        )}
      </div>
    </div>
  );
}
