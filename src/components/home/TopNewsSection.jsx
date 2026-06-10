// 시장을 움직이는 뉴스 — 종목 연결 카드형 뉴스 피드
// 뉴스와 관련 종목을 뱃지로 연결, 종목 등락률 표시
import { useMemo, useRef } from 'react';

// timeAgo를 렌더 시점에 동적 계산 — 캐시된 정적 문자열 대신 사용
function computeTimeAgo(pubDate) {
  if (!pubDate) return '';
  const diff = (Date.now() - new Date(pubDate).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}초 전`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}
import { extractNewsSignals, getNewsImpact, getNewsImportanceScore, isBreakingNews } from '../../utils/newsSignal';
import { buildStockKeywords, matchesKeywords, getMatchConfidence } from '../../utils/newsAlias';

const CAT_BADGE = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: '미장' },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: '국내' },
};

// RSS description에서 HTML 태그/엔티티 제거
function cleanDesc(raw) {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// 뉴스와 매칭되는 종목 찾기 — 키워드가 사전 빌드된 경량 종목 목록 사용 (#394)
// 가격(pct)은 여기서 캡처하지 않는다 — 렌더 시점에 pctMap으로 lookup (매칭 ↔ 시세 분리)
function findMatchedStocks(newsTitle, matchableItems, max = 3) {
  if (!newsTitle || !matchableItems.length) return [];
  const matched = [];
  const seen = new Set();

  for (const item of matchableItems) {
    if (matched.length >= max) break;
    if (seen.has(item.key) || !item.keywords.length) continue;

    if (matchesKeywords(newsTitle, item.keywords)) {
      const confidence = getMatchConfidence(newsTitle, item.keywords, item.symbol);
      // WEAK 매칭은 제외
      if (confidence === 'WEAK') continue;
      seen.add(item.key);
      matched.push({
        symbol: item.key,
        name: item.name,
        market: item._market,
        confidence,
      });
    }
  }
  return matched;
}

function StockBadge({ stock, onClick }) {
  const isUp = stock.pct > 0;
  const isDown = stock.pct < 0;
  const pctColor = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const bgColor = isUp ? '#FFF0F1' : isDown ? '#F0F4FF' : '#F2F4F6';
  const isDirect = stock.confidence === 'DIRECT';

  return (
    <span
      onClick={(e) => {
        e.stopPropagation(); // 뉴스 클릭 이벤트와 분리
        onClick?.({ symbol: stock.symbol, name: stock.name, _market: stock.market });
      }}
      className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1.5 min-h-[44px] rounded-full cursor-pointer hover:opacity-80 hover:shadow-sm transition-all active:scale-95"
      style={{ background: bgColor, color: pctColor, fontWeight: isDirect ? 800 : 600 }}
    >
      <span className="text-[#4E5968] font-medium">{stock.name?.slice(0, 6)}</span>
      {!isDirect && <span className="text-[8px] text-[#B0B8C1] font-normal">관련</span>}
      <span>{isUp ? '+' : ''}{stock.pct.toFixed(1)}%</span>
    </span>
  );
}

export default function TopNewsSection({ allNews = [], onNewsClick, onItemClick, allItems = [] }) {
  // #394 매칭 ↔ 시세 분리: allItems는 WS 틱마다 identity가 바뀌므로 그대로 의존하면
  // 틱마다 뉴스 전건 × 종목 전체 키워드 매칭이 재실행된다(렉 주범).
  // → 종목 "구성"(심볼 목록)이 바뀔 때만 매칭을 재계산하고, 시세는 렌더 시 lookup.

  // 종목 구성 지문 — 가격이 아니라 심볼 집합이 바뀔 때만 변경
  const itemsKey = useMemo(
    () => allItems.map(i => i.symbol || i.id).join(','),
    [allItems],
  );

  // 매칭용 경량 종목 + 키워드 사전 빌드 — 종목당 1회 (기존: 뉴스 × 종목마다 빌드)
  const matchableItems = useMemo(() => allItems.map(it => ({
    key: it.symbol || it.id,
    symbol: it.symbol,
    name: it.name,
    _market: it._market,
    keywords: buildStockKeywords(
      it.symbol, it.name,
      it._market === 'KR' ? 'KR' : it._market === 'COIN' ? 'COIN' : 'US',
    ),
  })), [itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 시세 lookup — 틱마다 갱신되지만 O(n) Map 생성이라 저렴
  const pctMap = useMemo(() => {
    const m = new Map();
    for (const it of allItems) {
      m.set(it.symbol || it.id, it._market === 'COIN' ? (it.change24h ?? 0) : (it.changePct ?? 0));
    }
    return m;
  }, [allItems]);
  // 점수 계산용 — memo 의존성에 넣지 않고 ref로 읽어 매칭 재계산과 분리
  const pctMapRef = useRef(pctMap);
  pctMapRef.current = pctMap;

  // 24시간 이내 뉴스 중 시그널 점수 + 종목 매칭 기준 상위 5건
  const topNews = useMemo(() => {
    const cutoff = 24 * 60 * 60 * 1000;
    const recent = allNews.filter(n => {
      if (!n.pubDate) return false;
      try { return Date.now() - new Date(n.pubDate).getTime() < cutoff; }
      catch { return false; }
    });

    return recent
      .map(n => {
        const signals = extractNewsSignals(n.title, n.pubDate);
        const impact = getNewsImpact(n.title);
        const importanceScore = getNewsImportanceScore(n);
        // 종목 실제 움직임 점수 (연결된 종목의 변동폭 합산) — 정렬용이므로 memo 시점 시세로 충분
        const matchedStocks = findMatchedStocks(n.title, matchableItems);
        const movementScore = matchedStocks.reduce(
          (sum, s) => sum + Math.abs(pctMapRef.current.get(s.symbol) ?? 0), 0);
        // 점수: 중요도 점수 + 종목 움직임 가산
        const score = importanceScore + Math.min(movementScore * 0.5, 3);
        return { ...n, _signals: signals, _impact: impact, _score: score, _matchedStocks: matchedStocks };
      })
      .sort((a, b) => {
        const TWO_HOURS = 2 * 3600000;
        const aAge = Date.now() - new Date(a.pubDate).getTime();
        const bAge = Date.now() - new Date(b.pubDate).getTime();
        const aFresh = aAge < TWO_HOURS;
        const bFresh = bAge < TWO_HOURS;
        // 2시간 이내 기사는 최신순 우선 (시계열 정렬)
        if (aFresh && !bFresh) return -1;
        if (!aFresh && bFresh) return 1;
        if (aFresh && bFresh) return aAge - bAge;
        // 2시간 초과: 점수순 → 동점이면 최신순
        return b._score - a._score || aAge - bAge;
      })
      .slice(0, 5);
  }, [allNews, matchableItems]);

  if (!topNews.length) return null;

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">시장을 움직이는 뉴스</span>
        <span className="text-[11px] text-[#B0B8C1]">24시간 이내</span>
      </div>

      {topNews.map((item, i) => {
        const cat = CAT_BADGE[item.category] || { bg: '#F2F4F6', color: '#8B95A1', label: 'NEWS' };
        const isBreaking = isBreakingNews(item.title, item.pubDate);

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
                {item._impact && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: item._impact.bg, color: item._impact.color }}
                  >
                    {item._impact.label}
                  </span>
                )}
                <span className="text-[10px] text-[#C9CDD2] ml-auto flex-shrink-0">{computeTimeAgo(item.pubDate)}</span>
              </div>
              <p className="text-[13px] font-medium text-[#191F28] leading-snug line-clamp-2">
                {item.title}
              </p>
              {/* RSS description 미리보기 */}
              {(() => {
                const desc = cleanDesc(item.description || item.summary || '');
                return desc && desc.length > 20 && !desc.startsWith(item.title?.slice(0, 30))
                  ? <p className="text-[11px] text-[#8B95A1] leading-snug mt-1 line-clamp-1">{desc}</p>
                  : null;
              })()}
              {/* 종목 연결 뱃지 — 관련 종목 + 등락률 */}
              {item._matchedStocks?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {item._matchedStocks.map(stock => (
                    <StockBadge
                      key={stock.symbol}
                      stock={{ ...stock, pct: pctMap.get(stock.symbol) ?? 0 }}
                      onClick={onItemClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
