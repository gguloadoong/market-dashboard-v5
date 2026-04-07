// 통합 피드 패널 — 시그널+뉴스 시간순 인터리빙
// BreakingNewsPanel 교체용 데스크톱 우측 패널
import { useState, useMemo } from 'react';
import { useNewsAutoRefetch, useCategoryNewsQuery } from '../hooks/useNewsQuery';
import { useSignals } from '../hooks/useSignals';
import { extractNewsSignals, getNewsImpact, isBreakingNews, getNewsImpactType } from '../utils/newsSignal';
import { clusterNews } from '../utils/newsCluster';
import { extractName, getEasyLabel } from '../utils/signalLabel';

// ─── 피드 타입 태그 색상 ────────────────────────────────────
const FEED_TAG = {
  signal: { bg: '#FFF0F1', color: '#F04452', label: '시그널' },
  news:   { bg: '#EDF4FF', color: '#3182F6', label: '뉴스' },
};

// 뉴스 카테고리 색상
const CAT_COLOR = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: 'US' },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: 'KR' },
};

// ─── 뉴스 탭 (하단 섹션) ────────────────────────────────────
const NEWS_TABS = [
  { id: 'all',  label: '속보' },
  { id: 'kr',   label: '국내' },
  { id: 'us',   label: '해외' },
  { id: 'coin', label: '코인' },
];

// RSS description 정리
function cleanDesc(raw) {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// 시간 표시
function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (isNaN(diff) || diff < 0) return '';
  if (diff < 60)    return `${Math.floor(diff)}초 전`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}


// ─── 피드 헤더 ──────────────────────────────────────────────
function FeedHeader() {
  return (
    <div className="flex-shrink-0 flex items-center gap-1.5 px-5 py-3.5">
      <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-[blink_1.5s_ease-in-out_infinite]" />
      <span className="text-[15px] font-bold text-[#191F28]">실시간</span>
    </div>
  );
}

// 시간 표시 — HH:MM 포맷 (우측 패널용)
function timeShort(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' ? ts : ts);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── 3컬럼 피드 항목 (시간 | 태그 | 내용) ────────────────────
function FeedItem3Col({ time, tagLabel, tagColor, text, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full grid items-baseline gap-1.5 px-5 py-2.5 cursor-pointer hover:bg-[#F2F3F5] transition-colors -mx-0 rounded-lg"
      style={{ gridTemplateColumns: '36px 44px 1fr' }}
    >
      <span className="text-[11px] text-[#B0B8C1] font-mono tabular-nums flex-shrink-0">{time}</span>
      <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: tagColor }}>{tagLabel}</span>
      <span className="text-[13px] text-[#4E5968] leading-snug truncate min-w-0 text-left">{text}</span>
    </button>
  );
}

// ─── 시그널 항목 (3컬럼) ────────────────────────────────────
function SignalFeedItem({ signal, onItemClick }) {
  const tag = FEED_TAG.signal;
  return (
    <FeedItem3Col
      time={timeShort(signal.timestamp || signal.createdAt)}
      tagLabel={tag.label}
      tagColor={tag.color}
      text={`${extractName(signal)} ${getEasyLabel(signal)}`}
      onClick={() => signal.symbol && onItemClick?.({ symbol: signal.symbol, name: signal.name || signal.symbol, market: signal.market })}
    />
  );
}

// ─── 뉴스 항목 ──────────────────────────────────────────────
function NewsFeedItem({ item, onNewsClick }) {
  const tag = FEED_TAG.news;
  const cat = CAT_COLOR[item.category] || { bg: '#F2F4F6', color: '#6B7684', label: 'NEWS' };
  const signals = extractNewsSignals(item.title, item.pubDate);
  const impact = getNewsImpact(item.title);
  const impactType = getNewsImpactType(item.title, item.pubDate);
  const isBreaking = isBreakingNews(item.title, item.pubDate);
  const desc = cleanDesc(item.description || item.summary || '');

  return (
    <div
      onClick={() => onNewsClick?.(item)}
      className="px-4 py-2.5 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
    >
      {/* 1행: 태그 + 시간 (고정 그리드) */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {isBreaking && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFF0F1] text-[#F04452] flex-shrink-0">속보</span>
        )}
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: tag.bg, color: tag.color }}>
          {tag.label}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: cat.bg, color: cat.color }}>
          {cat.label}
        </span>
        <span className="text-[11px] text-[#B0B8C1] ml-auto flex-shrink-0 tabular-nums">{item.timeAgo || timeAgo(item.pubDate)}</span>
      </div>
      {/* 시그널 태그 */}
      {(signals.length > 0 || impact || impactType) && (
        <div className="flex items-center gap-1 mb-1 flex-wrap">
          {signals.map(sig => (
            <span key={sig.tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: sig.bg, color: sig.color }}>{sig.tag}</span>
          ))}
          {impactType && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: impactType.bg, color: impactType.color }}>{impactType.label}</span>
          )}
          {impact && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: impact.bg, color: impact.color }}>{impact.label}</span>
          )}
        </div>
      )}
      <div className="text-[13px] font-medium text-[#191F28] leading-snug line-clamp-2">{item.title}</div>
      {desc && desc.length > 20 && !desc.startsWith(item.title?.slice(0, 30)) && (
        <p className="text-[11px] text-[#8B95A1] leading-snug mt-1 line-clamp-1">{desc}</p>
      )}
      {/* 클러스터 관련 보도 */}
      {item._relatedCount > 0 && (
        <div className="mt-1.5">
          <span className="text-[10px] text-[#B0B8C1] bg-[#F2F4F6] px-2 py-0.5 rounded-full">
            관련 보도 {item._relatedCount}건
          </span>
        </div>
      )}
    </div>
  );
}

