// 우측 고정 뉴스·속보 패널
import { useState, useEffect, useCallback } from 'react';
import { fetchAllNews, fetchNewsByCategory } from '../api/news';

const TABS = [
  { id: 'breaking', label: '🔴 속보' },
  { id: 'all',  label: '전체' },
  { id: 'kr',   label: '국내' },
  { id: 'us',   label: '해외' },
  { id: 'coin', label: '코인' },
];

const CAT_COLOR = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: 'US'   },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: 'KR'   },
};

function NewsItem({ item }) {
  const isBreaking = (Date.now() - new Date(item.pubDate)) < 3600000;
  const cat = CAT_COLOR[item.category] || { bg: '#F2F4F6', color: '#6B7684', label: 'NEWS' };

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-4 py-3 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {isBreaking && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] flex-shrink-0">
            🔴 속보
          </span>
        )}
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
          style={{ background: cat.bg, color: cat.color }}
        >
          {cat.label}
        </span>
        <span className="text-[11px] text-[#B0B8C1] truncate">{item.source}</span>
        <span className="text-[11px] text-[#B0B8C1] flex-shrink-0 ml-auto">{item.timeAgo}</span>
      </div>
      <div className="text-[13px] font-medium text-[#191F28] leading-snug line-clamp-2">
        {item.title}
      </div>
    </a>
  );
}

function SkeletonItem() {
  return (
    <div className="px-4 py-3 border-b border-[#F2F4F6] space-y-2">
      <div className="h-3 bg-[#F2F4F6] rounded w-1/3 animate-pulse" />
      <div className="h-3.5 bg-[#F2F4F6] rounded animate-pulse" />
      <div className="h-3.5 bg-[#F2F4F6] rounded w-4/5 animate-pulse" />
    </div>
  );
}

export default function BreakingNewsPanel() {
  const [activeTab, setActiveTab] = useState('breaking');
  const [news,      setNews]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const load = useCallback(async (tab) => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (tab === 'breaking' || tab === 'all') {
        data = await fetchAllNews();
      } else {
        data = await fetchNewsByCategory(tab);
      }
      // 속보 탭은 최신 20개만
      if (tab === 'breaking') {
        data = data.slice(0, 20);
      }
      setNews(data);
    } catch (e) {
      setError('뉴스를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 탭 변경 시 로드
  useEffect(() => { load(activeTab); }, [activeTab, load]);

  // 5분마다 자동 갱신
  useEffect(() => {
    const id = setInterval(() => load(activeTab), 300000);
    return () => clearInterval(id);
  }, [activeTab, load]);

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#E5E8EB]">
      {/* 탭 헤더 */}
      <div className="flex-shrink-0 border-b border-[#F2F4F6] px-2 pt-3">
        <div className="flex gap-0.5 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-[12px] font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-[#191F28] bg-[#F8F9FA] font-semibold'
                  : 'text-[#6B7684] hover:text-[#191F28]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 갱신 상태 */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[#F2F4F6]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
        <span className="text-[11px] text-[#B0B8C1]">실시간 · 5분 자동갱신</span>
        {!loading && (
          <span className="text-[11px] text-[#B0B8C1] ml-auto">{news.length}건</span>
        )}
      </div>

      {/* 뉴스 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonItem key={i} />)}

        {!loading && error && (
          <div className="px-4 py-8 text-center">
            <div className="text-[13px] text-[#B0B8C1] mb-3">{error}</div>
            <button
              onClick={() => load(activeTab)}
              className="text-[13px] text-[#3182F6] font-medium"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && news.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#B0B8C1]">
            뉴스가 없습니다.
          </div>
        )}

        {!loading && !error && news.map(item => (
          <NewsItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
