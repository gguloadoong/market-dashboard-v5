// 관심종목 훅 — localStorage 기반 영구 저장 (#183 복합키 마이그레이션)
// v2: `${market}:${symbol}` 형식 ('KR:005930', 'US:AAPL', 'COIN:bitcoin')
// 외부 API는 기존 호환 — `toggle`/`isWatched`에 raw symbol 전달 시 market 추론해 복합키로 변환
import { useState, useCallback, useMemo } from 'react';

const KEY_V1 = 'watchlist_v1';
const KEY_V2 = 'watchlist_v2';

// 6자리 숫자 = 한국 주식 심볼 패턴
const KR_SYMBOL_RE = /^\d{6}$/;
// 코인 id 패턴 — CoinGecko(bitcoin, kaspa) 소문자, CoinPaprika(btc-bitcoin) 하이픈 포함
const COIN_ID_RE = /^[a-z][a-z0-9-]*$/;

// raw id에서 market 추정 — 1회성 마이그레이션 + toggle 호환용
function inferMarket(id) {
  if (!id) return 'US';
  if (KR_SYMBOL_RE.test(id)) return 'KR';
  if (COIN_ID_RE.test(id)) return 'COIN';
  return 'US';
}

function toCompositeKey(id) {
  if (typeof id !== 'string' || !id) return '';
  if (id.includes(':')) return id;
  const market = inferMarket(id);
  // 코인 id는 CoinGecko/Paprika API 소문자 요구 — 원본 유지
  const body = market === 'COIN' ? id : id.toUpperCase();
  return `${market}:${body}`;
}

// v1 → v2 1회성 마이그레이션 — raw 심볼 → 복합키
function migrate() {
  try {
    const rawV1 = localStorage.getItem(KEY_V1);
    if (!rawV1) return null;
    const arr = JSON.parse(rawV1) ?? [];
    const migrated = new Set(arr.map(toCompositeKey).filter(Boolean));
    localStorage.setItem(KEY_V2, JSON.stringify([...migrated]));
    localStorage.removeItem(KEY_V1);
    return migrated;
  } catch {
    return null;
  }
}

function load() {
  try {
    const rawV2 = localStorage.getItem(KEY_V2);
    if (rawV2) return new Set(JSON.parse(rawV2) ?? []);
    const migrated = migrate();
    return migrated ?? new Set();
  } catch {
    return new Set();
  }
}

function save(set) {
  try { localStorage.setItem(KEY_V2, JSON.stringify([...set])); } catch {}
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => load());

  const toggle = useCallback((id) => {
    const key = toCompositeKey(id);
    if (!key) return;
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      save(next);
      return next;
    });
  }, []);

  const isWatched = useCallback((id) => watchlist.has(toCompositeKey(id)), [watchlist]);

  // 관심종목 중 한국 주식 심볼만 추출 (외부 API 호환 — raw 심볼 반환)
  const krSymbols = useMemo(
    () => [...watchlist].filter(k => k.startsWith('KR:')).map(k => k.slice(3)),
    [watchlist]
  );

  // 관심종목 중 미국 주식 심볼만 추출
  const usSymbols = useMemo(
    () => [...watchlist].filter(k => k.startsWith('US:')).map(k => k.slice(3)),
    [watchlist]
  );

  return { watchlist, toggle, isWatched, krSymbols, usSymbols };
}
