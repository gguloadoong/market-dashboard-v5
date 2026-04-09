import { DEFAULT_KRW_RATE } from '../../constants/market';
import { useState, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPct } from './utils';
import NewsFeedWidget from './widgets/NewsFeedWidget';
import NotableMoversSection from './NotableMoversSection';
import { useInvestorSignals } from '../../hooks/useInvestorSignals';
import { useDerivativeSignals } from '../../hooks/useDerivativeSignals';
import { useNewsSignals } from '../../hooks/useNewsSignals';
import { useCompositeSignals } from '../../hooks/useCompositeSignals';
import CommandCenterWidget from './CommandCenterWidget';
import SignalBoardWidget from './SignalBoardWidget';
import AiDebateSection from './AiDebateSection';
import ExploreTabsWidget from './ExploreTabsWidget';

export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [], etfs = [],
  krwRate = DEFAULT_KRW_RATE, onItemClick, onNewsClick, onTabChange,
  dataReady = true,
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

  // 뉴스 클러스터 시그널 (종목별 뉴스 3건+ 집중 감지)
  useNewsSignals(allNews, allItems);

  // 복합 퀀트 시그널 (TA + Flow + Sentiment → 방향성 점수)
  useCompositeSignals(allItems);

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
    if (full) {
      onItemClick(full);
    } else {
      // fallback: 코인은 id/market 정규화 필수 (fetchCandles, isCoinItem 호환)
      const isCoin = _market === 'COIN';
      onItemClick({
        ...sigItem,
        _market,
        market: isCoin ? 'coin' : (sigItem.market || _market.toLowerCase()),
        // 코인 id가 없으면 symbol 소문자로 대체 (CoinGecko fallback용)
        id: isCoin ? (sigItem.id || sym) : sigItem.id,
      });
    }
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
      className="space-y-3"
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

      {/* ─── 초기 로딩 가드 — 데이터 없으면 스켈레톤, 캐시만 있으면 갱신 중 표시 ── */}
      {!dataReady && !hasData && (
        <div className="space-y-3 animate-pulse">
          <div className="h-40 bg-[#F2F4F6] rounded-2xl" />
          <div className="h-32 bg-[#F2F4F6] rounded-2xl" />
          <div className="h-24 bg-[#F2F4F6] rounded-2xl" />
        </div>
      )}
      {!dataReady && hasData && (
        <div className="flex items-center justify-center gap-2 py-1.5 text-[11px] text-[#8B95A1]">
          <div className="w-3 h-3 border border-[#B0B8C1] border-t-transparent rounded-full animate-spin" />
          <span>시세 업데이트 중...</span>
        </div>
      )}

      {/* ─── 1. 커맨드 센터 (지수+온도+히어로시그널+관심종목+이벤트) ── */}
      <CommandCenterWidget
        indices={indices}
        krwRate={krwRate}
        allItems={allItems}
        watchedItems={watchedItems}
        popularItems={popularItems}
        onItemClick={onItemClick}
        toggle={toggle}
      />

      {/* ─── 2. 주목할 종목 (WHY 카드) ───────────────────── */}
      {hasData && (
        <NotableMoversSection
          allItems={allItems}
          recentNews={recentNews}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {/* ─── 3. 시그널 보드 (시그널 + 세력 포착 통합) ────── */}
      <SignalBoardWidget onItemClick={handleSignalItemClick} />

      {/* ─── 3.5. AI 종목토론 (별도 섹션) ──────────────── */}
      <AiDebateSection watchedItems={watchedItems} usStocks={usStocks} krStocks={krStocks} allItems={allItems} />

      {/* ─── 4. 탐색 탭 (급등/급락 + 섹터) ──────────────── */}
      <ExploreTabsWidget
        hasData={hasData}
        krHot={krHot} usHot={usHot} coinHot={coinHot}
        krDrop={krDrop} usDrop={usDrop} coinDrop={coinDrop}
        krwRate={krwRate}
        onItemClick={onItemClick}
        watchedItems={watchedItems}
        usStocks={usStocks}
        krStocks={krStocks}
        coins={coins}
        allItems={allItems}
        onTabChange={onTabChange}
      />

      {/* ─── 5. 뉴스 (모바일 전용 — 데스크톱은 우측 UnifiedFeedPanel) ── */}
      <div className="lg:hidden">
        <NewsFeedWidget allNews={allNews} onNewsClick={onNewsClick} onItemClick={onItemClick} allItems={allItems} />
      </div>

    </div>
  );
}
