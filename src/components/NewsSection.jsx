// 뉴스 섹션 — React Query 훅으로 중복 호출 차단
import { useState } from 'react';
import { useAllNewsQuery, useCategoryNewsQuery } from '../hooks/useNewsQuery';

const CATEGORY_LABELS = { all: '전체', coin: '코인', us: '미장', kr: '국장' };
const CATEGORY_COLORS = {
  coin: { bg: '#FFF4E6', dot: '#FF9500', label: 'Crypto' },
  us:   { bg: '#EDF4FF', dot: '#3182F6', label: 'US'     },
  kr:   { bg: '#FFF0F0', dot: '#F04452', label: 'KR'     },
  all:  { bg: '#F2F4F6', dot: '#6B7684', label: 'NEWS'   },
};

function BreakingBadge({ category }) {
  const c = CATEGORY_COLORS[category] || CATEGORY_COLORS.all;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
      style={{ background: c.bg, color: c.dot }}>
      {c.label}
    </span>
  );
}

function NewsItem({ item }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 px-5 py-3.5 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] transition-colors active:bg-[#F2F4F6]"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <BreakingBadge category={item.category} />
          <span className="text-[11px] text-text3 truncate">{item.source}</span>
          <span className="text-[11px] text-text3">·</span>
          <span className="text-[11px] text-text3 flex-shrink-0">{item.timeAgo}</span>
        </div>
        <div className="text-[14px] font-medium text-text1 leading-snug line-clamp-2">{item.title}</div>
        {item.description && (
          <div className="text-[12px] text-text3 mt-1 line-clamp-2 leading-relaxed">{item.description}</div>
        )}
      </div>
      {item.image && (
        <img
          src={item.image}
          alt=""
          className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}
    </a>
  );
}

function SkeletonItem() {
  return (
    <div className="flex gap-3 px-5 py-3.5 border-b border-[#F2F4F6]">
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[#F2F4F6] rounded w-1/4 animate-pulse" />
        <div className="h-3.5 bg-[#F2F4F6] rounded animate-pulse" />
        <div className="h-3.5 bg-[#F2F4F6] rounded w-5/6 animate-pulse" />
      </div>
      <div className="w-14 h-14 bg-[#F2F4F6] rounded-xl flex-shrink-0 animate-pulse" />
    </div>
  );
}

function NewsContent({ category, limit }) {
  const allQuery = useAllNewsQuery();
  const catQuery = useCategoryNewsQuery(category !== 'all' ? category : null);
  const { data: news = [], isLoading, isError, refetch } = category === 'all' ? allQuery : catQuery;
  const displayed = limit ? news.slice(0, limit) : news;

  if (isLoading) return <>{Array.from({ length: limit || 5 }).map((_, i) => <SkeletonItem key={i} />)}</>;
  if (isError) return (
    <div className="px-5 py-8 text-center">
      <div className="text-[13px] text-text3 mb-3">뉴스를 불러오지 못했습니다.</div>
      <button onClick={() => refetch()} className="text-[13px] text-primary font-medium">다시 시도</button>
    </div>
  );
  if (!displayed.length) return (
    <div className="px-5 py-8 text-center text-[13px] text-text3">뉴스가 없습니다.</div>
  );
  return <>{displayed.map(item => <NewsItem key={item.id} item={item} />)}</>;
}

export default function NewsSection({ limit = 5, showFilter = false }) {
  const [category, setCategory] = useState('all');

  return (
    <div>
      {showFilter && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-5 py-3 border-b border-[#F2F4F6]">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`chip ${category === key ? 'active' : ''}`}
              onClick={() => setCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <NewsContent category={category} limit={limit} />
    </div>
  );
}
