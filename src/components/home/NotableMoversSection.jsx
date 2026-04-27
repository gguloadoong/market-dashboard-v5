// 주목할만한 움직임 — 복합 스코어 기반 히어로 수평 카드
// 변동폭 + 거래량 순위 + 뉴스 매칭 복합 점수 + WHY 뉴스 연결
import { DEFAULT_KRW_RATE } from '../../constants/market';
import { useMemo, useState, useEffect } from 'react';
import { getPct, fmt, getAvatarBg, getLogoUrls, findRelatedNews, DERIVATIVE_RE } from './utils';
import { buildStockKeywords, matchesKeywords } from '../../utils/newsAlias';
import { getKoreanMarketStatus, getUsMarketStatus } from '../../utils/marketHours';
import { itemKey } from '../../utils/symbolKey';

const MKT_BADGE = {
  KR:         { label: '국내',      bg: '#FFF0F0', color: '#F04452' },
  US:         { label: '미장',      bg: '#EDF4FF', color: '#3182F6' },
  COIN:       { label: '코인',      bg: '#FFF4E6', color: '#FF9500' },
  KR_CLOSED:  { label: '국내 마감', bg: '#F8F9FA', color: '#8B95A1' },
  US_CLOSED:  { label: '미장 마감', bg: '#F8F9FA', color: '#8B95A1' },
};

/**
 * buildWhyReason(item, newsTitle, newsSource)
 * WHY 카드에 표시할 이유를 다중 소스로 추론
 * 1순위: 뉴스, 2순위: 거래량 TOP, 3순위: 변동폭
 */
function buildWhyReason(item, newsTitle, newsSource) {
  // 1순위: 뉴스가 있으면 그대로 사용
  if (newsTitle) return { text: newsTitle, source: newsSource, type: 'news' };

  // 2순위: 거래량 TOP 5 이내
  if (item._volRank && item._volRank <= 5) {
    return { text: `거래량 TOP ${item._volRank} — 거래 활발`, source: null, type: 'volume' };
  }

  // 3순위: 변동폭 5% 이상
  const pct = Math.abs(getPct(item));
  if (pct >= 5) {
    const dir = getPct(item) > 0 ? '급등' : '급락';
    return { text: `${dir} ${pct.toFixed(1)}% — 변동폭 주의`, source: null, type: 'price' };
  }

  return null;
}

// 이유 태그 생성
function buildReasonTags(item, newsCount, volumeRank) {
  const tags = [];
  const pct = Math.abs(getPct(item));

  if (pct >= 5)      tags.push({ label: '급변동', bg: '#FFF0F1', color: '#F04452' });
  else if (pct >= 3) tags.push({ label: '큰 변동', bg: '#FFF4E6', color: '#FF9500' });

  if (volumeRank <= 5)       tags.push({ label: '거래량 TOP', bg: '#F0FFF6', color: '#2AC769' });
  else if (volumeRank <= 15) tags.push({ label: '거래 활발', bg: '#F0FFF6', color: '#2AC769' });

  if (newsCount >= 2)     tags.push({ label: `뉴스 ${newsCount}건`, bg: '#EDF4FF', color: '#3182F6' });
  else if (newsCount === 1) tags.push({ label: '뉴스 1건', bg: '#EDF4FF', color: '#3182F6' });

  return tags.slice(0, 2);
}

// WHY 배지 type별 스타일 정의
const WHY_BADGE_STYLE = {
  news:   { label: 'WHY',  bg: '#191F28', color: '#FFFFFF' },
  volume: { label: 'VOL',  bg: '#2AC769', color: '#FFFFFF' },
  price:  { label: 'MOVE', bg: '#FF9500', color: '#FFFFFF' },
};

