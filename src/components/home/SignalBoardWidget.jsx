// 시그널 보드 위젯 — SignalSummaryWidget + SeoulForceSection 통합
// 카운터 3개 (강세/약세/중립) + 시그널 리스트 + 접기/펼치기 + 성적표 탭
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { cycleStep } from '../../utils/cycleTracker';
import { useTopSignals } from '../../hooks/useSignals';
import { extractName, getEasyLabel } from '../../utils/signalLabel';
import { isMarketIndicatorSignal } from '../../engine/signalTypes';
import { useSignalCharacters } from '../../hooks/useSignalCharacters';
import { buildTypeCharacterMap, characterBadge } from '../../utils/signalCharacterMap';
import { buildNarrative } from '../../utils/narrativeBuilder';
import { matchesKeywords, buildStockKeywords } from '../../utils/newsAlias';
import { KR_SECTOR_MAP } from '../../data/krStockList';
import { useWatchlist } from '../../hooks/useWatchlist';
import TickerLogo from './TickerLogo';
import SignalScorecardTab from './SignalScorecardTab';
import SignalInlinePanel from './SignalInlinePanel';

export default function SignalBoardWidget({ onItemClick, allItems = [], allNews = [], scorecardTrigger = 0 }) {
  // 탭 상태: 'live' | 'scorecard'
  const [activeTab, setActiveTab] = useState('live');
  // 모바일 기본 접힘 — 카운터만 노출
  const [expanded, setExpanded] = useState(false);

  const rootRef = useRef(null);

  // HeroSignalCard 브리지에서 scorecardTrigger가 바뀌면 성적표 탭으로 전환 + 스크롤
  useEffect(() => {
    if (scorecardTrigger > 0) {
      setActiveTab('scorecard');
      setExpanded(true);
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scorecardTrigger]);
  // 방향 필터 — null=전체, 'bullish', 'bearish', 'neutral'
  const [filterDir, setFilterDir] = useState(null);
  // 인라인 결정 패널 — 펼쳐진 시그널 id (null=모두 닫힘)
  const [expandedId, setExpandedId] = useState(null);
  const allSignals = useTopSignals(20);
  // #400: 적중률 표시는 성적표와 동일한 캐릭터(공정측정 v2) 단일 기준 — raw 측정 botMap 제거
  const { characters } = useSignalCharacters();
  const charByType = useMemo(() => buildTypeCharacterMap(characters), [characters]);
  const { toggle: toggleWatch, isWatched } = useWatchlist();

  // #394: allItems는 WS 틱마다 identity가 바뀜 — 내러티브(뉴스 매칭+섹터 동조 카운트)가
  // 틱마다 재계산되지 않도록 ref로 분리. 섹터 동조 수는 1~2초 stale이어도 무방.
  const allItemsRef = useRef(allItems);
  useEffect(() => { allItemsRef.current = allItems; }, [allItems]);

  // 시그널별 내러티브 사전 계산 — symbol 기준 캐싱
  // sector 보강(KR), ±2시간 뉴스 매칭, 섹터 동조 종목 수 집계
  const narrativeMap = useMemo(() => {
    const allItems = allItemsRef.current;
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
  }, [allSignals, allNews]); // allItems는 ref로 읽음 (#394 — 틱 의존 분리)

  // allItems O(1) 조회 맵
  const allItemsLookup = useMemo(() => {
    const m = new Map();
    for (const it of allItems) m.set(`${it._market}:${it.symbol}`, it);
    return m;
  }, [allItems]);

  // 시그널 → 매칭 종목 (sparkline용)
  const matchedItemMap = useMemo(() => {
    const map = new Map();
    for (const sig of allSignals) {
      if (!sig.symbol) continue;
      const norm = sig.market === 'crypto' ? 'COIN' : sig.market?.toUpperCase();
      const it = allItemsLookup.get(`${norm}:${sig.symbol}`);
      if (it) map.set(sig.id, it);
    }
    return map;
  }, [allSignals, allItemsLookup]);

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

  // (#400) '적중률 높은 시그널' 박스 제거 — raw 측정 기반 + 카드 캐릭터 배지와 중복

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
    // 시장 지표 시그널(공포탐욕 등)은 종목이 아니므로 클릭 차단 (#341)
    if (isMarketIndicatorSignal(signal)) return;
    // matchedItemMap — crypto→COIN 정규화된 O(1) Map 재사용. null이면 가짜 종목 카드 차단 (#343)
    if (!matchedItemMap.get(signal.id)) return;
    if (signal.symbol && onItemClick) {
      // market 정규화: 시그널 엔진은 'crypto'를 사용하지만 ChartSidePanel은 'coin' 기대
      const market = signal.market === 'crypto' ? 'coin' : signal.market;
      cycleStep('signal_click', { market, signal_type: signal.type });
      // type 전달 — 상위 핸들러(handleSignalItemClick)의 시장 지표 안전망 작동용 (#341)
      onItemClick({ symbol: signal.symbol, name: signal.name || signal.symbol, market, type: signal.type });
    }
  }, [onItemClick, matchedItemMap]);

  // 시그널 카드 펼치기/접기 토글 — 펼칠 때만 이벤트 발화 (StrictMode 안전)
  const handleToggleExpand = useCallback((signal) => {
    if (!signal.symbol) return;
    // 시장 지표 시그널(공포탐욕 등)은 종목 상세 패널이 없으므로 펼치기 차단 (#341)
    if (isMarketIndicatorSignal(signal)) return;
    const willExpand = expandedId !== signal.id;
    if (willExpand) cycleStep('signal_expand', { market: signal.market, signal_type: signal.type });
    setExpandedId(willExpand ? signal.id : null);
  }, [expandedId]);

  // 탭 헤더 공통 — 역할 1줄 명시 (#400): 이 섹션은 "알고리즘 신호", 적중률은 성적표와 동일 기준
  const tabHeader = (
    <div className="flex items-center justify-between mb-5">
      <div className="min-w-0">
        <span className="text-[19px] font-bold text-[#191F28] tracking-tight">시그널 보드</span>
        <p className="text-[11px] text-[#8B95A1] mt-0.5">알고리즘이 포착한 매매 신호 — 적중률은 성적표와 같은 공정 측정</p>
      </div>
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
    <div ref={rootRef} className="bg-white rounded-2xl px-5 pt-6 pb-4">
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
            // #400: 카드와 성적표가 같은 캐릭터·같은 공정 적중률로 말하게.
            // gate(market/direction) 비매칭 슬라이스는 배지 없음 — 측정 주장 안 함 (review HIGH)
            const charBadge = characterBadge(charByType.get(signal.type), signal);
            const isExpanded = expandedId === signal.id;
            const watchedKey = matchedItem?.id || signal.symbol;
            const marketKey = signal.market === 'crypto' ? 'COIN' : signal.market?.toUpperCase();
            // 시장 지표 시그널 + 종목 풀에 없는 stock은 클릭/로고/펼치기 비활성 (#341, #343)
            // matchedItemMap(crypto→COIN 정규화, O(1))을 재사용 — 로고와 클릭 판정 소스 일치 보장
            // (market 시그널은 리스트에 정보 행으로 남기고 클릭/로고만 차단)
            const isClickable = !!signal.symbol && !isMarketIndicatorSignal(signal) && !!matchedItem;
            return (
              <div key={signal.id} className={idx > 0 ? 'border-t border-[#F2F3F5]' : ''}>
                <button
                  onClick={isClickable ? () => handleToggleExpand(signal) : undefined}
                  aria-expanded={isClickable ? isExpanded : undefined}
                  aria-disabled={isClickable ? undefined : true}
                  tabIndex={isClickable ? 0 : -1}
                  className={`w-full text-left flex items-center gap-3 py-[11px] px-2 rounded-[10px] transition-colors ${
                    isClickable ? 'cursor-pointer hover:bg-[#F2F3F5]' : 'cursor-default'
                  }`}
                >
                  {isClickable && (
                    <TickerLogo item={matchedItem || { symbol: signal.symbol, name: signal.name, _market: signal.market === 'kr' ? 'KR' : signal.market === 'us' ? 'US' : signal.market === 'crypto' ? 'COIN' : '', id: signal.market === 'crypto' ? signal.symbol : undefined }} size={24} />
                  )}
                  <span className="text-[14px] font-semibold flex-shrink-0" style={{ color: nameColor }}>
                    {extractName(signal)}
                  </span>
                  <span className="text-[13px] text-[#8B95A1] truncate flex-1 min-w-0">
                    {getEasyLabel(signal)}
                  </span>
                  {/* 캐릭터 배지 — 성적표와 동일한 공정 적중률 (#400, live만 % 노출) */}
                  {charBadge && (
                    <span
                      className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-[2px] rounded-full"
                      style={charBadge.accuracy != null
                        ? { color: '#fff', background: charBadge.accuracy >= 70 ? '#2AC769' : charBadge.accuracy >= 50 ? '#FF9500' : '#F04452' }
                        : { color: '#8B95A1', background: 'rgba(139,149,161,0.12)' }}
                    >
                      {charBadge.text}
                    </span>
                  )}
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
                  {/* 펼치기 chevron — symbol 있고 종목 시그널에만 표시 (#341) */}
                  {isClickable && <svg
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
                  </svg>}
                </button>
                {/* reasons 태그 — source/confidence/reasons 구조 확장(#275) 적용 시그널에만 표시 */}
                {signal.reasons?.length > 0 && (
                  <div className="px-2 pb-1.5 -mt-1 flex flex-wrap gap-1">
                    {signal.reasons.filter(r => r.label).map((r) => (
                      <span key={r.label} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F2F4F6] dark:bg-[#2D3748] text-[#6B7684] dark:text-[#8B95A1] font-medium">
                        {r.label} {r.value}
                      </span>
                    ))}
                    {signal.confidence != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EDF4FF] dark:bg-[#1C2D4A] text-[#1764ED] dark:text-[#4D9EFF] font-medium">
                        신뢰 {Math.round(Math.min(Math.max(signal.confidence, 0), 1) * 100)}%
                      </span>
                    )}
                  </div>
                )}
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
                  onOpenChart={() => handleClick(signal)}
                  characterBadge={charBadge}
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
