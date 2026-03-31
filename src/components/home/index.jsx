import { useState, useRef, useMemo, useCallback } from 'react';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPct } from './utils';
import MorningBriefing from './MorningBriefing';
import MarketPulseWidget from './widgets/MarketPulseWidget';
import WatchlistWidget from './widgets/WatchlistWidget';
import TopMoversWidget from './widgets/TopMoversWidget';
import NewsFeedWidget from './widgets/NewsFeedWidget';
import FearGreedWidget from './widgets/FearGreedWidget';
import NotableMoversSection from './NotableMoversSection';
import MarketInvestorSection from './MarketInvestorSection';
import EventTicker from './EventTicker';
import SignalSummaryWidget from './SignalSummaryWidget';
import SignalFeed from './SignalFeed';
import MarketTimeline from './MarketTimeline';
import { useInvestorSignals } from '../../hooks/useInvestorSignals';

// ─── 섹터 미니 위젯 (HOT 5 + COLD 5 칩 + 클릭 drill-down) ──
function SectorMiniWidget({ krStocks, usStocks, coins, onTabChange, allItems, onItemClick }) {
  const [expandedSector, setExpandedSector] = useState(null);

  const sectors = useMemo(() => {
    const coinsWithPct = coins.filter(c => c.sector).map(c => ({ ...c, changePct: c.change24h ?? 0 }));
    const items = [...krStocks, ...usStocks, ...coinsWithPct];
    const map = {};
    for (const s of items) {
      if (!s.sector) continue;
      if (!map[s.sector]) map[s.sector] = { sum: 0, count: 0 };
      map[s.sector].sum += s.changePct ?? 0;
      map[s.sector].count += 1;
    }
    return Object.entries(map)
      .map(([name, { sum, count }]) => ({ name, avg: parseFloat((sum / count).toFixed(2)) }))
      .sort((a, b) => b.avg - a.avg);
  }, [krStocks, usStocks, coins]);

  // 펼쳐진 섹터의 종목 리스트
  const expandedItems = useMemo(() => {
    if (!expandedSector || !allItems) return [];
    return allItems
      .filter(i => i.sector === expandedSector)
      .sort((a, b) => (getPct(b) || 0) - (getPct(a) || 0))
      .slice(0, 10);
  }, [expandedSector, allItems]);

  if (!sectors.length) return null;

  const hot  = sectors.filter(s => s.avg > 0).slice(0, 5);
  const cold = [...sectors.filter(s => s.avg <= 0)].reverse().slice(0, 5);

  // 섹터 칩 클릭 핸들러
  const handleSectorClick = (sectorName) => {
    setExpandedSector(prev => prev === sectorName ? null : sectorName);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#191F28]">섹터 자금 흐름</span>
          <span className="text-[10px] text-[#B0B8C1]">HOT · COLD</span>
        </div>
        <button
          onClick={() => onTabChange?.('sector')}
          className="text-[11px] text-[#3182F6] font-medium hover:underline"
        >섹터 탭에서 상세 →</button>
      </div>
      <div className="flex gap-4">
        {/* HOT */}
        <div className="flex-1">
          <span className="text-[10px] font-bold text-[#F04452] uppercase mb-1.5 block">HOT</span>
          <div className="flex flex-wrap gap-1.5">
            {hot.length > 0 ? hot.map(s => (
              <button
                key={s.name}
                onClick={() => handleSectorClick(s.name)}
                className={`text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                  expandedSector === s.name
                    ? 'bg-[#F04452] text-white'
                    : 'bg-[#FFF0F1] text-[#F04452] hover:bg-[#FFE0E3]'
                }`}
              >
                {s.name} +{s.avg.toFixed(1)}%
              </button>
            )) : <span className="text-[10px] text-[#B0B8C1]">없음</span>}
          </div>
        </div>
        {/* COLD */}
        <div className="flex-1">
          <span className="text-[10px] font-bold text-[#1764ED] uppercase mb-1.5 block">COLD</span>
          <div className="flex flex-wrap gap-1.5">
            {cold.length > 0 ? cold.map(s => (
              <button
                key={s.name}
                onClick={() => handleSectorClick(s.name)}
                className={`text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                  expandedSector === s.name
                    ? 'bg-[#1764ED] text-white'
                    : 'bg-[#EDF4FF] text-[#1764ED] hover:bg-[#DCE8FF]'
                }`}
              >
                {s.name} {s.avg.toFixed(1)}%
              </button>
            )) : <span className="text-[10px] text-[#B0B8C1]">없음</span>}
          </div>
        </div>
      </div>

      {/* 섹터 drill-down: 종목 리스트 인라인 펼침 */}
      {expandedSector && expandedItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#F2F4F6]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#191F28]">{expandedSector} 종목</span>
            <button
              onClick={() => setExpandedSector(null)}
              className="text-[10px] text-[#B0B8C1] hover:text-[#4E5968]"
            >접기 ✕</button>
          </div>
          <div className="space-y-1">
            {expandedItems.map(item => {
              const pct = getPct(item) || 0;
              const color = pct > 0 ? '#F04452' : pct < 0 ? '#1764ED' : '#8B95A1';
              return (
                <button
                  key={item.symbol || item.id}
                  onClick={() => onItemClick?.(item)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F7F8FA] active:bg-[#F2F4F6] transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-medium text-[#191F28] truncate block">{item.name || item.symbol}</span>
                    <span className="text-[10px] text-[#8B95A1] font-mono">{item.symbol}</span>
                  </div>
                  <span className="text-[12px] font-bold font-mono tabular-nums flex-shrink-0 ml-2" style={{ color }}>
                    {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [], etfs = [],
  krwRate = 1466, onItemClick, onNewsClick, onTabChange,
}) {
  const { data: allNews = [] } = useAllNewsQuery();
  const { watchlist, toggle, isWatched } = useWatchlist();

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

  // 관심종목
  const watchedItems = useMemo(
    () => allItems.filter(i => isWatched(i.id || i.symbol)),
    [allItems, watchlist] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 관심종목 빈 상태 시 인기 종목 추천 (거래량 기준 마켓 혼합 TOP5)
  const popularItems = useMemo(() => {
    if (watchedItems.length > 0) return [];
    const getVol = i => i._market === 'COIN' ? (i.volume24h ?? 0) : (i.volume ?? 0);
    const sorted = [...allItems].sort((a, b) => getVol(b) - getVol(a));
    const result = [];
    const mktCount = { KR: 0, US: 0, COIN: 0 };
    for (const item of sorted) {
      if (mktCount[item._market] >= 2) continue;
      result.push(item);
      mktCount[item._market]++;
      if (result.length >= 3) break;
    }
    return result;
  }, [watchedItems.length, allItems]);

  // 급등/급락 TOP5
  const krHot   = useMemo(() => [...krItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [krItems]);
  const usHot   = useMemo(() => [...usItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [usItems]);
  const coinHot = useMemo(() => [...coinItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [coinItems]);
  const krDrop  = useMemo(() => [...krItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [krItems]);
  const usDrop  = useMemo(() => [...usItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [usItems]);
  const coinDrop= useMemo(() => [...coinItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [coinItems]);

  // 투자자 시그널 스캔 (5분 간격 폴링)
  useInvestorSignals(allItems);

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0 || etfs.length > 0;

  // ─── Pull-to-refresh ──────────────────────────────────────
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);

  const onTouchStart = useCallback((e) => {
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (window.scrollY > 0) return; // 스크롤 중이면 무시
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPullDistance(Math.min(dy * 0.4, 80));
      setPulling(true);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullDistance > 60) {
      window.location.reload();
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance]);

  return (
    <div
      className="space-y-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >

      {/* ─── Pull-to-refresh 인디케이터 ──────────────────── */}
      {pulling && pullDistance > 10 && (
        <div className="flex justify-center items-center overflow-hidden transition-all" style={{ height: pullDistance }}>
          <span className={`text-[20px] text-[#B0B8C1] ${pullDistance > 60 ? 'animate-spin' : ''}`}>↻</span>
        </div>
      )}

      {/* ─── 모닝 브리핑 ─────────────────────────────────── */}
      <MorningBriefing />

      {/* ─── WIDGET 1: Market Pulse ───────────────────────── */}
      <MarketPulseWidget indices={indices} krwRate={krwRate} />

      {/* ─── 투자 시그널 요약 ─────────────────────────────── */}
      <SignalSummaryWidget onItemClick={onItemClick} />

      {/* ─── 3시장 통합 시그널 피드 ──────────────────────── */}
      <SignalFeed onItemClick={onItemClick} />

      {/* ─── 주목할 종목 (히어로 영역) ───────────────────── */}
      {hasData && (
        <NotableMoversSection
          allItems={allItems}
          recentNews={recentNews}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {/* ─── 공포탐욕 지수 + 경제 이벤트 티커 ─────────────── */}
      <FearGreedWidget />
      <EventTicker />

      {/* ─── 관심종목 + 섹터 흐름 (2열 나란히, 모바일은 세로) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WatchlistWidget
          watchedItems={watchedItems}
          popularItems={popularItems}
          toggle={toggle}
          onItemClick={onItemClick}
          krwRate={krwRate}
        />
        {(krStocks.length > 0 || usStocks.length > 0 || coins.length > 0) && (
          <SectorMiniWidget krStocks={krStocks} usStocks={usStocks} coins={coins} onTabChange={onTabChange} allItems={allItems} onItemClick={onItemClick} />
        )}
      </div>

      {/* ─── 급등/급락 6박스 (첫 화면에 걸치도록 승격) ──── */}
      <TopMoversWidget
        hasData={hasData}
        krHot={krHot} usHot={usHot} coinHot={coinHot}
        krDrop={krDrop} usDrop={usDrop} coinDrop={coinDrop}
        krwRate={krwRate}
        onItemClick={onItemClick}
      />

      {/* ─── 시장을 움직이는 뉴스 (종목 연결 카드) ──────────── */}
      <NewsFeedWidget allNews={allNews} onNewsClick={onNewsClick} onItemClick={onItemClick} allItems={allItems} />

      {/* ─── 오늘의 타임라인 ────────────────────────────────── */}
      <MarketTimeline />

      {/* ─── 시장 투자자 동향 (모바일 숨김) ────────────────── */}
      <div className="hidden md:block">
        <MarketInvestorSection />
      </div>

    </div>
  );
}
