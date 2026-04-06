// 뉴스 클러스터 시그널 훅 — 특정 종목에 뉴스 3건+ 집중 시 시그널 발행
// 4시간 이내 뉴스 대상, 5분 간격 재검사
import { useEffect, useRef, useCallback } from 'react';
import { createNewsClusterSignal, removeSignalByTypeAndSymbol } from '../engine/signalEngine';
import { SIGNAL_TYPES } from '../engine/signalTypes';
import { buildStockKeywords, matchesKeywords } from '../utils/newsAlias';

function removeCluster(symbol) {
  removeSignalByTypeAndSymbol(SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER, symbol);
}

const SCAN_INTERVAL = 5 * 60 * 1000; // 5분
const NEWS_WINDOW = 4 * 3600000; // 4시간
const MIN_CLUSTER = 3; // 최소 3건

// 호재/악재 키워드 (newsSignal.js 기반 단순화)
const BULL_KW = [
  '실적 개선', '흑자전환', '수주', '목표가 상향', '투자의견 상향',
  '신사업', '호실적', '어닝 서프라이즈', '매출 증가', '영업이익 증가',
  '상장', '승인', '계약', '최고가', '신고가',
];
const BEAR_KW = [
  '적자', '리콜', '제재', '목표가 하향', '투자의견 하향',
  '매도', '부도', '하락', '급락', '손실', '소송', '벌금',
  '상장폐지', '거래정지', '해킹', '파산',
];

function classifyNews(title) {
  const lower = (title || '').toLowerCase();
  const isBull = BULL_KW.some(kw => lower.includes(kw));
  const isBear = BEAR_KW.some(kw => lower.includes(kw));
  if (isBull && !isBear) return 'bull';
  if (isBear && !isBull) return 'bear';
  return 'neutral';
}

/**
 * 뉴스 클러스터 시그널 스캔
 * @param {Array} allNews - 전체 뉴스 배열 ({ title, pubDate, ... })
 * @param {Array} allItems - 전체 종목 배열 ({ symbol, name, _market })
 */
export function useNewsSignals(allNews = [], allItems = []) {
  const newsRef = useRef(allNews);
  const itemsRef = useRef(allItems);
  newsRef.current = allNews;
  itemsRef.current = allItems;

  const scan = useCallback(() => {
    const news = newsRef.current;
    const items = itemsRef.current;
    if (!news?.length || !items?.length) return;

    const now = Date.now();
    // 4시간 이내 뉴스만 필터
    const recentNews = news.filter(n => {
      if (!n.pubDate) return false;
      const pubMs = new Date(n.pubDate).getTime();
      return !isNaN(pubMs) && (now - pubMs) < NEWS_WINDOW;
    });
    if (!recentNews.length) return;

    // 마켓별 상위 20개씩 추출 (KR/US/COIN 균등 커버)
    const byMarket = { KR: [], US: [], COIN: [] };
    for (const item of items) {
      const m = (item._market || 'KR').toUpperCase();
      if (byMarket[m] && byMarket[m].length < 20) byMarket[m].push(item);
    }
    const targets = [...byMarket.KR, ...byMarket.US, ...byMarket.COIN];

    const scannedSymbols = new Set();
    for (const item of targets) {
      if (!item.symbol || !item.name) continue;
      const market = (item._market || 'KR').toUpperCase();
      const keywords = buildStockKeywords(item.symbol, item.name, market);
      if (!keywords.length) continue;
      scannedSymbols.add(item.symbol);

      let matchCount = 0;
      let bullCount = 0;
      let bearCount = 0;

      for (const article of recentNews) {
        const text = article.title + ' ' + (article.summary || article.description || '');
        if (matchesKeywords(text, keywords)) {
          matchCount++;
          const cls = classifyNews(article.title);
          if (cls === 'bull') bullCount++;
          else if (cls === 'bear') bearCount++;
        }
      }

      if (matchCount >= MIN_CLUSTER) {
        createNewsClusterSignal(
          item.symbol,
          item.name,
          market.toLowerCase(),
          matchCount,
          bullCount,
          bearCount,
        );
      } else {
        // 임계값 미달 시 기존 클러스터 시그널 제거
        removeCluster(item.symbol);
      }
    }
  }, []);

  // 뉴스 또는 종목 데이터 변경 시 재스캔
  useEffect(() => {
    if (allNews.length > 0 && allItems.length > 0) {
      scan();
    }
  }, [allNews, allItems, scan]);

  // 5분 간격 재검사
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) scan();
    }, SCAN_INTERVAL);
    return () => clearInterval(interval);
  }, [scan]);
}
