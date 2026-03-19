// 관심종목 훅 — localStorage 기반 영구 저장
import { useState, useCallback, useMemo } from 'react';

const KEY = 'watchlist_v1';

// 6자리 숫자 = 한국 주식 심볼 패턴
const KR_SYMBOL_RE = /^\d{6}$/;

function load() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY)) ?? []); } catch { return new Set(); }
}
function save(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch {}
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => load());

  const toggle = useCallback((id) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(next);
      return next;
    });
  }, []);

  const isWatched = useCallback((id) => watchlist.has(id), [watchlist]);

  // 관심종목 중 한국 주식 심볼만 추출 (6자리 숫자)
  const krSymbols = useMemo(
    () => [...watchlist].filter(id => KR_SYMBOL_RE.test(id)),
    [watchlist]
  );

  return { watchlist, toggle, isWatched, krSymbols };
}
