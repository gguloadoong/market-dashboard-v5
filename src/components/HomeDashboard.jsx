// 홈 대시보드 — 3블록 구조
// BLOCK 1: 시장 요약 (공포/탐욕 + 지수 미니칩)
// BLOCK 2: 지금 핫한 것 (전 시장 통합 무버 TOP 8)
// BLOCK 3: 핫한 종목 인사이트 (무버 종목 + 관련 뉴스 연결, 매칭 없으면 숨김)

import { useState, useMemo, memo } from 'react';
import Sparkline from './Sparkline';
import MarketSummaryCards from './MarketSummaryCards';
import { useAllNewsQuery } from '../hooks/useNewsQuery';
import { findRelatedItems, RELATED_ASSETS } from '../data/relatedAssets';

// ─── 종목 키워드 매핑 테이블 ──────────────────────────────────
// 코인: 영문 풀네임 + 티커 매핑
const COIN_KEYWORDS = {
  BTC:  ['bitcoin', 'btc'],
  ETH:  ['ethereum', 'eth', 'ether'],
  XRP:  ['ripple', 'xrp'],
  SOL:  ['solana', 'sol'],
  ADA:  ['cardano', 'ada'],
  DOGE: ['dogecoin', 'doge'],
  BNB:  ['binance', 'bnb'],
  AVAX: ['avalanche', 'avax'],
  DOT:  ['polkadot'],
  LINK: ['chainlink'],
  PEPE: ['pepe'],
  SUI:  ['sui'],
  APT:  ['aptos'],
  NEAR: ['near protocol', 'near'],
  ATOM: ['cosmos', 'atom'],
  TON:  ['toncoin', 'ton'],
  UNI:  ['uniswap'],
  OP:   ['optimism'],
  ARB:  ['arbitrum'],
  INJ:  ['injective'],
};
// 국장: 한국어 종목명 → 영문 검색 키워드
const KR_EN_KEYWORDS = {
  '삼성전자': ['samsung'],
  'SK하이닉스': ['sk hynix', 'hynix'],
  'LG에너지솔루션': ['lg energy'],
  '현대차': ['hyundai'],
  '카카오': ['kakao'],
  '네이버': ['naver'],
  '셀트리온': ['celltrion'],
  'POSCO홀딩스': ['posco'],
  'LG화학': ['lg chem'],
  '기아': ['kia'],
  '현대모비스': ['mobis'],
  'KB금융': ['kb financial', 'kb'],
  '신한지주': ['shinhan'],
};

// 종목 → 검색 키워드 배열 반환
function buildKeywords(item) {
  const sym  = (item.symbol || '').toLowerCase();
  const name = (item.name   || '').toLowerCase();
  const keys = new Set([sym, name].filter(k => k.length >= 2));

  if (item._market === 'COIN') {
    (COIN_KEYWORDS[item.symbol?.toUpperCase()] || []).forEach(k => keys.add(k));
  }
  if (item._market === 'KR') {
    (KR_EN_KEYWORDS[item.name] || []).forEach(k => keys.add(k));
  }
  // US 주식: 심볼 자체로 충분 (AAPL, TSLA, NVDA 등은 뉴스에 그대로 등장)
  return [...keys];
}

// 무버 → 관련 뉴스 1건 반환 (없으면 null)
function findRelatedNews(mover, allNews) {
  const kws = buildKeywords(mover);
  return allNews.find(n => {
    const text = `${n.title} ${n.summary || ''}`.toLowerCase();
    return kws.some(kw => text.includes(kw));
  }) || null;
}

