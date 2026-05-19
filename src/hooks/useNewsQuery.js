// 뉴스 React Query 훅 — 전역 캐시 + 즉시 표시 패턴
// initialData: 로컬스토리지 캐시를 즉시 표시 → "불러오는중" 제거
// initialDataUpdatedAt: React Query가 staleTime 기준으로 백그라운드 갱신 여부 판단
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  fetchAllNews, fetchNewsByCategory, invalidateNewsCache,
  getInitialNewsData, getInitialNewsTimestamp,
} from '../api/news';

export const newsKeys = {
  all:      ['news', 'all'],
  category: (cat) => ['news', cat],
};

const NEWS_OPTIONS = {
  // news.js CACHE_TTL(3분)과 동기화 — staleTime > CACHE_TTL이면 React Query가 갱신 요청을 안 보냄
  staleTime:            3 * 60 * 1000,  // 3분 신선
  gcTime:               15 * 60 * 1000, // 15분 후 메모리 정리
  retry:                1,
  retryDelay:           2000,
  refetchOnWindowFocus: false,
};

// 전체 뉴스 — 로컬스토리지 캐시가 있으면 즉시 표시
export function useAllNewsQuery() {
  return useQuery({
    queryKey:             newsKeys.all,
    queryFn:              fetchAllNews,
    initialData:          () => getInitialNewsData('all'),
    initialDataUpdatedAt: () => getInitialNewsTimestamp('all'),
    ...NEWS_OPTIONS,
  });
}

// 카테고리별 뉴스
export function useCategoryNewsQuery(category) {
  return useQuery({
    queryKey:             newsKeys.category(category),
    queryFn:              () => fetchNewsByCategory(category),
    initialData:          () => getInitialNewsData(category),
    initialDataUpdatedAt: () => getInitialNewsTimestamp(category),
    ...NEWS_OPTIONS,
    enabled: !!category,
  });
}

// 자동 갱신 포함 (BreakingNewsPanel용)
export function useNewsAutoRefetch() {
  return useQuery({
    queryKey:             newsKeys.all,
    queryFn:              fetchAllNews,
    initialData:          () => getInitialNewsData('all'),
    initialDataUpdatedAt: () => getInitialNewsTimestamp('all'),
    ...NEWS_OPTIONS,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
  });
}

// 수동 새로고침
export function useNewsRefresh() {
  const qc = useQueryClient();
  return () => {
    invalidateNewsCache();
    qc.invalidateQueries({ queryKey: ['news'] });
  };
}

import { fetchStockDirectNews } from '../api/news';
import { buildStockKeywords, matchesKeywords } from '../utils/newsAlias';
import { getNewsImpact } from '../utils/newsSignal';

// 종목별 직접 구글뉴스 검색 훅 — useStockNews 결과 0건일 때 fallback
export function useStockDirectNews(symbol, name, market, enabled = true) {
  return useQuery({
    queryKey:             ['stock-direct', symbol, name],
    queryFn:              () => fetchStockDirectNews(name, market),
    staleTime:            5 * 60 * 1000,
    gcTime:               15 * 60 * 1000,
    retry:                1,
    retryDelay:           2000,
    refetchOnWindowFocus: false,
    enabled:              !!name && !!enabled,
  });
}

// 강화된 dedup 키 (#324) — 출처 host + 제목 60자 정규화
// id 단독 사용 X: RSS 파서가 id=guid||link로 거의 모든 항목을 채워, id 우선이면
// 같은 토픽이 GUID만 달라 중복 노출되는 케이스를 못 막음 (Copilot 채택).
function dedupKey(item) {
  const titleKey = (item.title || '')
    .toLowerCase()
    .replace(/[\s\-:|·"'"·…[\](){}「」【】]+/g, ' ')
    .trim()
    .slice(0, 60);
  const link = item.link || item.url || '';
  let host = item.source || '';
  if (link) {
    try { host = new URL(link).hostname.replace(/^www\./, ''); } catch { /* keep source */ }
  }
  return `${host}|${titleKey}`;
}

// 코인 뉴스 임팩트 우선 정렬 (#324)
// - 호재/악재 라벨 있는 뉴스 → 중립('⚪ 중립')·라벨없음 뉴스 순
// - getNewsImpact는 sort 비교마다 키워드 매칭을 반복 수행하므로 사전 계산 후 캐시 (Gemini 채택)
function sortByImpactFirst(arr) {
  const hasImpact = new Map();
  for (const item of arr) {
    const impact = getNewsImpact(item.title);
    // 호재/악재만 1, '⚪ 중립' 또는 null은 0 (Copilot 채택)
    hasImpact.set(item, impact && impact.label !== '⚪ 중립' ? 1 : 0);
  }
  return arr.sort((a, b) => (hasImpact.get(b) || 0) - (hasImpact.get(a) || 0));
}

