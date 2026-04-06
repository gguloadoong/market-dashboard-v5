import { useState, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPct } from './utils';
import MarketPulseWidget from './widgets/MarketPulseWidget';
import WatchlistWidget from './widgets/WatchlistWidget';
import TopMoversWidget from './widgets/TopMoversWidget';
import NewsFeedWidget from './widgets/NewsFeedWidget';
import EventTicker from './EventTicker';
import SignalSummaryWidget from './SignalSummaryWidget';
import NotableMoversSection from './NotableMoversSection';
import { useInvestorSignals } from '../../hooks/useInvestorSignals';
import { useDerivativeSignals } from '../../hooks/useDerivativeSignals';
import MarketSentimentWidget from './widgets/MarketSentimentWidget';
import AiDebateSection from './AiDebateSection';
import { useSignals } from '../../hooks/useSignals';
import { SIGNAL_TYPES } from '../../engine/signalTypes';
import { clampPct } from '../../utils/clampPct';

// ─── 세력 포착 (외국인·기관 연속 매수매도) ──
function SeoulForceSection({ signals, onItemClick }) {
  const FORCE_TYPES = [
    SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY,
    SIGNAL_TYPES.FOREIGN_CONSECUTIVE_SELL,
    SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_BUY,
    SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_SELL,
  ];
  const forceSignals = signals.filter(s => FORCE_TYPES.includes(s.type) && s.strength >= 3);
  if (!forceSignals.length) return null;

  return (
    <div className="bg-white rounded-xl border border-[#ECEEF1] p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[12px] font-bold text-[#191F28]">세력 포착</span>
        <span className="text-[10px] text-[#B0B8C1]">외국인·기관 연속 매수매도</span>
      </div>
      <div className="space-y-1.5">
        {forceSignals.slice(0, 3).map(sig => {
          const isBull = sig.direction === 'bullish';
          const typeLabel = sig.type.includes('foreign') ? '외국인' : '기관';
          const dirLabel = isBull ? '연속 매수' : '연속 매도';
          return (
            <button
              key={sig.symbol + sig.type + (sig.timestamp || '')}
              onClick={() => onItemClick?.({ symbol: sig.symbol, name: sig.name, market: sig.market })}
              className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left"
              style={{ background: isBull ? '#F0FFF6' : '#FFF0F1' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold" style={{ color: isBull ? '#2AC769' : '#F04452' }}>
                  {typeLabel}
                </span>
                <span className="text-[12px] font-bold text-[#191F28]">{sig.name}</span>
                <span className="text-[11px] text-[#8B95A1]">{dirLabel} {sig.meta?.consecutiveDays || sig.strength}일+</span>
              </div>
              <span className="text-[10px] text-[#B0B8C1]">차트 →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
      map[s.sector].sum += clampPct(s.changePct ?? 0);
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
    <div className="bg-white rounded-xl border border-[#ECEEF1] p-4">
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
  const queryClient = useQueryClient();
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

  // 파생/소셜 시그널 스캔 (PCR, 펀딩비, 주문장, VWAP, 소셜)
  const watchlistSymbols = useMemo(() => watchedItems.map(i => i.symbol).filter(Boolean), [watchedItems]);
  useDerivativeSignals({ usStocks, krStocks, watchlistSymbols });

  // 세력 포착용 시그널 — 전체 시그널에서 필터 (top-20 슬라이스 전에 투자자 시그널 놓치지 않도록)
  const allSignals = useSignals();

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0 || etfs.length > 0;

  // 시그널 클릭 → allItems에서 full item 조회 후 ChartSidePanel 오픈
  const handleSignalItemClick = useCallback((sigItem) => {
    if (!sigItem?.symbol || !onItemClick) return;
    const marketMap = { crypto: 'COIN', coin: 'COIN', us: 'US', kr: 'KR' };
    const _market = marketMap[(sigItem.market || '').toLowerCase()] ||
                    (sigItem._market || '').toUpperCase() || 'US';
    const sym = sigItem.symbol.toLowerCase();
    const full = allItems.find(i =>
      i.symbol?.toLowerCase() === sym || i.id?.toLowerCase() === sym,
    );
    onItemClick(full || { ...sigItem, _market });
  }, [allItems, onItemClick]);

  // ─── Pull-to-refresh ──────────────────────────────────────
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
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
      setRefreshing(true); // 먼저 refreshing 상태 설정
      queryClient.invalidateQueries().then(() => setRefreshing(false)); // 완료 후 해제
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, queryClient]);

  return (
    <div
      className="space-y-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >

      {/* ─── Pull-to-refresh 인디케이터 ──────────────────── */}
      {(pulling || refreshing) && (
        <div className="flex flex-col items-center justify-center py-3 text-[#3182F6] transition-all"
          style={{ height: pulling ? pullDistance : 40, opacity: pulling ? Math.min(pullDistance / 60, 1) : 1 }}>
          <div className={`w-5 h-5 border-2 border-[#3182F6] border-t-transparent rounded-full ${pullDistance > 60 || refreshing ? 'animate-spin' : ''}`} />
          <span className="text-[10px] mt-1 text-[#8B95A1]">
            {refreshing ? '새로고침 중...' : pullDistance > 60 ? '놓으면 새로고침' : '당겨서 새로고침'}
          </span>
        </div>
      )}

      {/* ─── 1. 시장 지수 + 환율 ──────────────────────────── */}
      <MarketPulseWidget indices={indices} krwRate={krwRate} />

      {/* ─── 2. 시장 심리 (온도계 + 공포탐욕 통합 예정) ─────── */}
      <MarketSentimentWidget allItems={allItems} />

      {/* ─── 3. 주목할 종목 (WHY 카드) ───────────────────── */}
      {hasData && (
        <NotableMoversSection
          allItems={allItems}
          recentNews={recentNews}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {/* ─── 4. 투자 시그널 (강세/약세 분리) ─────────────── */}
      <SignalSummaryWidget onItemClick={handleSignalItemClick} />

      {/* ─── 5. 세력 포착 (외국인·기관 연속 매수매도) ──────── */}
      <SeoulForceSection signals={allSignals} onItemClick={handleSignalItemClick} />

      {/* ─── 6. 관심종목 (v2 크기, 컴팩트) ────────────────── */}
      <WatchlistWidget
        watchedItems={watchedItems}
        popularItems={popularItems}
        toggle={toggle}
        onItemClick={onItemClick}
        krwRate={krwRate}
      />

      {/* ─── 7. AI 종목토론 ("살 이유 vs 조심할 이유") ───── */}
      <AiDebateSection watchedItems={watchedItems} usStocks={usStocks} />

      {/* ─── 8. 급등/급락 ────────────────────────────────── */}
      <TopMoversWidget
        hasData={hasData}
        krHot={krHot} usHot={usHot} coinHot={coinHot}
        krDrop={krDrop} usDrop={usDrop} coinDrop={coinDrop}
        krwRate={krwRate}
        onItemClick={onItemClick}
      />

      {/* ─── 9. 뉴스 ────────────────────────────────────── */}
      <NewsFeedWidget allNews={allNews} onNewsClick={onNewsClick} onItemClick={onItemClick} allItems={allItems} />

      {/* ─── 10. 경제 이벤트 (원래 위치) ──────────────────── */}
      <EventTicker />

    </div>
  );
}