// 숫자 포맷 유틸
function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ─── BLOCK 1: 지수 미니 칩 ──────────────────────────────────
const IndexMiniChip = memo(function IndexMiniChip({ idx }) {
  const isUp   = (idx.changePct ?? 0) > 0;
  const isDown = (idx.changePct ?? 0) < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const flag   = { KOSPI: '🇰🇷', KOSDAQ: '🇰🇷', SPX: '🇺🇸', NDX: '🇺🇸', DJI: '🇺🇸', DXY: '🌐' }[idx.id] || '';

  return (
    <div className="flex-shrink-0 bg-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-[#F2F4F6] shadow-sm">
      <span className="text-[13px]">{flag}</span>
      <div>
        {/* 지수명 + 데이터 지연 배지 */}
        <div className="flex items-center gap-1 mb-0.5">
          <div className="text-[10px] text-[#8B95A1] font-semibold leading-none">{idx.name}</div>
          {/* isDelayed: BE(fetchIndices)가 Yahoo 경유 시 true 반환 */}
          {idx.isDelayed && (
            <span className="text-[9px] text-[#B0B8C1] bg-[#F2F4F6] px-1 rounded">지연</span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[14px] font-bold text-[#191F28] tabular-nums font-mono">
            {fmt(idx.value, 2)}
          </span>
          <span className="text-[11px] font-bold tabular-nums font-mono" style={{ color }}>
            {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(idx.changePct ?? 0).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
});

// ─── 코인 대응 ETF 매핑 ────────────────────────────────────
const COIN_ETF_MAP = {
  BTC:  ['IBIT', 'FBTC'],
  ETH:  ['ETHA', 'FETH'],
  SOL:  ['SOLT'],
  BNB:  [],
  XRP:  [],
};

// ─── BLOCK 2: 통합 무버 행 (시장 구분 뱃지 포함) ─────────────
// 뱃지 색상: 국내(KR)=빨강, 해외(US)=파랑, 코인(COIN)=주황
const MARKET_BADGE = {
  KR:   { bg: '#FFF0F0', color: '#F04452' },
  US:   { bg: '#EDF4FF', color: '#3182F6' },
  COIN: { bg: '#FFF4E6', color: '#FF9500' },
};

const MoverRow = memo(function MoverRow({ item, rank, krwRate, onClick, dataMap = {} }) {
  const pct    = item._market === 'COIN' ? (item.change24h ?? 0) : (item.changePct ?? 0);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const [hovered, setHovered] = useState(false);

  // 로고 URL 순서대로 fallback
  const logoUrls = item.image ? [item.image]
    : item._market === 'US'   ? [`https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`]
    : item._market === 'KR'   ? [`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`]
    : [];
  const [logoIdx, setLogoIdx] = useState(0);

  const PALETTE = ['#3182F6','#F04452','#FF9500','#2AC769','#8B5CF6','#EC4899','#14B8A6','#F59E0B'];
  const bg = PALETTE[(item.symbol || '').split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) % PALETTE.length] || '#8B95A1';

  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
    ? `₩${fmt(item.price)}`
    : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  const badge = MARKET_BADGE[item._market] || { bg: '#F2F4F6', color: '#8B95A1' };

  // 연관 종목 — relatedAssets 매핑 + dataMap에서 현재 가격 조회
  const relatedKey = item.name || item.symbol;
  const relatedItems = useMemo(
    () => findRelatedItems(relatedKey, dataMap),
    [relatedKey, dataMap]
  );
  const hasRelated = relatedItems.length > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl transition-colors"
      style={{ background: hovered ? (isUp ? '#FFF5F5' : '#F0F6FF') : 'transparent' }}
    >
      {/* 메인 행 */}
      <div
        onClick={() => onClick?.(item)}
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
      >
        {/* 순위 */}
        <span className="text-[12px] text-[#C9CDD2] w-4 text-center tabular-nums flex-shrink-0">{rank}</span>

        {/* 로고 */}
        {logoIdx < logoUrls.length ? (
          <img
            src={logoUrls[logoIdx]}
            alt={item.symbol}
            onError={() => setLogoIdx(i => i + 1)}
            className="w-7 h-7 rounded-full object-contain bg-white border border-[#F2F4F6] flex-shrink-0 p-0.5"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
            style={{ background: bg }}
          >
            {(item.symbol || '?').slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* 종목명 + 심볼 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-[#191F28] truncate">{item.name}</span>
            <span
              className="flex-shrink-0 text-[9px] font-bold px-1 py-0.5 rounded"
              style={{ background: badge.bg, color: badge.color }}
            >
              {item._market}
            </span>
            {/* 연관 종목 있으면 작은 힌트 배지 */}
            {hasRelated && (
              <span className="flex-shrink-0 text-[9px] text-[#B0B8C1] px-1 py-0.5 rounded bg-[#F2F4F6]">
                관련 {relatedItems.length}
              </span>
            )}
          </div>
          <div className="text-[10px] font-bold text-[#8B95A1] font-mono">{item.symbol}</div>
        </div>

        {/* 등락률 + 가격 */}
        <div className="text-right flex-shrink-0">
          <div className="text-[13px] font-bold tabular-nums font-mono" style={{ color }}>
            {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
          </div>
          <div className="text-[11px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
        </div>
      </div>

      {/* 호버 시 연관 종목 확장 */}
      {hovered && hasRelated && (
        <div className="px-3 pb-2.5 pt-0">
          <div className="text-[9px] text-[#B0B8C1] font-semibold uppercase tracking-wide mb-1.5 pl-7">
            관련 종목
          </div>
          <div className="flex flex-wrap gap-1.5 pl-7">
            {relatedItems.map(({ ticker, item: rel, isEtf }) => {
              const relPct = rel ? (rel.change24h ?? rel.changePct ?? 0) : null;
              const relColor = relPct == null ? '#B0B8C1' : relPct > 0 ? '#F04452' : relPct < 0 ? '#1764ED' : '#8B95A1';
              return (
                <button
                  key={ticker}
                  onClick={e => { e.stopPropagation(); rel && onClick?.(rel); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E5E8EB] bg-white hover:border-[#B0B8C1] transition-colors"
                >
                  {isEtf && (
                    <span className="text-[8px] font-bold text-[#3182F6] bg-[#EDF4FF] px-0.5 rounded">ETF</span>
                  )}
                  <span className="text-[11px] font-bold text-[#191F28] font-mono">{ticker}</span>
                  {relPct != null && (
                    <span className="text-[10px] font-bold tabular-nums font-mono" style={{ color: relColor }}>
                      {relPct > 0 ? '▲' : relPct < 0 ? '▼' : ''}{Math.abs(relPct).toFixed(1)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── BLOCK 3: 핫한 종목 인사이트 아이템 ─────────────────────
// 급등락 종목 + 관련 뉴스 1건을 함께 보여줌 ("왜 올랐는지" 맥락)
const InsightRow = memo(function InsightRow({ mover, news, krwRate, onMoverClick }) {
  const pct    = mover._market === 'COIN' ? (mover.change24h ?? 0) : (mover.changePct ?? 0);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const badge  = MARKET_BADGE[mover._market] || { bg: '#F2F4F6', color: '#8B95A1' };

  return (
    <a
      href={news.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-4 py-3 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] transition-colors last:border-b-0"
    >
      {/* 종목 정보 행 */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <button
          onClick={e => { e.preventDefault(); onMoverClick?.(mover); }}
          className="flex items-center gap-1 hover:opacity-75"
        >
          <span className="text-[12px] font-bold text-[#191F28]">{mover.name}</span>
          <span className="text-[11px] font-bold font-mono tabular-nums" style={{ color }}>
            {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
          </span>
        </button>
        <span
          className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
          style={{ background: badge.bg, color: badge.color }}
        >
          {mover._market}
        </span>
        <span className="text-[11px] text-[#B0B8C1] flex-shrink-0 ml-auto">{news.timeAgo}</span>
      </div>
      {/* 관련 뉴스 제목 */}
      <div className="text-[12px] text-[#4E5968] leading-snug line-clamp-2">
        {news.title}
      </div>
    </a>
  );
});

// ─── 스켈레톤 플레이스홀더 ────────────────────────────────────
function SkeletonRow({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
      <div className="w-4 h-3 bg-[#F2F4F6] rounded animate-pulse flex-shrink-0" />
      <div className="w-7 h-7 rounded-full bg-[#F2F4F6] animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="h-3 bg-[#F2F4F6] rounded w-24 animate-pulse" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-12 animate-pulse" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-3 bg-[#F2F4F6] rounded w-16 animate-pulse" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-14 animate-pulse" />
      </div>
    </div>
  ));
}

function SkeletonInsight({ count = 4 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="px-4 py-3 border-b border-[#F2F4F6] space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="h-3 bg-[#F2F4F6] rounded w-20 animate-pulse" />
        <div className="h-3 bg-[#F2F4F6] rounded w-10 animate-pulse" />
        <div className="h-3 bg-[#F2F4F6] rounded w-6 animate-pulse" />
      </div>
      <div className="h-3 bg-[#F2F4F6] rounded animate-pulse" />
      <div className="h-3 bg-[#F2F4F6] rounded w-4/5 animate-pulse" />
    </div>
  ));
}

// ─── 메인 홈 대시보드 ─────────────────────────────────────────
export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [],
  krwRate = 1466, onItemClick,
}) {
  // 전체 뉴스 (BLOCK 3 인사이트 매칭용)
  const { data: allNews = [], isLoading: newsLoading } = useAllNewsQuery();

  // ── 전체 시장 데이터 맵 (연관 종목 조회용) ────────────────────
  // symbol → item 빠른 검색을 위한 Map
  const dataMap = useMemo(() => {
    const map = {};
    for (const s of krStocks)  map[s.symbol] = s;
    for (const s of usStocks)  map[s.symbol] = s;
    for (const c of coins)     map[c.symbol?.toUpperCase()] = c;
    // 한글 종목명으로도 검색 가능
    for (const s of krStocks)  if (s.name) map[s.name] = s;
    return map;
  }, [krStocks, usStocks, coins]);

  // ── BLOCK 2: 전 시장 통합 급등/급락 분리 ────────────────────
  // 국장, 미장, 코인을 단일 배열로 합친 뒤 급등 TOP 10 / 급락 TOP 10 분리
  const { gainers, losers } = useMemo(() => {
    const krItems   = krStocks.map(s => ({ ...s, _market: 'KR',   _pct: s.changePct ?? 0 }));
    const usItems   = usStocks.map(s => ({ ...s, _market: 'US',   _pct: s.changePct ?? 0 }));
    const coinItems = coins.map(c => ({ ...c, _market: 'COIN', _pct: c.change24h ?? 0 }));

    const all = [...krItems, ...usItems, ...coinItems];

    const gainers = all
      .filter(i => i._pct > 0)
      .sort((a, b) => b._pct - a._pct)
      .slice(0, 10);

    const losers = all
      .filter(i => i._pct < 0)
      .sort((a, b) => a._pct - b._pct)
      .slice(0, 10);

    return { gainers, losers };
  }, [krStocks, usStocks, coins]);

  // BLOCK 3 insights용 — 급등/급락 합친 배열
  const topMovers = useMemo(() => [...gainers, ...losers], [gainers, losers]);

  // ── BLOCK 3: 무버 종목과 관련 뉴스 매칭 (insights) ───────────
  // 각 무버에 관련 뉴스 1건 연결 — 매칭 없는 무버는 제외
  const insights = useMemo(() => {
    if (!allNews.length || !topMovers.length) return [];
    return topMovers
      .map(mover => ({ mover, news: findRelatedNews(mover, allNews) }))
      .filter(({ news }) => news !== null)
      .slice(0, 5); // 최대 5건
  }, [topMovers, allNews]);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0;

  return (
    <div className="space-y-3">
      {/* ── 상단: 날짜 + 실시간 표시 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#191F28]">지금 핫한 것</h2>
          <p className="text-[12px] text-[#8B95A1] mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-[#F2F4F6]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
          <span className="text-[11px] text-[#6B7684] font-medium">실시간 업데이트</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* BLOCK 1: 급등 TOP 10 + 급락 TOP 10 (메인)      */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 급등 섹션 */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#FFFAFA' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[14px] font-bold text-[#F04452]">🔴 급등 TOP 10</span>
            <span className="text-[11px] text-[#B0B8C1] ml-auto">국내·해외·코인</span>
          </div>

          {!hasData && <SkeletonRow count={5} />}

          {hasData && gainers.length === 0 && (
            <div className="text-center py-6 text-[13px] text-[#B0B8C1]">해당 종목 없음</div>
          )}

          {hasData && gainers.map((item, i) => (
            <MoverRow
              key={`gainer-${item._market}-${item.id || item.symbol}`}
              item={item}
              rank={i + 1}
              krwRate={krwRate}
              onClick={onItemClick}
              dataMap={dataMap}
            />
          ))}
        </div>

        {/* 급락 섹션 */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#F4F8FF' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[14px] font-bold text-[#1764ED]">🔵 급락 TOP 10</span>
            <span className="text-[11px] text-[#B0B8C1] ml-auto">국내·해외·코인</span>
          </div>

          {!hasData && <SkeletonRow count={5} />}

          {hasData && losers.length === 0 && (
            <div className="text-center py-6 text-[13px] text-[#B0B8C1]">해당 종목 없음</div>
          )}

          {hasData && losers.map((item, i) => (
            <MoverRow
              key={`loser-${item._market}-${item.id || item.symbol}`}
              item={item}
              rank={i + 1}
              krwRate={krwRate}
              onClick={onItemClick}
              dataMap={dataMap}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* BLOCK 2: 핫한 종목 인사이트                    */}
      {/* 급등락 무버 종목 + 관련 뉴스 연결 표시          */}
      {/* 매칭 뉴스 없으면 섹션 자체 숨김                */}
      {/* ═══════════════════════════════════════════════ */}
      {(newsLoading || insights.length > 0) && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[#F2F4F6]">
            <span className="text-[15px]">💡</span>
            <span className="text-[14px] font-bold text-[#191F28]">핫한 종목 인사이트</span>
            <span className="text-[11px] text-[#B0B8C1] ml-auto">급등종목 관련 뉴스</span>
          </div>

          {newsLoading && <SkeletonInsight count={4} />}

          {!newsLoading && insights.map(({ mover, news }) => (
            <InsightRow
              key={`${mover._market}-${mover.id || mover.symbol}`}
              mover={mover}
              news={news}
              krwRate={krwRate}
              onMoverClick={onItemClick}
            />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* BLOCK 3: 시장 지수                             */}
      {/* ═══════════════════════════════════════════════ */}

      {/* 시장 지수 헤더 */}
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-[#8B95A1]">시장 지수</span>
      </div>

      {/* 지수 미니바 (가로 스크롤) */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {indices.length > 0
          ? indices.map(idx => <IndexMiniChip key={idx.id} idx={idx} />)
          : [1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex-shrink-0 bg-white rounded-xl px-3 py-2.5 w-36 h-12 animate-pulse border border-[#F2F4F6]" />
          ))
        }
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* BLOCK 4: 시장 요약 (보조 지표)                 */}
      {/* ═══════════════════════════════════════════════ */}

      {/* 공포탐욕 + BTC 도미넌스 + 김치프리미엄 */}
      <MarketSummaryCards coins={coins} krwRate={krwRate} />
    </div>
  );
}
