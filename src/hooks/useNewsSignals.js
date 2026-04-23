// 뉴스 클러스터 시그널 훅 — 특정 종목에 뉴스 3건+ 집중 시 시그널 발행
// 4시간 이내 뉴스 대상, 5분 간격 재검사
import { useEffect, useRef, useCallback } from 'react';
import { createNewsClusterSignal, removeSignalByTypeAndSymbol, removeAllSignalsByType, createSentimentDivergenceSignal } from '../engine/signalEngine';
import { SIGNAL_TYPES } from '../engine/signalTypes';
import { THRESHOLDS } from '../constants/signalThresholds';
import { buildStockKeywords, matchesKeywords } from '../utils/newsAlias';
import { getNewsSentimentScore } from '../utils/newsSignal';
import { clampPct } from '../utils/clampPct';

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
  // 이전 스캔에서 클러스터 시그널이 있던 심볼 추적
  const prevClusteredRef = useRef(new Set());

  // render-time ref 업데이트 금지 (react-hooks/refs) — 매 렌더 후 동기화
  useEffect(() => {
    newsRef.current = allNews;
    itemsRef.current = allItems;
  });

  const scan = useCallback(() => {
    const news = newsRef.current;
    const items = itemsRef.current;

    // 데이터 없으면 기존 클러스터 전체 정리
    if (!news?.length || !items?.length) {
      removeAllSignalsByType(SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER);
      prevClusteredRef.current = new Set();
      return;
    }

    const now = Date.now();
    const recentNews = news.filter(n => {
      if (!n.pubDate) return false;
      const pubMs = new Date(n.pubDate).getTime();
      return !isNaN(pubMs) && (now - pubMs) < NEWS_WINDOW;
    });

    // 최근 뉴스 없으면 전체 정리
    if (!recentNews.length) {
      removeAllSignalsByType(SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER);
      prevClusteredRef.current = new Set();
      return;
    }

    // 마켓별 상위 20개씩 추출 (KR/US/COIN 균등 커버)
    const byMarket = { KR: [], US: [], COIN: [] };
    for (const item of items) {
      const m = (item._market || 'KR').toUpperCase();
      if (byMarket[m] && byMarket[m].length < 20) byMarket[m].push(item);
    }
    const targets = [...byMarket.KR, ...byMarket.US, ...byMarket.COIN];

    // 종목별 매칭 뉴스 캐시 (O(n²) → O(n) 재사용)
    const matchCache = new Map(); // symbol → [{ article, cls }]
    const currentClustered = new Set();
    for (const item of targets) {
      if (!item.symbol || !item.name) continue;
      const market = (item._market || 'KR').toUpperCase();
      const keywords = buildStockKeywords(item.symbol, item.name, market);
      if (!keywords.length) continue;

      let matchCount = 0;
      let bullCount = 0;
      let bearCount = 0;
      const matched = [];

      for (const article of recentNews) {
        const text = article.title + ' ' + (article.summary || article.description || '');
        if (matchesKeywords(text, keywords)) {
          matchCount++;
          const cls = classifyNews(article.title);
          if (cls === 'bull') bullCount++;
          else if (cls === 'bear') bearCount++;
          matched.push({ article, cls });
        }
      }

      matchCache.set(item.symbol, matched);

      if (matchCount >= MIN_CLUSTER) {
        currentClustered.add(item.symbol);
        createNewsClusterSignal(item.symbol, item.name, market.toLowerCase(), matchCount, bullCount, bearCount);
      }
    }

    // 이전에 클러스터였지만 현재 아닌 심볼 정리 (스캔셋 탈락 포함)
    for (const sym of prevClusteredRef.current) {
      if (!currentClustered.has(sym)) {
        removeSignalByTypeAndSymbol(SIGNAL_TYPES.NEWS_SENTIMENT_CLUSTER, sym);
      }
    }
    prevClusteredRef.current = currentClustered;

    // ── 심리 괴리 (Sentiment Divergence) — 가격 방향 vs 뉴스 감성 불일치 ──
    const T_SD = THRESHOLDS.SENTIMENT_DIV;
    for (const item of targets) {
      if (!item.symbol || !item.name) continue;

      const pricePct = clampPct(item.changePct ?? item.change24h ?? 0);
      if (Math.abs(pricePct) < T_SD.PRICE_MIN) continue; // 가격 변동 2% 미만 무시

      // 캐시된 매칭 뉴스에서 감성 점수 수집 (title + summary 포함)
      const cached = matchCache.get(item.symbol);
      if (!cached || cached.length < T_SD.MIN_NEWS) continue; // 최소 2건

      const scores = cached.map(({ article }) =>
        getNewsSentimentScore(article.title + ' ' + (article.summary || article.description || ''))
      );
      const avgSentiment = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (Math.abs(avgSentiment) < T_SD.SENTIMENT_MIN) continue; // 감성 점수 중립이면 무시

      // 가격과 감성 방향 불일치 체크
      const priceUp = pricePct > 0;
      const sentimentPositive = avgSentiment > 0;
      if (priceUp !== sentimentPositive) {
        const market = (item._market || 'KR').toUpperCase();
        createSentimentDivergenceSignal(item.symbol, item.name, market.toLowerCase(), pricePct, avgSentiment, scores.length);
      }
    }
  }, []);

  // 뉴스 또는 종목 데이터 변경 시 재스캔 (빈 데이터도 정리 위해 무조건 호출)
  useEffect(() => {
    scan();
  }, [allNews, allItems, scan]);

  // 5분 간격 재검사
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) scan();
    }, SCAN_INTERVAL);
    return () => clearInterval(interval);
  }, [scan]);
}
