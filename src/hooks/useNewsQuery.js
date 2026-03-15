// 뉴스 React Query 훅 — 전역 캐시로 중복 호출 차단
// staleTime 5분: 탭 전환, 리렌더, 윈도우 포커스에도 API 재호출 없음
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAllNews, fetchNewsByCategory, invalidateNewsCache } from '../api/news';

export const newsKeys = {
  all:      ['news', 'all'],
  category: (cat) => ['news', cat],
};

const NEWS_OPTIONS = {
  staleTime:           5 * 60 * 1000,  // 5분 신선
  gcTime:              15 * 60 * 1000, // 15분 후 메모리 정리
  retry:               2,
  retryDelay:          1500,
  refetchOnWindowFocus: false,          // 탭 전환 시 재요청 방지
};

// 전체 뉴스 — 어디서 써도 1개의 캐시 공유
export function useAllNewsQuery() {
  return useQuery({
    queryKey: newsKeys.all,
    queryFn:  fetchAllNews,
    ...NEWS_OPTIONS,
  });
}

// 카테고리별 뉴스 (뉴스 섹션 필터 탭용)
export function useCategoryNewsQuery(category) {
  return useQuery({
    queryKey: newsKeys.category(category),
    queryFn:  () => fetchNewsByCategory(category),
    ...NEWS_OPTIONS,
    enabled: !!category,
  });
}

// 자동 갱신 포함 (5분 interval — BreakingNewsPanel용)
export function useNewsAutoRefetch() {
  return useQuery({
    queryKey:        newsKeys.all,
    queryFn:         fetchAllNews,
    ...NEWS_OPTIONS,
    refetchInterval: 5 * 60 * 1000,
  });
}

// 수동 새로고침 훅
export function useNewsRefresh() {
  const qc = useQueryClient();
  return () => {
    invalidateNewsCache();
    qc.invalidateQueries({ queryKey: ['news'] });
  };
}