function NotableCard({ item, newsCount, volumeRank, whyReason, krwRate, onClick }) {
  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const badgeKey = item._isClosed ? `${item._market}_CLOSED` : item._market;
  const badge  = MKT_BADGE[badgeKey] || MKT_BADGE.KR;
  const tags   = buildReasonTags(item, newsCount, volumeRank);

  const logoUrls = getLogoUrls(item);
  const [logoIdx, setLogoIdx] = useState(0);
  const bg = getAvatarBg(item.symbol);

  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
      ? `₩${fmt(item.price)}`
      : `$${(item.price ?? 0).toFixed(2)}`;

  // 스파크라인 미니 SVG
  const spark = item.sparkline?.length >= 3 ? item.sparkline : null;
  let sparkPath = '';
  if (spark) {
    const min = Math.min(...spark);
    const max = Math.max(...spark);
    const range = max - min || 1;
    sparkPath = spark.map((v, i) => {
      const x = (i / (spark.length - 1)) * 90;
      const y = 24 - ((v - min) / range) * 20;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }

  // WHY 이유 텍스트 및 배지 스타일
  const whyDisplayText = whyReason?.text
    ? (whyReason.text.length > 50 ? whyReason.text.slice(0, 48) + '…' : whyReason.text)
    : null;
  const whyBadge = whyReason ? (WHY_BADGE_STYLE[whyReason.type] || WHY_BADGE_STYLE.news) : null;

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex-shrink-0 w-[220px] bg-white rounded-[14px] p-[18px] cursor-pointer hover:shadow-[0_2px_8px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {/* 상단: 로고 + 종목명 */}
      <div className="flex items-center gap-2 mb-2">
        {logoIdx < logoUrls.length ? (
          <img src={logoUrls[logoIdx]} alt={item.symbol}
            onError={() => setLogoIdx(i => i + 1)}
            className="w-7 h-7 rounded-full object-contain bg-white border border-[#F2F4F6] p-0.5 flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ background: bg }}>
            {(item.symbol || '?').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-[#191F28] truncate">{item.name}</div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
            <span className="text-[9px] text-[#B0B8C1] font-mono">{item.symbol}</span>
          </div>
        </div>
      </div>

      {/* 등락률 (크게) */}
      <div className="text-[20px] font-bold tabular-nums font-mono mb-1" style={{ color }}>
        {isUp ? '+' : ''}{pct.toFixed(2)}%
      </div>

      {/* 가격 */}
      <div className="text-[11px] text-[#8B95A1] font-mono tabular-nums mb-2">{price}</div>

      {/* 스파크라인 */}
      {spark && (
        <svg viewBox="0 0 90 24" className="w-full h-[24px] mb-2">
          <path d={sparkPath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      {/* WHY 이유 — 뉴스(검정)/거래량(초록)/변동폭(주황) 배지 */}
      {whyDisplayText && whyBadge && (
        <div className="flex items-start gap-1.5 mb-1.5">
          <span
            className="text-[8px] font-bold px-1 py-0.5 rounded flex-shrink-0 mt-0.5"
            style={{ background: whyBadge.bg, color: whyBadge.color }}
          >
            {whyBadge.label}
          </span>
          <p className="text-[10px] text-[#4E5968] leading-snug line-clamp-2">{whyDisplayText}</p>
        </div>
      )}

      {/* 뉴스 출처 (뉴스 타입일 때만 표시) */}
      {whyReason?.type === 'news' && whyReason?.source && (
        <div className="text-[9px] text-[#B0B8C1] mb-1.5 truncate">{whyReason.source}</div>
      )}

      {/* 이유 태그 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t.label} className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: t.bg, color: t.color }}>
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// 20분 슬롯 간격 (모듈 스코프 — 렌더마다 재생성 방지)
const SLOT_MS = 20 * 60 * 1000;

export default function NotableMoversSection({ allItems = [], recentNews = [], krwRate = DEFAULT_KRW_RATE, onItemClick }) {
  const krOpen = getKoreanMarketStatus().status === 'open';
  const usOpen = getUsMarketStatus().status === 'open';

  // 20분마다 바뀌는 슬롯 — 동점 항목 순환을 위해 사용
  const [timeSlot, setTimeSlot] = useState(Math.floor(Date.now() / SLOT_MS));
  useEffect(() => {
    const msToNextBoundary = SLOT_MS - (Date.now() % SLOT_MS);
    let intervalId = null;
    const timerId = setTimeout(() => {
      setTimeSlot(Math.floor(Date.now() / SLOT_MS));
      intervalId = setInterval(() => {
        setTimeSlot(Math.floor(Date.now() / SLOT_MS));
      }, SLOT_MS);
    }, msToNextBoundary);
    return () => { clearTimeout(timerId); if (intervalId) clearInterval(intervalId); };
  }, []);

  const notables = useMemo(() => {
    if (!allItems.length) return [];

    // 시장 상태 확인 — 휴장 시장도 포함하되 _isClosed 플래그로 구분
    // krOpen/usOpen은 컴포넌트 본문에서 전달받아 의존성 배열에 포함
    const activeItems = allItems.map(item => {
      if (item._market === 'KR' && !krOpen) return { ...item, _isClosed: true };
      if (item._market === 'US' && !usOpen) return { ...item, _isClosed: true };
      return item;
    });
    if (!activeItems.length) return [];

    // 마켓별 거래량 순위 계산
    const volumeRanks = new Map();
    const byMarket = { KR: [], US: [], COIN: [] };
    for (const item of activeItems) {
      const vol = item._market === 'COIN' ? (item.volume24h ?? 0) : (item.volume ?? 0);
      (byMarket[item._market] || []).push({ symbol: item.symbol || item.id, vol });
    }
    for (const items of Object.values(byMarket)) {
      items.sort((a, b) => b.vol - a.vol);
      items.forEach((it, i) => volumeRanks.set(it.symbol, i + 1));
    }

    return activeItems
      .map(item => {
        const pct = Math.abs(getPct(item));
        const volRank = volumeRanks.get(item.symbol || item.id) || 999;

        // 뉴스 매칭
        const keywords = buildStockKeywords(
          item.symbol, item.name,
          item._market === 'KR' ? 'KR' : item._market === 'COIN' ? 'COIN' : 'US'
        );
        const newsCount = keywords.length > 0
          ? recentNews.filter(n => matchesKeywords(`${n.title || ''} ${n.description || ''}`, keywords)).length
          : 0;

        // WHY 뉴스 매칭 (SignalSection 통합)
        const relatedNews = findRelatedNews(item, recentNews);

        // 복합 점수: 변동폭(0~5) + 거래량 순위(0~3) + 뉴스(0~3)
        // 휴장 시장은 -5 패널티 → 라이브 종목이 압도적으로 상위
        // 인버스/레버리지 ETF는 변동폭이 과대표현되므로 추가 감점
        const pctScore = pct >= 10 ? 5 : pct >= 5 ? 4 : pct >= 3 ? 3 : pct >= 1.5 ? 2 : pct >= 0.5 ? 1 : 0;
        const volScore = volRank <= 5 ? 3 : volRank <= 10 ? 2 : volRank <= 20 ? 1 : 0;
        const newsScore = Math.min(newsCount, 3);
        const closedPenalty = item._isClosed ? -5 : 0;
        const nameLower = (item.name || '').toLowerCase();
        const isLeveraged = DERIVATIVE_RE.test(nameLower);
        const leveragedPenalty = isLeveraged ? -2 : 0;
        const totalScore = pctScore + volScore + newsScore + closedPenalty + leveragedPenalty;

        const newsTitle = relatedNews?.title || null;
        const newsSource = relatedNews?.source || null;

        // WHY 이유 다중 소스 추론 (뉴스 → 거래량 → 변동폭 순)
        // _volRank는 이 시점에서 아직 item에 없으므로 volRank 직접 전달
        const whyItem = { ...item, _volRank: volRank };
        const whyReason = buildWhyReason(whyItem, newsTitle, newsSource);

        return {
          ...item,
          _totalScore: totalScore,
          _newsCount: newsCount,
          _volRank: volRank,
          _newsTitle: newsTitle,
          _newsSource: newsSource,
          _whyReason: whyReason,
        };
      })
      .filter(i => i._totalScore >= 3)
      .sort((a, b) => {
        if (b._totalScore !== a._totalScore) return b._totalScore - a._totalScore;
        // 동점 시 timeSlot 기반 해시로 순환 — 같은 종목이 고정되지 않도록
        const hashA = ((a.symbol || a.id || '').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, timeSlot)) & 0x7fffffff;
        const hashB = ((b.symbol || b.id || '').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, timeSlot)) & 0x7fffffff;
        return hashA - hashB;
      })
      .slice(0, 7);
  // timeSlot: 슬롯 경계(20분)마다만 증가 — 매초 리렌더 제거
  }, [allItems, recentNews, krOpen, usOpen, timeSlot]);

  // 최소 2개 보장 — 점수 부족하면 변동폭 기준 fallback
  const displayed = useMemo(() => {
    if (notables.length >= 2) return notables;
    // fallback도 _isClosed 플래그 부여 (휴장 종목 오인 방지)
    const fallback = [...allItems]
      .sort((a, b) => Math.abs(getPct(b)) - Math.abs(getPct(a)))
      .slice(0, 2)
      .map(i => {
        const isClosed = (i._market === 'KR' && !krOpen) || (i._market === 'US' && !usOpen);
        const relatedNews = findRelatedNews(i, recentNews);
        const newsTitle = relatedNews?.title || null;
        const newsSource = relatedNews?.source || null;
        const whyItem = { ...i, _volRank: 999 };
        const whyReason = buildWhyReason(whyItem, newsTitle, newsSource);
        return {
          ...i,
          _isClosed: isClosed,
          _totalScore: 0, _newsCount: 0, _volRank: 999,
          _newsTitle: newsTitle,
          _newsSource: newsSource,
          _whyReason: whyReason,
        };
      });
    return fallback;
  }, [notables, allItems, recentNews, krOpen, usOpen]);

  if (!displayed.length) return null;

  return (
    <div className="bg-white rounded-2xl p-5 pt-6">
      <div className="mb-4">
        <h2 className="text-[19px] font-bold text-[#191F28] tracking-tight">주목할 종목</h2>
        <p className="text-[13px] text-[#8B95A1] mt-0.5">지금 시장에서 눈여겨볼 움직임</p>
      </div>
      {/* 수평 스크롤 + 양쪽 페이드 힌트 */}
      <div className="relative">
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
            {displayed.map(item => (
              <NotableCard
                key={itemKey(item)}
                item={item}
                newsCount={item._newsCount}
                volumeRank={item._volRank}
                whyReason={item._whyReason}
                krwRate={krwRate}
                onClick={onItemClick}
              />
            ))}
          </div>
        </div>
        {/* 우측 페이드 힌트 — 더 스크롤할 수 있음을 암시 */}
        {displayed.length > 2 && (
          <div className="absolute right-0 top-0 bottom-2 w-8 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(255,255,255,0.9), transparent)' }} />
        )}
      </div>
    </div>
  );
}
