// 미국·국내 주식 가격 폴링 훅
import { useState, useEffect, useCallback, useRef } from 'react';
import { US_STOCK_LIST } from '../data/usStockList';
import { KR_SECTOR_MAP } from '../data/krStockList';
import KR_STOCK_NAMES from '../data/krStockNames.json';
import { fetchSnapshot } from '../api/snapshot';
import { fetchUsStocksBatch, fetchKoreanStocksBatch } from '../api/stocks';
import { checkAndAlertBatch } from '../utils/priceAlert';
import { POLLING } from '../constants/polling';
import { isKoreanMarketOpen, isUsMarketOpen } from '../utils/marketHours';

// US_STOCK_LIST 메타맵 — 모듈 스코프에 1회만 생성 (sector/nameEn fallback)
const US_META_MAP = new Map(US_STOCK_LIST.map(s => [s.symbol, s]));

// KR 종목명 룩업 — API name이 없거나 symbol과 같으면 정적 테이블로 보완
// null 반환 시 call site에서 old.name 등 상위 fallback이 동작할 수 있도록 symbol 반환 제거
function resolveKrName(symbol, apiName) {
  if (apiName && apiName !== symbol) return apiName;
  return KR_STOCK_NAMES[symbol] || null;
}

// snapshot 없을 때 국장 최소 fallback 심볼 (코스피 시총 상위)
const KR_FALLBACK_SYMBOLS = [
  '005930','000660','035420','035720','005380','000270',
  '051910','006400','207940','068270','105560','055550',
];

// ─── localStorage 가격 캐시 (구조 변경 시 버전 업) ──────────
const CACHE_KEY_US = 'prices_us_v1';
const CACHE_KEY_KR = 'prices_kr_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간

function loadPriceCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL || !data?.length) return [];
    return data;
  } catch { return []; }
}

function savePriceCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function usePrices() {
  const [usStocks, setUsStocks]   = useState(() => loadPriceCache(CACHE_KEY_US));
  const [krStocks, setKrStocks]   = useState(() => loadPriceCache(CACHE_KEY_KR));
  const [pricesReady, setPricesReady] = useState(false);
  const [dataErrors, setDataErrors] = useState({ kr: false, us: false });

  // ref로 최신 stocks 유지 — useCallback 의존성에서 제외하여 무한 루프 방지
  const krStocksRef = useRef(krStocks);
  const usStocksRef = useRef(usStocks);
  useEffect(() => {
    krStocksRef.current = krStocks;
    usStocksRef.current = usStocks;
  }, [krStocks, usStocks]);

  // 최신 watchlist 심볼 — 클로저 없이 참조 (App이 주입)
  const krSymbolsRef = useRef([]);
  const usSymbolsRef = useRef([]);

  const refreshUsStocks = useCallback(async () => {
    try {
      // 항상 US_STOCK_LIST 전체 심볼 기반 폴링 — snapshot 시드 여부와 무관하게 250개 전체 유지
      const baseSymbols = US_STOCK_LIST.map(s => s.symbol);
      const baseSet = new Set(baseSymbols);
      const extraSymbols = usSymbolsRef.current.filter(sym => !baseSet.has(sym));
      const symbolsToFetch = [...baseSymbols, ...extraSymbols];
      if (symbolsToFetch.length === 0) return;

      const data = await fetchUsStocksBatch(symbolsToFetch);
      if (data.length > 0) {
        let mergedUs = null;
        // US_STOCK_LIST 메타맵 — sector/nameEn fallback 용
        setUsStocks(prev => {
          const map = new Map(prev.map(s => [s.symbol, s]));
          for (const u of data) {
            if (!u?.price) continue;
            if (map.has(u.symbol)) {
              const old = map.get(u.symbol);
              // sector/nameEn 메타 보존 — API가 새 값을 주면 업데이트, null/undefined일 때만 기존 유지
              const sector = u.sector ?? old.sector ?? US_META_MAP.get(u.symbol)?.sector;
              const nameEn = u.nameEn ?? old.nameEn ?? US_META_MAP.get(u.symbol)?.nameEn;
              // sparkline 배열 참조 안정화 — 마지막 값이 같으면 기존 참조 유지 (Sparkline memo 최적화)
              const newSparkline = u.sparkline?.length ? u.sparkline : old.sparkline;
              const oldSparkline = old.sparkline;
              const stableSparkline = (oldSparkline?.length === newSparkline?.length &&
                oldSparkline?.[oldSparkline.length - 1] === newSparkline?.[newSparkline.length - 1])
                ? oldSparkline : newSparkline;
              map.set(u.symbol, { ...old, ...u, sector, nameEn, sparkline: stableSparkline });
            } else {
              // 신규 심볼 — US_STOCK_LIST 메타(sector, nameEn) 반영
              const meta = US_META_MAP.get(u.symbol) ?? {};
              map.set(u.symbol, { symbol: u.symbol, name: u.name || meta.name || u.symbol, market: 'us', sparkline: [], ...u, sector: u.sector ?? meta.sector, nameEn: u.nameEn ?? meta.nameEn });
            }
          }
          mergedUs = [...map.values()];
          return mergedUs;
        });
        // merged 전체 저장 — raw data만 저장 시 재방문에서 sector/nameEn 메타 소실
        if (mergedUs) savePriceCache(CACHE_KEY_US, mergedUs);
        checkAndAlertBatch(data, 'us');
        setDataErrors(prev => ({ ...prev, us: false }));
      } else {
        setDataErrors(prev => ({ ...prev, us: true }));
      }
    } catch { setDataErrors(prev => ({ ...prev, us: true })); }
  }, []); // ref 패턴 — stocks 의존성 없음

  const refreshKoreanStocks = useCallback(async () => {
    try {
      // KR 브라우저 폴링은 fallback + watchlist 소규모로만 — snapshot cron이 전종목 커버
      const pollSet = new Set([...KR_FALLBACK_SYMBOLS, ...krSymbolsRef.current]);
      const currentKrMap = new Map(krStocksRef.current.map(s => [s.symbol, s]));
      const stocksToFetch = [...pollSet].map(sym =>
        currentKrMap.get(sym) ?? { symbol: sym, name: sym, market: 'kr', price: 0, sparkline: [] }
      );

      const data = await fetchKoreanStocksBatch(stocksToFetch);
      if (data.length > 0) {
        let mergedKr = null;
        setKrStocks(prev => {
          const map = new Map(prev.map(s => [s.symbol, s]));
          for (const u of data) {
            if (!u?.price) continue;
            if (map.has(u.symbol)) {
              const old = map.get(u.symbol);
              const name = resolveKrName(u.symbol, u.name) || old.name || u.symbol;
              const sector = old.sector || KR_SECTOR_MAP.get(u.symbol);
              map.set(u.symbol, { ...old, ...u, name, sector, sparkline: [...(old.sparkline?.slice(1) ?? []), u.price] });
            } else {
              const name = resolveKrName(u.symbol, u.name) || u.symbol;
              const sector = KR_SECTOR_MAP.get(u.symbol);
              map.set(u.symbol, { ...u, symbol: u.symbol, name, sector, market: 'kr', sparkline: [u.price] });
            }
          }
          mergedKr = [...map.values()];
          return mergedKr;
        });
        // merged 전체 저장 — 폴링 결과(소규모)만 저장하면 재방문 시 전종목 소실
        if (mergedKr) savePriceCache(CACHE_KEY_KR, mergedKr);
        checkAndAlertBatch(data, 'kr');
        setDataErrors(prev => ({ ...prev, kr: false }));
      } else {
        setDataErrors(prev => ({ ...prev, kr: true }));
      }
    } catch { setDataErrors(prev => ({ ...prev, kr: true })); }
  }, []); // ref 패턴 — stocks 의존성 없음

  // #185: snapshot 초기 로드 = hot tier(Top 200) 즉시 → full tier lazy merge.
  //        applySnapshot 로 merge 경로 단일화 → hot/full 동일 로직 공유.
  useEffect(() => {
    let cancelled = false;

    const applySnapshot = (snap) => {
      if (cancelled || !snap) return;
      if (snap.kr?.length > 0) {
        setKrStocks(prev => {
          if (prev.length === 0) {
            return snap.kr.map(u => ({ ...u, sector: KR_SECTOR_MAP.get(u.symbol) ?? u.sector }));
          }
          const map = new Map(prev.map(s => [s.symbol, s]));
          for (const u of snap.kr) {
            if (u?.price > 0) {
              const old = map.get(u.symbol) ?? {};
              const name = resolveKrName(u.symbol, u.name) || old.name || u.symbol;
              const sector = old.sector || KR_SECTOR_MAP.get(u.symbol) || u.sector;
              map.set(u.symbol, { ...old, ...u, name, sector });
            }
          }
          return [...map.values()];
        });
      }
      setUsStocks(prev => {
        if (prev.length > 0 && !snap.us?.length) return prev;
        const base = prev.length === 0 ? [...US_STOCK_LIST] : [...prev];
        const map = new Map(base.map(s => [s.symbol, s]));
        for (const u of (snap.us ?? [])) {
          if (u?.price > 0) {
            const existing = map.get(u.symbol) ?? US_META_MAP.get(u.symbol) ?? {};
            map.set(u.symbol, { ...existing, ...u });
          }
        }
        return [...map.values()];
      });
    };

    let idleId = null;
    let timerId = null;

    (async () => {
      // 1단계: hot — 작고 빠르게 (~30KB) 홈 즉시 렌더
      const hot = await fetchSnapshot({ tier: 'hot' });
      applySnapshot(hot);
      if (!cancelled) setPricesReady(true);

      // 2단계: full lazy — idle 시점에 전종목 보강. ric 없으면 1s setTimeout fallback.
      const loadFull = async () => {
        if (cancelled) return;
        const full = await fetchSnapshot({ tier: 'full' });
        applySnapshot(full);
      };
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(loadFull, { timeout: 2000 });
      } else {
        timerId = setTimeout(loadFull, 1000);
      }
    })();

    return () => {
      cancelled = true;
      if (idleId != null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timerId != null) clearTimeout(timerId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let usTimerId = null;
    let krTimerId = null;
    let destroyed = false;

    const scheduleUs = () => {
      if (destroyed) return;
      const delay = isUsMarketOpen() ? POLLING.NORMAL : POLLING.CLOSED;
      usTimerId = setTimeout(async () => {
        if (!document.hidden) await refreshUsStocks();
        scheduleUs();
      }, delay);
    };

    const scheduleKr = () => {
      if (destroyed) return;
      const delay = isKoreanMarketOpen() ? POLLING.NORMAL : POLLING.CLOSED;
      krTimerId = setTimeout(async () => {
        if (!document.hidden) await refreshKoreanStocks();
        scheduleKr();
      }, delay);
    };

    refreshUsStocks();
    refreshKoreanStocks();
    scheduleUs();
    scheduleKr();

    // 탭 복귀 시 즉시 갱신 + 다음 스케줄 재시작
    const onVisible = () => {
      if (document.hidden) return;
      clearTimeout(usTimerId);
      clearTimeout(krTimerId);
      refreshUsStocks();
      refreshKoreanStocks();
      scheduleUs();
      scheduleKr();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      destroyed = true;
      clearTimeout(usTimerId);
      clearTimeout(krTimerId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshUsStocks, refreshKoreanStocks]);

  return {
    usStocks, setUsStocks,
    krStocks, setKrStocks,
    pricesReady,
    dataErrors, setDataErrors,
    krSymbolsRef, usSymbolsRef,
    refreshUsStocks, refreshKoreanStocks,
  };
}
