import { useState, useMemo } from 'react';
import SectorRotation from '../SectorRotation';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPct } from './utils';
import MarketPulseWidget from './widgets/MarketPulseWidget';
import WatchlistWidget from './widgets/WatchlistWidget';
import TopMoversWidget from './widgets/TopMoversWidget';
import NewsFeedWidget from './widgets/NewsFeedWidget';
import SignalWidget from './widgets/SignalWidget';
import MarketInvestorSection from './MarketInvestorSection';
// EventCalendar 삭제 — EventTicker 모달로 대체
import EventTicker from './EventTicker';
import CoinListingSection from './CoinListingSection';

export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [], etfs = [],
  krwRate = 1466, onItemClick, onNewsClick,
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

  // WIDGET 3: 주목할만한 움직임 — |changePct| 기준 혼합 정렬, 마켓별 최대 3개
  const notableMovers = useMemo(() => {
    const sorted = [...allItems]
      .filter(i => Math.abs(getPct(i)) >= 0.5)
      .sort((a, b) => Math.abs(getPct(b)) - Math.abs(getPct(a)));
    const result = [];
    const marketCount = { KR: 0, US: 0, COIN: 0 };
    for (const item of sorted) {
      const mkt = item._market;
      if (marketCount[mkt] >= 3) continue;
      result.push(item);
      marketCount[mkt]++;
      if (result.length >= 5) break;
    }
    return result;
  }, [allItems]);

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0 || etfs.length > 0;

  return (
    <div className="space-y-4">

      {/* ─── WIDGET 1: Market Pulse ───────────────────────── */}
      <MarketPulseWidget indices={indices} krwRate={krwRate} />

      {/* ─── 경제 이벤트 티커 (펄스↔관심종목 사이) ─────────── */}
      <EventTicker />

      {/* ─── WIDGET 2: 관심종목 ────────────────────────────── */}
      <WatchlistWidget watchedItems={watchedItems} toggle={toggle} onItemClick={onItemClick} krwRate={krwRate} />

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

      {/* ─── WIDGET 3: 주목할만한 움직임 ─────────────────── */}
      {notableMovers.length > 0 && (
        <TopMoversWidget
          movers={notableMovers}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {/* ─── WIDGET 4: 뉴스 피드 ──────────────────────────── */}
      <NewsFeedWidget allNews={allNews} onNewsClick={onNewsClick} />

      {/* ─── 코인 거래소 공지 ─────────────────────────────── */}
      <CoinListingSection />

      {/* ─── 하단 접힘: 섹터 로테이션 ─────────────────────── */}
      {(krStocks.length > 0 || usStocks.length > 0 || coins.length > 0) && (
        <div>
          <button
            onClick={() => setCollapsed(p => !p)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[12px] text-[#8B95A1] hover:text-[#4E5968] transition-colors"
          >
            <div className="flex-1 h-px bg-[#F2F4F6]" />
            <span>{collapsed ? '▼ 더보기 (섹터 로테이션)' : '▲ 접기'}</span>
            <div className="flex-1 h-px bg-[#F2F4F6]" />
          </button>
          {!collapsed && (
            <div className="mt-2">
              <SectorRotation krStocks={krStocks} usStocks={usStocks} coins={coins} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
