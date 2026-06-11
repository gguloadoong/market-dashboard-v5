// 미국·국내 주식 가격 폴링 훅
import { useState, useEffect, useCallback, useRef } from 'react';
import { US_STOCK_LIST } from '../data/usStockList';
import { US_CORE_SYMBOLS } from '../constants/market';
import { KR_SECTOR_MAP } from '../data/krStockList';
import KR_STOCK_NAMES from '../data/krStockNames.json';
import { fetchSnapshot } from '../api/snapshot';
import { fetchUsStocksBatch, fetchKoreanStocksBatch } from '../api/stocks';
import { checkAndAlertBatch } from '../utils/priceAlert';
import { POLLING, POLLABLE_DATA_MODES } from '../constants/polling';
import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';

// US_STOCK_LIST 메타맵 — 모듈 스코프에 1회만 생성 (sector/nameEn fallback)
const US_META_MAP = new Map(US_STOCK_LIST.map(s => [s.symbol, s]));

// EUC-KR 모지바케 감지 — Latin-1 보충 범위 + U+FFFD
function isKrNameCorrupted(name) {
  return /[\u0080-\u00FF\uFFFD]/.test(name);
}

// KR 종목명 룩업 — 정적 테이블 우선, 오염된 API 이름은 무시
// null 반환 시 call site에서 old.name 등 상위 fallback이 동작할 수 있도록 symbol 반환 제거
function resolveKrName(symbol, apiName) {
  if (KR_STOCK_NAMES[symbol]) return KR_STOCK_NAMES[symbol];
  if (apiName && apiName !== symbol && !isKrNameCorrupted(apiName)) return apiName;
  return null;
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
  // #380: 데이터 freshness — 스냅샷 hot 응답의 asOf(마켓별 마지막 크론 성공 epoch ms). null이면 미표시.
  const [asOf, setAsOf] = useState(null);

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

  // #396: 배지 히스테리시스 — 단발 실패로 '시세 지연' 배지가 깜빡이지 않게
  // 연속 2회 실패 시에만 에러 ON, 성공 시 즉시 OFF
  const usFailStreakRef = useRef(0);
  const krFailStreakRef = useRef(0);
  const ERROR_FAIL_STREAK = 2;

  const refreshUsStocks = useCallback(async () => {
    try {
      // #396: 폴링은 코어+watchlist 소규모만 — 전종목(250)은 snapshot 크론(update-us, 2분)이 커버.
      // 250종목 fan-out이 /api/d 간헐 502의 원인이었음(국장과 동일 패턴으로 정렬).
      const symbolsToFetch = [...new Set([...US_CORE_SYMBOLS, ...usSymbolsRef.current])];
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
              // marketCap 보존 — us-price 폴링은 marketCap:0만 주므로, 스냅샷(update-us NASDAQ 수집)의
              // 정상값을 0으로 덮지 않게 가드. 회전율(leadingStocks turnoverRatio) 사각지대 방지 (#344)
              const marketCap = Number(u.marketCap) > 0 ? u.marketCap : old.marketCap;
              // sparkline 배열 참조 안정화 — 마지막 값이 같으면 기존 참조 유지 (Sparkline memo 최적화)
              const newSparkline = u.sparkline?.length ? u.sparkline : old.sparkline;
              const oldSparkline = old.sparkline;
              const stableSparkline = (oldSparkline?.length === newSparkline?.length &&
                oldSparkline?.[oldSparkline.length - 1] === newSparkline?.[newSparkline.length - 1])
                ? oldSparkline : newSparkline;
              map.set(u.symbol, { ...old, ...u, marketCap, sector, nameEn, sparkline: stableSparkline });
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
        usFailStreakRef.current = 0;
        setDataErrors(prev => prev.us ? { ...prev, us: false } : prev);
        // #380: 폴링 성공 = 데이터 갱신 → asOf.us 리셋. ⚠️ 객체 형태 유지(스냅샷도 {kr,us,coins} 객체 —
        // number로 set하면 headerAsOf의 asOf.us가 undefined→null→라벨 소멸. review CRITICAL)
        setAsOf(prev => ({ ...(prev && typeof prev === 'object' ? prev : {}), us: Date.now() }));
      } else {
        usFailStreakRef.current += 1;
        if (usFailStreakRef.current >= ERROR_FAIL_STREAK) setDataErrors(prev => prev.us ? prev : { ...prev, us: true });
      }
    } catch {
      usFailStreakRef.current += 1;
      if (usFailStreakRef.current >= ERROR_FAIL_STREAK) setDataErrors(prev => prev.us ? prev : { ...prev, us: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- ref 패턴, setter는 안정 참조

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
        krFailStreakRef.current = 0;
        setDataErrors(prev => prev.kr ? { ...prev, kr: false } : prev);
        // #380: 폴링 성공 → asOf.kr 리셋. 객체 형태 유지(review CRITICAL — number set 시 라벨 소멸)
        setAsOf(prev => ({ ...(prev && typeof prev === 'object' ? prev : {}), kr: Date.now() }));
      } else {
        krFailStreakRef.current += 1;
        if (krFailStreakRef.current >= ERROR_FAIL_STREAK) setDataErrors(prev => prev.kr ? prev : { ...prev, kr: true });
      }
    } catch {
      krFailStreakRef.current += 1;
      if (krFailStreakRef.current >= ERROR_FAIL_STREAK) setDataErrors(prev => prev.kr ? prev : { ...prev, kr: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- ref 패턴, setter는 안정 참조

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
      // #380: hot 응답의 asOf 캡처 (freshness 표시용). 객체 동일성 비교 불필요 — 헤더 1곳만 소비.
      if (!cancelled && hot?.asOf) setAsOf(hot.asOf);
      if (!cancelled) setPricesReady(true);

      // 2단계: full lazy — idle 시점에 전종목 보강. ric 없으면 1s setTimeout fallback.
      const loadFull = async () => {
        if (cancelled) return;
        const full = await fetchSnapshot({ tier: 'full' });
        applySnapshot(full);
        if (!cancelled && full?.asOf) setAsOf(full.asOf);
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
    // generation 카운터 — stale finally의 재스케줄링 차단 (in-flight fetch 자체는 정상 완료)
    let usGen = 0;
    let krGen = 0;
    // in-flight 플래그 — onVisible의 즉시 호출과 타이머 콜백 중복 요청 방지
    let usInFlight = false;
    let krInFlight = false;

    // 폴링 활성 판정은 dataMode 기반 — live/delayed 세션만 NORMAL(60s), lastClose는 CLOSED(5min)
    // (1차: 신규 세션 전부 lastClose → 거짓 라이브·Upstash 낭비 0)
    const usActive = () => POLLABLE_DATA_MODES.has(getUsMarketStatus().dataMode);
    const krActive = () => POLLABLE_DATA_MODES.has(getKoreanMarketStatus().dataMode);

    const scheduleUs = () => {
      if (destroyed) return;
      const myGen = ++usGen;
      const delay = usActive() ? POLLING.NORMAL : POLLING.CLOSED;
      usTimerId = setTimeout(async () => {
        if (destroyed || myGen !== usGen) return;
        try {
          usInFlight = true;
          if (!document.hidden) await refreshUsStocks();
        } finally {
          usInFlight = false;
          if (!destroyed && myGen === usGen) scheduleUs();
        }
      }, delay);
    };

    const scheduleKr = () => {
      if (destroyed) return;
      const myGen = ++krGen;
      // 한국장: dataMode 기반 — live(정규장)만 NORMAL, lastClose(시간외/NXT/주말)는 CLOSED
      const delay = krActive() ? POLLING.NORMAL : POLLING.CLOSED;
      krTimerId = setTimeout(async () => {
        if (destroyed || myGen !== krGen) return;
        try {
          krInFlight = true;
          if (!document.hidden) await refreshKoreanStocks();
        } finally {
          krInFlight = false;
          if (!destroyed && myGen === krGen) scheduleKr();
        }
      }, delay);
    };

    // 단일 스냅샷으로 scheduleUs/Kr 및 prev* 초기화 — 경계 시점 이중 읽기 race 방지
    let prevUsActive = usActive();
    let prevKrActive = krActive();

    // 마운트 즉시 refresh 제거 (#로딩최적화 2026-06-09) — hot 스냅샷 effect(L205-209)가 이미
    // krStocks/usStocks 시드 + setPricesReady. 여기서 또 refresh하면 us-price가 서버에서 250종목
    // per-symbol fan-out(최대 8s 지연)을 중복 발사 → 콜드로드 burst 주범. 첫 폴링은 scheduleUs/Kr의
    // setTimeout(NORMAL 60s / CLOSED 5min) 뒤부터. 탭복귀(onVisible)·시장전환은 즉시 refresh 유지.
    scheduleUs();
    scheduleKr();

    // 탭 복귀 시 즉시 갱신
    const onVisible = () => {
      if (document.hidden) return;
      clearTimeout(usTimerId);
      clearTimeout(krTimerId);
      if (!usInFlight) refreshUsStocks();
      if (!krInFlight) refreshKoreanStocks();
      scheduleUs();
      scheduleKr();
    };
    document.addEventListener('visibilitychange', onVisible);

    // 시장 전환 감지 — 2분마다 체크 (CLOSED 5분 stale 방지)
    // prev는 hidden 여부와 무관하게 항상 최신 갱신 (hidden→visible 후 spurious 트리거 방지)
    const transitionCheckerId = setInterval(() => {
      if (destroyed) return;
      const nowUsActive = usActive();
      const nowKrActive = krActive();
      if (!document.hidden) {
        if (!prevUsActive && nowUsActive) {
          clearTimeout(usTimerId);
          if (!usInFlight) refreshUsStocks();
          scheduleUs();
        }
        if (!prevKrActive && nowKrActive) {
          clearTimeout(krTimerId);
          if (!krInFlight) refreshKoreanStocks();
          scheduleKr();
        }
      }
      prevUsActive = nowUsActive;
      prevKrActive = nowKrActive;
    }, 2 * 60_000);

    return () => {
      destroyed = true;
      clearTimeout(usTimerId);
      clearTimeout(krTimerId);
      clearInterval(transitionCheckerId);
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
    asOf,
  };
}
