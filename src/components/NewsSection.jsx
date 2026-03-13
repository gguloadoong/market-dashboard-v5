import { useState, useEffect } from 'react';
import { fetchAllNews } from '../api/news';

const CATEGORY_LABELS = { all: '전체', coin: '코인', us: '미장', kr: '국장' };
const CATEGORY_ICONS  = { coin: '₿', us: '🇺🇸', kr: '🇰🇷', all: '🌐' };

function NewsItem({ item }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="news-row block"
    >
      {/* 카테고리 + 소스 + 시간 */}
      <div className="flex-shrink-0 mt-0.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${
          item.category === 'coin' ? 'bg-orange-50' :
          item.category === 'us'   ? 'bg-blue-50'   :
          item.category === 'kr'   ? 'bg-red-50'     : 'bg-gray-100'
        }`}>
          {CATEGORY_ICONS[item.category] || '📰'}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-text1 leading-snug line-clamp-2">{item.title}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[11px] text-text3">{item.source}</span>
          <span className="text-[11px] text-text3">·</span>
          <span className="text-[11px] text-text3">{item.timeAgo}</span>
        </div>
      </div>
    </a>
  );
}

export default function NewsSection({ limit = 5, showFilter = false }) {
  const [news, setNews]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAllNews()
      .then(data => {
        setNews(data);
        setLoading(false);
      })
      .catch(e => {
        setError('뉴스를 불러오지 못했습니다');
        setLoading(false);
      });
  }, []);

  const filtered = category === 'all' ? news : news.filter(n => n.category === category);
  const displayed = limit ? filtered.slice(0, limit) : filtered;

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
              {CATEGORY_ICONS[key]} {label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-5 py-4">
              <div className="w-8 h-8 bg-[#F2F4F6] rounded-xl flex-shrink-0 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-[#F2F4F6] rounded animate-pulse" />
                <div className="h-3.5 bg-[#F2F4F6] rounded w-3/4 animate-pulse" />
                <div className="h-2.5 bg-[#F2F4F6] rounded w-1/3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="px-5 py-6 text-center text-[13px] text-text3">{error}</div>
      )}

      {!loading && !error && displayed.map(item => (
        <NewsItem key={item.id} item={item} />
      ))}
    </div>
  );
}
