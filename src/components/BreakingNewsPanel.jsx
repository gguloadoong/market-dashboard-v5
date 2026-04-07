// 우측 고정 뉴스·속보 패널 — React Query로 중복 호출 차단
import { useState, useMemo } from 'react';
import { useNewsAutoRefetch, useCategoryNewsQuery } from '../hooks/useNewsQuery';
import { extractNewsSignals, getNewsImpact, isBreakingNews, getNewsImpactType } from '../utils/newsSignal';
import { clusterNews } from '../utils/newsCluster';

// ─── 종목 태그 추출 — 뉴스 제목에서 주요 종목명 감지 ──────────
// {keyword: 매칭용 이름, symbol: 심볼코드, name: 표시명} — 클릭 시 ChartSidePanel에 심볼 전달
const STOCK_TAG_MAP = [
  // 국내
  { keyword: '삼성전자', symbol: '005930', name: '삼성전자' },
  { keyword: 'SK하이닉스', symbol: '000660', name: 'SK하이닉스' },
  { keyword: 'LG에너지솔루션', symbol: '373220', name: 'LG에너지솔루션' },
  { keyword: '삼성SDI', symbol: '006400', name: '삼성SDI' },
  { keyword: '현대차', symbol: '005380', name: '현대자동차' },
  { keyword: '기아', symbol: '000270', name: '기아' },
  { keyword: 'LG화학', symbol: '051910', name: 'LG화학' },
  { keyword: '셀트리온', symbol: '068270', name: '셀트리온' },
  { keyword: '삼성바이오로직스', symbol: '207940', name: '삼성바이오로직스' },
  { keyword: '카카오', symbol: '035720', name: '카카오' },
  { keyword: '네이버', symbol: '035420', name: 'NAVER' },
  { keyword: 'NAVER', symbol: '035420', name: 'NAVER' },
  { keyword: '포스코', symbol: '005490', name: 'POSCO홀딩스' },
  { keyword: '에코프로', symbol: '086520', name: '에코프로' },
  { keyword: '한화에어로스페이스', symbol: '012450', name: '한화에어로스페이스' },
  { keyword: '현대중공업', symbol: '329180', name: 'HD현대중공업' },
  { keyword: '두산에너빌리티', symbol: '034020', name: '두산에너빌리티' },
  { keyword: '삼성전기', symbol: '009150', name: '삼성전기' },
  { keyword: '알테오젠', symbol: '196170', name: '알테오젠' },
  { keyword: '한미약품', symbol: '128940', name: '한미약품' },
  // 미국
  { keyword: 'NVIDIA', symbol: 'NVDA', name: 'NVIDIA' },
  { keyword: '엔비디아', symbol: 'NVDA', name: 'NVIDIA' },
  { keyword: '애플', symbol: 'AAPL', name: 'Apple' },
  { keyword: 'Apple', symbol: 'AAPL', name: 'Apple' },
  { keyword: '테슬라', symbol: 'TSLA', name: 'Tesla' },
  { keyword: 'Tesla', symbol: 'TSLA', name: 'Tesla' },
  { keyword: '마이크로소프트', symbol: 'MSFT', name: 'Microsoft' },
  { keyword: 'Microsoft', symbol: 'MSFT', name: 'Microsoft' },
  { keyword: 'Meta', symbol: 'META', name: 'Meta' },
  { keyword: '아마존', symbol: 'AMZN', name: 'Amazon' },
  { keyword: 'Amazon', symbol: 'AMZN', name: 'Amazon' },
  { keyword: '구글', symbol: 'GOOGL', name: 'Alphabet' },
  { keyword: 'Google', symbol: 'GOOGL', name: 'Alphabet' },
  { keyword: '알파벳', symbol: 'GOOGL', name: 'Alphabet' },
  { keyword: 'Alphabet', symbol: 'GOOGL', name: 'Alphabet' },
  { keyword: 'AMD', symbol: 'AMD', name: 'AMD' },
  { keyword: '인텔', symbol: 'INTC', name: 'Intel' },
  { keyword: 'Intel', symbol: 'INTC', name: 'Intel' },
  { keyword: '퀄컴', symbol: 'QCOM', name: 'Qualcomm' },
  { keyword: 'Qualcomm', symbol: 'QCOM', name: 'Qualcomm' },
  { keyword: 'ASML', symbol: 'ASML', name: 'ASML' },
  // 코인
  { keyword: '비트코인', symbol: 'BTC', name: '비트코인' },
  { keyword: 'Bitcoin', symbol: 'BTC', name: '비트코인' },
  { keyword: '이더리움', symbol: 'ETH', name: '이더리움' },
  { keyword: 'Ethereum', symbol: 'ETH', name: '이더리움' },
  { keyword: '리플', symbol: 'XRP', name: '리플' },
  { keyword: '솔라나', symbol: 'SOL', name: '솔라나' },
];