// ─── 스켈레톤 ───────────────────────────────────────────────
function SkeletonItem() {
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="h-3 bg-[#F2F4F6] rounded w-1/3 animate-pulse" />
      <div className="h-3.5 bg-[#F2F4F6] rounded animate-pulse" />
      <div className="h-3.5 bg-[#F2F4F6] rounded w-4/5 animate-pulse" />
    </div>
  );
}

// ─── 뉴스 탭 훅 ─────────────────────────────────────────────
function useTabNews(activeTab) {
  const allQuery = useNewsAutoRefetch();
  const catQuery = useCategoryNewsQuery(
    ['kr', 'us', 'coin'].includes(activeTab) ? activeTab : null
  );
  if (['kr', 'us', 'coin'].includes(activeTab)) return catQuery;
  return allQuery;
}

// 속보 핀 정렬
function sortWithBreakingFirst(items) {
  const getMs = (i) => {
    const ms = i.pubDate ? new Date(i.pubDate).getTime() : 0;
    return isNaN(ms) ? 0 : ms;
  };
  const breaking = items.filter(i => isBreakingNews(i.title, i.pubDate)).sort((a, b) => getMs(b) - getMs(a));
  const normal = items.filter(i => !isBreakingNews(i.title, i.pubDate)).sort((a, b) => getMs(b) - getMs(a));
  return [...breaking, ...normal];
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────
export default function UnifiedFeedPanel({ onItemClick, onNewsClick }) {
  // 시그널 데이터
  const allSignals = useSignals();

  // 시그널 피드 — timestamp 기준 내림차순 (최대 15건)
  const signalFeed = useMemo(() => {
    return allSignals.slice(0, 15).map(sig => ({
      feedType: 'signal',
      ts: sig.timestamp || sig.createdAt || Date.now(),
      data: sig,
      id: `sig-${sig.id}`,
    })).sort((a, b) => {
      const aMs = typeof a.ts === 'number' ? a.ts : new Date(a.ts).getTime() || 0;
      const bMs = typeof b.ts === 'number' ? b.ts : new Date(b.ts).getTime() || 0;
      return bMs - aMs;
    });
  }, [allSignals]);

  // ─── 하단 뉴스 탭 섹션 ────────────────────────────────────
  const [newsTab, setNewsTab] = useState('all');
  const { data: rawNews = [], isLoading, isError, refetch } = useTabNews(newsTab);

  const sortedNews = useMemo(() => {
    const sliced = newsTab === 'all' ? rawNews.slice(0, 30) : rawNews;
    return sortWithBreakingFirst(sliced);
  }, [rawNews, newsTab]);

  const clusteredNews = useMemo(() => {
    if (!sortedNews.length) return [];
    const clusters = clusterNews(sortedNews);
    return clusters.map(c => ({ ...c.lead, _relatedCount: c.related.length }));
  }, [sortedNews]);

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#E5E8EB] rounded-2xl overflow-hidden">
      {/* 실시간 피드 (시그널, 최신 5건) */}
      <div className="flex-shrink-0 px-0 pt-0 pb-2">
        <FeedHeader />
        {signalFeed.length > 0 && (
          <div>
            {signalFeed.slice(0, 5).map(item => (
              <SignalFeedItem key={item.id} signal={item.data} onItemClick={onItemClick} />
            ))}
          </div>
        )}
      </div>

      {/* 뉴스 섹션 (독립 스크롤) */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-[#E5E8EB]">
        {/* 뉴스 탭 헤더 — 밑줄 스타일 */}
        <div className="flex-shrink-0 flex px-5">
          {NEWS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setNewsTab(tab.id)}
              className={`py-[11px] px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors border-b-2 ${
                newsTab === tab.id
                  ? 'text-[#191F28] border-[#191F28]'
                  : 'text-[#8B95A1] border-transparent hover:text-[#4E5968]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 뉴스 목록 (독립 스크롤) */}
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-5">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonItem key={i} />)}

          {!isLoading && isError && (
            <div className="py-8 text-center">
              <div className="text-[13px] text-[#B0B8C1] mb-3">뉴스를 불러오지 못했습니다.</div>
              <button onClick={() => refetch()} className="text-[13px] text-[#3182F6] font-medium">다시 시도</button>
            </div>
          )}

          {!isLoading && !isError && clusteredNews.length === 0 && (
            <div className="py-8 text-center text-[13px] text-[#B0B8C1]">뉴스가 없습니다.</div>
          )}

          {!isLoading && !isError && clusteredNews.map(item => (
            <NewsFeedItem key={item.id} item={item} onNewsClick={onNewsClick} />
          ))}
        </div>
      </div>

    </div>
  );
}
