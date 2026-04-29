// 시그널 보드 위젯 — SignalSummaryWidget + SeoulForceSection 통합
// 카운터 3개 (강세/약세/중립) + 시그널 리스트 + 접기/펼치기 + 성적표 탭
import { useState, useCallback, useMemo, useEffect } from 'react';
import { cycleStep } from '../../utils/cycleTracker';
import { useTopSignals } from '../../hooks/useSignals';
import { extractName, getEasyLabel } from '../../utils/signalLabel';
import { SIGNAL_TYPES } from '../../engine/signalTypes';
import { useSignalAccuracy } from '../../hooks/useSignalAccuracy';
import { buildNarrative } from '../../utils/narrativeBuilder';
import { matchesKeywords, buildStockKeywords } from '../../utils/newsAlias';
import { KR_SECTOR_MAP } from '../../data/krStockList';
import { useWatchlist } from '../../hooks/useWatchlist';
import TickerLogo from './TickerLogo';
import SignalScorecardTab from './SignalScorecardTab';
import SignalInlinePanel from './SignalInlinePanel';

const FORCE_TYPES = [
  SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY,
  SIGNAL_TYPES.FOREIGN_CONSECUTIVE_SELL,
  SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_BUY,
  SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_SELL,
];

export default function SignalBoardWidget({ onItemClick, allItems = [], allNews = [] }) {
  // 탭 상태: 'live' | 'scorecard'
  const [activeTab, setActiveTab] = useState('live');
  // 모바일 기본 접힘 — 카운터만 노출
  const [expanded, setExpanded] = useState(false);
  // 방향 필터 — null=전체, 'bullish', 'bearish', 'neutral'
  const [filterDir, setFilterDir] = useState(null);
  // 인라인 결정 패널 — 펼쳐진 시그널 id (null=모두 닫힘)
  const [expandedId, setExpandedId] = useState(null);
  const allSignals = useTopSignals(20);
  const { botMap } = useSignalAccuracy();
  const { toggle: toggleWatch, isWatched } = useWatchlist();

  // 시그널별 내러티브 사전 계산 — symbol 기준 캐싱
  // sector 보강(KR), ±2시간 뉴스 매칭, 섹터 동조 종목 수 집계
  const narrativeMap = useMemo(() => {
    const map = new Map();
    if (!allSignals.length) return map;
    for (const sig of allSignals) {
      if (!sig.symbol) continue;
      // sector 보강 — meta.sector 없으면 KR 매핑 시도
      const sector = sig.meta?.sector
        || (sig.market === 'kr' ? KR_SECTOR_MAP.get(sig.symbol) : null);
      // 관련 뉴스 (±2시간 + 키워드 매칭) — timestamp 없거나 ms 범위 아니면 스킵
      const rawTs = sig.timestamp || sig.createdAt || null;
      const ts = rawTs && rawTs > 1_000_000_000_000 ? rawTs : null; // ms 단위 (13자리) 검증
      const market = sig.market === 'crypto' ? 'COIN' : sig.market?.toUpperCase();
      const keywords = buildStockKeywords(sig.symbol, sig.name, market);
      const relatedNews = (ts && keywords.length && allNews.length)
        ? allNews.filter(item => {
            const pubMs = item.pubDate ? new Date(item.pubDate).getTime() : 0;
            if (!Number.isFinite(pubMs) || !pubMs || Math.abs(ts - pubMs) > 2 * 60 * 60 * 1000) return false;
            const text = (item.title || '') + ' ' + (item.summary || item.description || '');
            return matchesKeywords(text, keywords);
          })
        : [];
      // 섹터 동조 — 시그널 방향 일치 + ±3% 이상 동반 종목 수 (자기 자신 제외)
      // neutral=0, bullish=1, bearish=-1 — changePct는 0이 falsy라 direction 우선
      const sigDir = sig.direction === 'bullish' ? 1 : sig.direction === 'bearish' ? -1 : Math.sign(sig.changePct ?? 0);
      const sectorPeers = (sector && allItems.length)
        ? allItems.filter(it => {
            if (it.symbol === sig.symbol) return false;
            if (!it.sector || it.sector !== sector) return false;
            if (Math.abs(it.changePct ?? 0) < 3) return false;
            return sigDir === 0 || Math.sign(it.changePct ?? 0) === sigDir;
          }).length
        : 0;
      const enriched = sector ? { ...sig, meta: { ...sig.meta, sector } } : sig;
      const narrative = buildNarrative({ signal: enriched, relatedNews, sectorPeers });
      map.set(sig.id, { narrative, relatedNews });
    }
    return map;
  }, [allSignals, allItems, allNews]);

  // 시그널 → 매칭 종목 (sparkline용)
  const matchedItemMap = useMemo(() => {
    const map = new Map();
    for (const sig of allSignals) {
      if (!sig.symbol) continue;
      const norm = sig.market === 'crypto' ? 'COIN' : sig.market?.toUpperCase();
      const it = allItems.find(x => x.symbol === sig.symbol && x._market === norm);
      if (it) map.set(sig.id, it);
    }
    return map;
  }, [allSignals, allItems]);

  // 필터 변경 시 펼침 상태 초기화
  useEffect(() => { setExpandedId(null); }, [filterDir]);

  const { bullSignals, bearSignals, neutralSignals, bullCount, bearCount, neutralCount } = useMemo(() => {
    const bull = [], bear = [], neutral = [];
    for (const s of allSignals) {
      if (s.direction === 'bullish') bull.push(s);
      else if (s.direction === 'bearish') bear.push(s);
      else neutral.push(s);
    }
    // 강도순 정렬
    bull.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    bear.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    neutral.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    return {
      bullSignals: bull, bearSignals: bear, neutralSignals: neutral,
      bullCount: bull.length, bearCount: bear.length, neutralCount: neutral.length,
    };
  }, [allSignals]);

  // 세력 포착 시그널 (강도 3 이상)
  const forceSignals = useMemo(
    () => allSignals.filter(s => FORCE_TYPES.includes(s.type) && s.strength >= 3),
    [allSignals],
  );

  // 적중률 높은 시그널 — totalFired >= 30 && accuracy >= 60인 현재 발화 시그널, 최대 2건
  const highAccuracySignals = useMemo(() => {
    return allSignals
      .filter(s => {
        const bot = botMap.get(s.type);
        return bot && bot.totalFired >= 30 && bot.accuracy >= 60;
      })
      .sort((a, b) => {
        const accA = botMap.get(a.type)?.accuracy ?? 0;
        const accB = botMap.get(b.type)?.accuracy ?? 0;
        return accB - accA;
      })
      .slice(0, 2);
  }, [allSignals, botMap]);

  // 통합 리스트: 모든 시그널 (세력 포착 포함)
  const combinedList = useMemo(() => {
    const all = [...bullSignals, ...bearSignals, ...neutralSignals];
    all.sort((a, b) => (b.strength || 0) - (a.strength || 0) || (b.timestamp || 0) - (a.timestamp || 0));
    return all;
  }, [bullSignals, bearSignals, neutralSignals]);

  // 방향 필터 적용
  const filteredCombinedList = useMemo(() => {
    if (!filterDir) return combinedList;
    if (filterDir === 'bullish') return bullSignals;
    if (filterDir === 'bearish') return bearSignals;
    return neutralSignals;
  }, [filterDir, combinedList, bullSignals, bearSignals, neutralSignals]);

  const displayList = expanded ? filteredCombinedList : filteredCombinedList.slice(0, 5);

  const handleClick = useCallback((signal) => {
    if (signal.symbol && onItemClick) {
      // market 정규화: 시그널 엔진은 'crypto'를 사용하지만 ChartSidePanel은 'coin' 기대
      const market = signal.market === 'crypto' ? 'coin' : signal.market;
      cycleStep('signal_click', { market, signal_type: signal.type });
      onItemClick({ symbol: signal.symbol, name: signal.name || signal.symbol, market });
    }
  }, [onItemClick]);

  // 시그널 카드 펼치기/접기 토글 (인라인 결정 패널)
  const handleToggleExpand = useCallback((signal) => {
    if (!signal.symbol) return;
    cycleStep('signal_expand', { market: signal.market, signal_type: signal.type });
    setExpandedId(prev => prev === signal.id ? null : signal.id);
  }, []);

  // 차트 보기 — 인라인 패널 액션
  const handleOpenChart = useCallback((signal) => {
    if (signal.symbol && onItemClick) {
      const market = signal.market === 'crypto' ? 'coin' : signal.market;
      cycleStep('signal_click', { market, signal_type: signal.type });
      onItemClick({ symbol: signal.symbol, name: signal.name || signal.symbol, market });
    }
  }, [onItemClick]);

  // 탭 헤더 공통
  const tabHeader = (
    <div className="flex items-center justify-between mb-5">
      <span className="text-[19px] font-bold text-[#191F28] tracking-tight">시그널 보드</span>
      <div className="flex bg-[#F2F4F6] rounded-lg p-0.5">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
            activeTab === 'live' ? 'bg-white text-[#191F28] shadow-sm' : 'text-[#8B95A1]'
          }`}
        >
          실시간
        </button>
        <button
          onClick={() => setActiveTab('scorecard')}
          className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
            activeTab === 'scorecard' ? 'bg-white text-[#191F28] shadow-sm' : 'text-[#8B95A1]'
          }`}
        >
          성적표
        </button>
      </div>
    </div>
  );

  // 성적표 탭 (시그널 0건이어도 접근 가능)
  if (activeTab === 'scorecard') {
    return (
      <div className="bg-white rounded-2xl px-5 pt-6 pb-4">
        {tabHeader}
        <SignalScorecardTab />
      </div>
    );
  }

  // 라이브 탭 — 시그널 0건일 때 빈 상태
  if (allSignals.length === 0) {
    return (
      <div className="bg-white rounded-2xl px-5 pt-6 pb-4">
        {tabHeader}
        <p className="text-[13px] text-[#8B95A1] leading-relaxed">
          시장을 분석 중이에요. 시그널이 포착되면 여기에 알려드릴게요.
        </p>
        <div className="space-y-2 mt-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-11 bg-[#F7F8FA] rounded-[10px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl px-5 pt-6 pb-4">
      {/* 헤더 + 탭 */}
      {tabHeader}

      {/* 카운터 3개 — 큰 숫자 + 레이블만 (카드 배경 없음) */}
      <div className="flex gap-8 mb-5 px-1">
        <button
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => { setExpanded(true); setFilterDir(d => d === 'bullish' ? null : 'bullish'); }}
        >
          <div className={`text-[28px] font-extrabold leading-none tracking-tight ${filterDir === 'bullish' ? 'underline underline-offset-4' : ''}`} style={{ color: '#F04452' }}>{bullCount}</div>
          <div className={`text-[12px] font-medium mt-1 ${filterDir === 'bullish' ? 'text-[#F04452] font-bold' : 'text-[#8B95A1]'}`}>강세 시그널</div>
        </button>
        <button
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => { setExpanded(true); setFilterDir(d => d === 'bearish' ? null : 'bearish'); }}
        >
          <div className={`text-[28px] font-extrabold leading-none tracking-tight ${filterDir === 'bearish' ? 'underline underline-offset-4' : ''}`} style={{ color: '#1764ED' }}>{bearCount}</div>
          <div className={`text-[12px] font-medium mt-1 ${filterDir === 'bearish' ? 'text-[#1764ED] font-bold' : 'text-[#8B95A1]'}`}>약세 시그널</div>
        </button>
        <button
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => { setExpanded(true); setFilterDir(d => d === 'neutral' ? null : 'neutral'); }}
        >
          <div className={`text-[28px] font-extrabold leading-none tracking-tight ${filterDir === 'neutral' ? 'underline underline-offset-4' : ''}`} style={{ color: '#8B95A1' }}>{neutralCount}</div>
          <div className={`text-[12px] font-medium mt-1 ${filterDir === 'neutral' ? 'text-[#4E5968] font-bold' : 'text-[#8B95A1]'}`}>중립</div>
        </button>
      </div>

      {/* 모바일: 카운터만 노출, 리스트는 접힌 상태 기본 — 펼치기 버튼으로 토글 */}
      {/* 데스크톱: 항상 표시 */}
      <div className={expanded ? '' : 'hidden lg:block'}>
        {/* 적중률 높은 시그널 (있을 때만) */}
        {highAccuracySignals.length > 0 && (
          <div className="mb-3 rounded-xl bg-[#F0FFF6] dark:bg-[#0D2A1A] px-3 py-2.5">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[12px] font-bold text-[#2AC769]">✅ 적중률 높은 시그널</span>
            </div>
            <div className="space-y-1">
              {highAccuracySignals.map(sig => {
                const acc = botMap.get(sig.type)?.accuracy ?? 0;
                const label = getEasyLabel(sig);
                const truncated = label.length > 40 ? label.slice(0, 40) + '…' : label;
                return (
                  <button
                    key={sig.id}
                    onClick={() => handleClick(sig)}
                    className="w-full flex items-center justify-between text-left gap-2 py-0.5"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[13px] font-semibold text-[#191F28] dark:text-[#E5E8EB] flex-shrink-0">
                        {extractName(sig)}
                      </span>
                      <span className="text-[12px] text-[#4E5968] dark:text-[#8B95A1] truncate">
                        {truncated}
                      </span>
                    </div>
                    <span
                      className="flex-shrink-0 text-[11px] font-bold px-1.5 py-[2px] rounded-full"
                      style={{ color: '#fff', background: '#2AC769' }}
                    >
                      {acc}%↑
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 세력 포착 (있을 때만) */}
        {forceSignals.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-bold text-[#191F28]">세력 포착</span>
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
                    onClick={() => handleClick(sig)}
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
        )}

        {/* 시그널 리스트 — 텍스트 색상으로 강세/약세 구분, 좌측 보더 없음 */}
        <div>
          {displayList.map((signal, idx) => {
            const isBull = signal.direction === 'bullish';
            const isBear = signal.direction === 'bearish';
            const nameColor = isBull ? '#F04452' : isBear ? '#1764ED' : '#191F28';
            const dotColor = isBull ? '#F04452' : isBear ? '#1764ED' : '#8B95A1';
            const narrativeData = narrativeMap.get(signal.id);
            const narrative = narrativeData?.narrative;
            const relatedNews = narrativeData?.relatedNews;
            const matchedItem = matchedItemMap.get(signal.id);
            const isExpanded = expandedId === signal.id;
            const watchedKey = matchedItem?.id || signal.symbol;
            const marketKey = signal.market === 'crypto' ? 'COIN' : signal.market?.toUpperCase();
            return (
              <div key={signal.id} className={idx > 0 ? 'border-t border-[#F2F3F5]' : ''}>
                <button
                  onClick={() => handleToggleExpand(signal)}
                  aria-expanded={isExpanded}
                  className={`w-full text-left flex items-center gap-3 py-[11px] px-2 rounded-[10px] transition-colors ${
                    signal.symbol ? 'cursor-pointer hover:bg-[#F2F3F5]' : ''
                  }`}
                >
                  {signal.symbol && (
                    <TickerLogo item={{ symbol: signal.symbol, name: signal.name, _market: signal.market === 'kr' ? 'KR' : signal.market === 'us' ? 'US' : signal.market === 'crypto' ? 'COIN' : '', id: signal.market === 'crypto' ? signal.symbol : undefined }} size={24} />
                  )}
                  <span className="text-[14px] font-semibold flex-shrink-0" style={{ color: nameColor }}>
                    {extractName(signal)}
                  </span>
                  <span className="text-[13px] text-[#8B95A1] truncate flex-1 min-w-0">
                    {getEasyLabel(signal)}
                    {/* 적중률 배지 */}
                    {(botMap.get(signal.type)?.totalFired ?? 0) >= 30 && (
                      <span
                        className="ml-1 text-[10px] font-bold px-1 py-[1px] rounded-full"
                        style={{
                          color: '#fff',
                          background: (botMap.get(signal.type)?.accuracy ?? 0) >= 70 ? '#2AC769'
                            : (botMap.get(signal.type)?.accuracy ?? 0) >= 50 ? '#FF9500' : '#F04452',
                        }}
                      >
                        {botMap.get(signal.type)?.accuracy ?? 0}%
                      </span>
                    )}
                  </span>
                  {/* 강도 도트 (원형) */}
                  <div className="flex gap-[3px] flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-[5px] h-[5px] rounded-full"
                        style={{
                          background: dotColor,
                          opacity: i < (signal.strength || 0) ? 1 : 0.15,
                        }}
                      />
                    ))}
                  </div>
                  {/* 펼치기 chevron */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className={`flex-shrink-0 text-[#B0B8C1] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {/* 내러티브 컨텍스트 — "왜 발화했는가" (매칭 부족 시 영역 숨김) */}
                {narrative && !isExpanded && (
                  <div className="px-2 pb-2 -mt-1 text-[11px] text-[#6B7684] dark:text-[#8B95A1] leading-snug">
                    🧩 컨텍스트: {narrative}
                  </div>
                )}
                {/* 인라인 결정 패널 */}
                <SignalInlinePanel
                  signal={signal}
                  narrative={narrative}
                  relatedNews={relatedNews}
                  matchedItem={matchedItem}
                  isOpen={isExpanded}
                  isWatched={isWatched(watchedKey, marketKey)}
                  onToggleWatch={() => toggleWatch(watchedKey, marketKey)}
                  onOpenChart={() => handleOpenChart(signal)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 더보기 / 접기 */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-center gap-1 text-[13px] font-semibold text-[#8B95A1] hover:text-[#4E5968] transition-colors mt-2 pt-2.5 pb-1"
      >
        {expanded ? '접기' : '더보기'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
    </div>
  );
}