function extractStockTags(title) {
  const lower = title.toLowerCase();
  const seen = new Set();
  return STOCK_TAG_MAP
    .filter(({ keyword }) => lower.includes(keyword.toLowerCase()))
    .filter(({ symbol }) => { if (seen.has(symbol)) return false; seen.add(symbol); return true; })
    .slice(0, 3);
}

// 속보 탭 제거 — 속보는 시그널 태그(🔴 속보)로 자동 표시
const TABS = [
  { id: 'all',   label: '전체'    },
  { id: 'kr',    label: '국내'    },
  { id: 'us',    label: '미장'    },
  { id: 'coin',  label: '코인'    },
];

const CAT_COLOR = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: 'US'   },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: 'KR'   },
};

// RSS description에서 HTML 태그/엔티티 제거 후 1줄 미리보기
function cleanDesc(raw) {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// 속보 시간 감쇠 — 1시간 경과 시 "주요"로 전환
function getBreakingBadge(title, pubDate) {
  if (!isBreakingNews(title, pubDate)) return null;
  const ageMs = Date.now() - new Date(pubDate).getTime();
  if (ageMs > 3600000) return { label: '주요', bg: '#FFF4E6', color: '#FF9500' }; // 1시간+ → 주요
  return { label: '속보', bg: '#FFF0F1', color: '#F04452' };
}

function NewsItem({ item, onNewsClick, onStockClick, relatedCount = 0 }) {
  const cat = CAT_COLOR[item.category] || { bg: '#F2F4F6', color: '#6B7684', label: 'NEWS' };
  // 시그널 태그 추출 — pubDate 전달하여 속보(🔴 속보) 자동 감지, 최대 2개
  const signals = extractNewsSignals(item.title, item.pubDate);
  const impact = getNewsImpact(item.title);
  const impactType = getNewsImpactType(item.title, item.pubDate);
  // 속보 시간 감쇠 배지
  const breakingBadge = getBreakingBadge(item.title, item.pubDate);
  // 뉴스 제목에서 종목 태그 추출
  const stockTags = extractStockTags(item.title);
  // RSS description 1줄 미리보기
  const desc = cleanDesc(item.description || item.summary || '');

  return (
    <div
      onClick={() => onNewsClick?.(item)}
      className="block px-4 py-3 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {breakingBadge && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: breakingBadge.bg, color: breakingBadge.color }}
          >
            {breakingBadge.label}
          </span>
        )}
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
          style={{ background: cat.bg, color: cat.color }}
        >
          {cat.label}
        </span>
        <span className="text-[11px] text-[#B0B8C1] flex-shrink-0 ml-auto">{item.timeAgo}</span>
      </div>
      {/* 시그널 태그 + 영향 유형 + 호재/악재 배지 */}
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
      <div className="text-[13px] font-medium text-[#191F28] leading-snug line-clamp-2">
        {item.title}
      </div>
      {/* RSS description 미리보기 — 제목과 다른 내용만 표시 */}
      {desc && desc.length > 20 && !desc.startsWith(item.title?.slice(0, 30)) && (
        <p className="text-[11px] text-[#8B95A1] leading-snug mt-1 line-clamp-1">
          {desc}
        </p>
      )}
      {/* 클러스터 관련 보도 접기 표시 */}
      {relatedCount > 0 && (
        <div className="mt-1.5">
          <span className="text-[10px] text-[#B0B8C1] bg-[#F2F4F6] px-2 py-0.5 rounded-full">
            관련 보도 {relatedCount}건
          </span>
        </div>
      )}
      {/* 종목 태그 — 제목 아래 표시, 클릭 시 ChartSidePanel 열기 */}
      {stockTags.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {stockTags.map(({ symbol, name: tagName, keyword }) => (
            <span
              key={symbol}
              onClick={(e) => {
                e.stopPropagation();
                onStockClick?.({ symbol, name: tagName });
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded-full bg-[#F2F4F6] text-[#6B7684] font-medium${onStockClick ? ' cursor-pointer hover:bg-[#E5E8EB] transition-colors active:scale-95' : ''}`}
            >
              #{keyword}
            </span>
          ))}
        </div>
      )}
    </div>
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

// 탭별 뉴스 훅 선택
function useTabNews(activeTab) {
  // 'all' → 전체 뉴스 (자동갱신 포함)
  const allQuery  = useNewsAutoRefetch();
  // 카테고리 탭 → 해당 카테고리만
  const catQuery  = useCategoryNewsQuery(
    ['kr','us','coin'].includes(activeTab) ? activeTab : null
  );
  if (['kr','us','coin'].includes(activeTab)) return catQuery;
  return allQuery;
}

// 속보(긴급성+중요도+시장영향도)를 상단에 핀 — 속보 내에서도 최신순, 일반 뉴스도 최신순
function sortWithBreakingFirst(items) {
  const getMs = (i) => {
    const ms = i.pubDate ? new Date(i.pubDate).getTime() : 0;
    return isNaN(ms) ? 0 : ms;
  };
  const breaking = items.filter(i => isBreakingNews(i.title, i.pubDate))
    .sort((a, b) => getMs(b) - getMs(a));
  const normal = items.filter(i => !isBreakingNews(i.title, i.pubDate))
    .sort((a, b) => getMs(b) - getMs(a));
  return [...breaking, ...normal];
}

export default function BreakingNewsPanel({ onItemClick, onNewsClick }) {
  const [activeTab, setActiveTab] = useState('all');
  const { data: rawNews = [], isLoading, isError, refetch } = useTabNews(activeTab);

  // 전체 탭은 최대 30건, 카테고리 탭은 전체 — 속보는 상단 핀 정렬
  const sortedNews = sortWithBreakingFirst(activeTab === 'all' ? rawNews.slice(0, 30) : rawNews);

  // 클러스터링 적용 — 중복 뉴스 제거, 대표 1건 + 관련 보도 N건 접기
  const clusteredNews = useMemo(() => {
    if (!sortedNews.length) return [];
    const clusters = clusterNews(sortedNews);
    return clusters.map(c => ({
      ...c.lead,
      _relatedCount: c.related.length,
    }));
  }, [sortedNews]);

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#E5E8EB]">
      {/* 탭 헤더 */}
      <div className="flex-shrink-0 border-b border-[#F2F4F6] px-2 pt-3">
        <div className="flex gap-0.5 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2 text-[12px] font-medium rounded-t-lg whitespace-nowrap transition-colors ${
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
        <span className="text-[11px] text-[#B0B8C1]">투자 뉴스 · 5분 갱신</span>
        {!isLoading && (
          <span className="text-[11px] text-[#B0B8C1] ml-auto">{clusteredNews.length}건</span>
        )}
      </div>

      {/* 뉴스 목록 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonItem key={i} />)}

        {!isLoading && isError && (
          <div className="px-4 py-8 text-center">
            <div className="text-[13px] text-[#B0B8C1] mb-3">뉴스를 불러오지 못했습니다.</div>
            <button onClick={() => refetch()} className="text-[13px] text-[#3182F6] font-medium">
              다시 시도
            </button>
          </div>
        )}

        {!isLoading && !isError && clusteredNews.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#B0B8C1]">
            뉴스가 없습니다.
          </div>
        )}

        {!isLoading && !isError && clusteredNews.map(item => (
          <NewsItem key={item.id} item={item} onNewsClick={onNewsClick} onStockClick={onItemClick} relatedCount={item._relatedCount} />
        ))}
      </div>
    </div>
  );
}
