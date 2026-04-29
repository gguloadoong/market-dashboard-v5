import { DEFAULT_KRW_RATE } from '../../constants/market';
import { useState, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPct } from './utils';
import { itemKey, isPreferredOrSpecial } from '../../utils/symbolKey';
import NewsFeedWidget from './widgets/NewsFeedWidget';
import NotableMoversSection from './NotableMoversSection';
import { useInvestorSignals } from '../../hooks/useInvestorSignals';
import { useDerivativeSignals } from '../../hooks/useDerivativeSignals';
import { useNewsSignals } from '../../hooks/useNewsSignals';
import { useServerSignals } from '../../hooks/useServerSignals';
import CommandCenterWidget from './CommandCenterWidget';
import SignalBoardWidget from './SignalBoardWidget';
import AiDebateSection from './AiDebateSection';
import ExploreTabsWidget from './ExploreTabsWidget';

export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [], etfs = [],
  krwRate = DEFAULT_KRW_RATE, krwRateLoaded = false, onItemClick, onNewsClick, onTabChange,
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
  // US 우선주/워런트/시리즈 주 2차 방어 — 서버 필터 실패 대비 (#183)
  const usItems   = useMemo(() => [
    ...usStocks.filter(s => !isPreferredOrSpecial(s.symbol)).map(s => ({ ...s, _market: 'US' })),
    ...etfs.filter(e => e.market === 'us').map(e => ({ ...e, _market: 'US', _isEtf: true })),
  ], [usStocks, etfs]);
  const coinItems = useMemo(() => coins.map(c => ({ ...c, _market: 'COIN' })), [coins]);

  // 복합키 `${_market}:${symbol}` 기반 dedup — 서버 중복 공급(동일 market 내 중복 행) 방어 (#183)
  // 크로스마켓 충돌(US:META vs COIN:META)은 키가 달라 자연히 분리됨
  // 동일 market 내 중복 시에만 거래량 큰 쪽 유지 (단위가 같아 비교 유효)
  const allItems  = useMemo(() => {
    const seen = new Map();
    const source = [...krItems, ...usItems, ...coinItems];
    for (const it of source) {
      const k = itemKey(it);
      const prev = seen.get(k);
      if (!prev) { seen.set(k, it); continue; }
      const curVol = it._market === 'COIN' ? (it.volume24h ?? 0) : (it.volume ?? 0);
      const prevVol = prev._market === 'COIN' ? (prev.volume24h ?? 0) : (prev.volume ?? 0);
      if (curVol > prevVol) seen.set(k, it);
    }
    return [...seen.values()];
  }, [krItems, usItems, coinItems]);

  // 레버리지·인버스·미분류 ETF 제외 — 시그널 엔진 오발화 방지
  // _isEtf 플래그는 krItems/usItems spread 시 항상 true로 세팅됨 (보장)
  // KRX 동적 ETF는 category:'ETF'로 오므로 허용 목록이 아닌 차단 목록 방식 사용
  // 차단: 레버리지, 인버스, 'ETF'(KRX 미분류). 허용: 코인ETF(IBIT 크로스마켓 페어 등)
  const stockItems = useMemo(
    () => allItems.filter(i => !i._isEtf || (i.category !== '레버리지' && i.category !== '인버스' && i.category !== 'ETF')),
    [allItems],
  );

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
    () => allItems.filter(i => isWatched(i.id || i.symbol, i._market || i.market)),
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

  // 투자자 시그널 스캔 (15분 간격 폴링) — 레버리지/인버스 ETF 제외 (일반 ETF·코인ETF 포함)
  // krwRate 주입 — fx_impact 시그널 발화용 (#113)
  useInvestorSignals(stockItems, krwRate, krwRateLoaded);

  // 파생/소셜 시그널 스캔 (PCR, 펀딩비, 주문장, VWAP, 소셜)
  const watchlistSymbols = useMemo(() => watchedItems.map(i => i.symbol).filter(Boolean), [watchedItems]);
  useDerivativeSignals({ usStocks, krStocks, watchlistSymbols });

  // 뉴스 클러스터 시그널 (종목별 뉴스 3건+ 집중 감지) — 레버리지/인버스 ETF 제외
  useNewsSignals(allNews, stockItems);

  // 서버 사전 계산 시그널 (composite_score + 패턴) — KV에서 1분 폴링 (#213)
  useServerSignals();

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
      <SignalBoardWidget onItemClick={handleSignalItemClick} allItems={allItems} allNews={allNews} />

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