// 종목 키워드 기반 뉴스 필터 훅 — ChartSidePanel에서 사용
// market prop 없으면 symbol/name 패턴으로 자동 추정
export function useStockNews(symbol, name, market) {
  const { data: allNews = [], isLoading } = useAllNewsQuery();

  const news = useMemo(() => {
    if (!symbol || !allNews.length) return [];

    // market 자동 추정: 6자리 숫자 = KR, 그 외 = US
    // COIN은 자동 추정 X — 호출 측(ChartSidePanel)이 market='COIN' 명시 필요 (Copilot 채택)
    const detectedMarket = market
      || (/^\d{6}$/.test(symbol) ? 'KR' : 'US');
    const isCoin = detectedMarket === 'COIN';

    const keywords = buildStockKeywords(symbol, name, detectedMarket);
    if (!keywords.length) return [];

    // dedup 강화 (#324): 동일 출처+제목 60자 차단
    const seen = new Set();
    const matched = [];
    for (const item of allNews) {
      const text = item.title + ' ' + (item.summary || item.description || '');
      if (!matchesKeywords(text, keywords)) continue;
      const key = dedupKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      matched.push(item);
    }

    // 코인은 임팩트 있는 뉴스 우선 정렬 (BTC/ETH 노이즈 감소)
    if (isCoin) sortByImpactFirst(matched);

    return matched.slice(0, 8);
  }, [symbol, name, market, allNews]);

  return { news, isLoading };
}

// 주 종목 + 관련종목 뉴스 합산 훅 — ChartSidePanel 관련뉴스에서 사용
// relatedItems: RELATED_ASSETS에서 추출된 관련종목 배열 (symbol, name, market, isEtf 필드)
export function useStockAndRelatedNews(symbol, name, market, relatedItems = []) {
  const { data: allNews = [], isLoading } = useAllNewsQuery();

  const news = useMemo(() => {
    if (!symbol || !allNews.length) return [];

    const detectedMarket = market || (/^\d{6}$/.test(symbol) ? 'KR' : 'US');
    const isCoin = detectedMarket === 'COIN';
    const primaryKeywords = buildStockKeywords(symbol, name, detectedMarket);
    if (!primaryKeywords.length) return [];

    // 관련종목 키워드 (ETF 제외, 최대 4개)
    const relatedKeywordSets = relatedItems
      .filter(r => !r.isEtf)
      .slice(0, 4)
      .map(r => {
        const relMarket = r.market || detectedMarket;
        return buildStockKeywords(r.symbol, r.name, relMarket);
      })
      .filter(kws => kws.length > 0);

    const seen = new Set();
    const primary = [];
    const secondary = [];

    for (const item of allNews) {
      const text = item.title + ' ' + (item.summary || item.description || '');
      const key = dedupKey(item); // (#324) 강화된 키
      if (seen.has(key)) continue;

      if (matchesKeywords(text, primaryKeywords)) {
        seen.add(key);
        primary.push(item);
      } else if (relatedKeywordSets.some(kws => matchesKeywords(text, kws))) {
        seen.add(key);
        secondary.push(item);
      }
    }

    // 코인은 임팩트 있는 뉴스 우선 정렬 (#324)
    if (isCoin) {
      sortByImpactFirst(primary);
      sortByImpactFirst(secondary);
    }

    // 코인: primary 5건 상한 + secondary 보장 → BTC/ETH 뉴스가 8칸 전부 점거 방지 (#324)
    // secondary 부족 시 primary 잔여분으로 8칸 보충 (Copilot 채택 — 슬롯 비는 현상 방지)
    // 그 외 시장: 기존 동작 유지 (주 종목 우선, 부족분 관련종목)
    if (isCoin && secondary.length > 0) {
      const primaryCap = Math.min(primary.length, 5);
      const taken = [
        ...primary.slice(0, primaryCap),
        ...secondary.slice(0, 8 - primaryCap),
      ];
      // 8칸 미만이면 primary 잔여분으로 채움 (secondary 1~2건만 있을 때 결과 6~7건 → 8건)
      if (taken.length < 8 && primary.length > primaryCap) {
        taken.push(...primary.slice(primaryCap, primaryCap + (8 - taken.length)));
      }
      return taken.slice(0, 8);
    }
    return [...primary, ...secondary].slice(0, 8);
  }, [symbol, name, market, allNews, relatedItems]);

  return { news, isLoading };
}
