// 투자 시그널 뉴스 — 시그널 태그 + 종목 매칭 점수 기반 큐레이션
import { useMemo } from 'react';
import { extractNewsSignals } from '../../utils/newsSignal';

const CAT_BADGE = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: '미장' },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: '국내' },
};

// 종목 태그 추출
const STOCK_NAMES = [
  '삼성전자','SK하이닉스','LG에너지솔루션','현대차','기아','셀트리온','카카오','네이버',
  'NVIDIA','엔비디아','애플','테슬라','Tesla','마이크로소프트','Meta','아마존','구글','AMD',
  '비트코인','이더리움','리플','솔라나','Bitcoin','Ethereum',
];

function countStockTags(title) {
  const lower = (title || '').toLowerCase();
  return STOCK_NAMES.filter(n => lower.includes(n.toLowerCase())).length;
}

export default function TopNewsSection({ allNews = [], onNewsClick }) {
  // 24시간 이내 뉴스 중 시그널 점수 기준 상위 5건
  const topNews = useMemo(() => {
    const cutoff = 24 * 60 * 60 * 1000;
    const recent = allNews.filter(n => {
      if (!n.pubDate) return false;
      try { return Date.now() - new Date(n.pubDate).getTime() < cutoff; }
      catch { return false; }
    });

    return recent
      .map(n => {
        const signals = extractNewsSignals(n.title);
        const stockCount = countStockTags(n.title);
        const isRecent = n.pubDate && (Date.now() - new Date(n.pubDate).getTime()) < 3600000;
        // 점수: 시그널 태그 2점 + 종목 태그 1점 + 1시간 이내 가산 1점
        const score = signals.length * 2 + stockCount + (isRecent ? 1 : 0);
        return { ...n, _signals: signals, _score: score };
      })
      .sort((a, b) => b._score - a._score || new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 5);
  }, [allNews]);

  if (!topNews.length) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">투자 시그널 뉴스</span>
        <span className="text-[11px] text-[#B0B8C1]">24시간 이내</span>
      </div>

      {topNews.map((item, i) => {
        const cat = CAT_BADGE[item.category] || { bg: '#F2F4F6', color: '#8B95A1', label: 'NEWS' };
        const isBreaking = item.pubDate && (Date.now() - new Date(item.pubDate).getTime()) < 3600000;

        return (
          <div
            key={item.id || i}
            onClick={() => onNewsClick?.(item)}
            className="flex items-start gap-3 px-4 py-3 border-b border-[#F2F4F6] last:border-0 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
          >
            <span className="text-[13px] font-bold text-[#C9CDD2] tabular-nums mt-0.5 flex-shrink-0 w-4">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                {isBreaking && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFF0F1] text-[#F04452] flex-shrink-0">
                    속보
                  </span>
                )}
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: cat.bg, color: cat.color }}
                >
                  {cat.label}
                </span>
                {item._signals.slice(0, 2).map(sig => (
                  <span
                    key={sig.tag}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: sig.bg, color: sig.color }}
                  >
                    {sig.tag}
                  </span>
                ))}
                <span className="text-[10px] text-[#C9CDD2] ml-auto flex-shrink-0">{item.timeAgo}</span>
              </div>
              <p className="text-[13px] font-medium text-[#191F28] leading-snug line-clamp-2">
                {item.title}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
