// 투자자 시그널 훅 — 거래량 이상치(volume_anomaly) 감지 + 부팅 시드
// 15분 간격 폴링.
//
// ⚠️ #366 (signal-overhaul-2026-06-08): 데이터 포렌식 결과 다음 발화 경로가 제거됨 —
//    외국인/기관 연속매매·스마트머니·섹터 로테이션·교차시장·시장무드·갭·리밸런싱·환율충격·
//    투매(capitulation)·스텔스·BTC선행·섹터이탈·거래량가격괴리.
//    살아남은 발화는 volume_anomaly(부팅 시드 포함)뿐이다.
import { useEffect, useRef } from 'react';
import {
  createVolumeSignal, createSignal, addSignal, getActiveSignals,
  beginBatch, endBatch,
} from '../engine/signalEngine';
import { SIGNAL_TYPES, DIRECTIONS, STABLECOIN_SYMBOLS } from '../engine/signalTypes';
import { clampPct } from '../utils/clampPct';

// 현재가 조회 헬퍼 — symbol 매칭 후 가격 필드 우선순위대로 반환
// 시그널 적중률 추적용 priceAtFire 전달 — 0은 데이터 오류로 간주하고 건너뜀 (#116)
function getPriceFromItems(symbol, items) {
  if (!symbol || !items?.length) return null;
  const up = String(symbol).toUpperCase();
  const item = items.find(i =>
    String(i.symbol || '').toUpperCase() === up || i.id === symbol,
  );
  if (!item) return null;
  const candidates = [item.price, item.priceKrw, item.priceUsd, item.close, item.currentPrice];
  for (const v of candidates) {
    if (v != null && v > 0) return v;
  }
  return null;
}

const POLL_INTERVAL = 15 * 60 * 1000; // 15분 (일별 데이터라 장중 수치 변동 없음)
// 기획: 20일 평균 대비 3배이나 히스토리 API 한계로 마켓 내 상위 5% 기준 적용
const VOLUME_PERCENTILE_THRESHOLD = 0.95; // 상위 5% (95th percentile)

/**
 * 마켓별 거래량 퍼센타일 기준값 계산 (상위 5% = 95th percentile)
 * @param {Array} items - allItems 배열
 * @param {string} market - 'KR', 'US', 'COIN'
 * @returns {number} 95th percentile 기준값
 */
function calcPercentileVolume(items, market) {
  const volumes = items
    .filter(i => i._market === market && (i.volume ?? i.volume24h ?? 0) > 0)
    .map(i => i.volume ?? i.volume24h ?? 0)
    .sort((a, b) => a - b);

  if (!volumes.length) return 0;
  const idx = Math.floor(volumes.length * VOLUME_PERCENTILE_THRESHOLD);
  return volumes[Math.min(idx, volumes.length - 1)];
}

/**
 * 거래량 이상치 시그널 훅
 * @param {Array} allItems - 전체 종목 배열 ({ symbol, name, volume, _market } 포함)
 */
export function useInvestorSignals(allItems = []) {
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const allItemsRef = useRef(allItems); // 최신 allItems를 ref로 유지 — 타이머 리셋 방지

  // allItems가 변경될 때마다 ref 갱신 — useEffect 내에서 안전하게 참조
  useEffect(() => {
    allItemsRef.current = allItems;
  }, [allItems]);

  useEffect(() => {
    let retryTimer = null; // 재시도 타이머 추적 (언마운트 시 정리)

    function scan() {
      if (runningRef.current) return;
      runningRef.current = true;

      const items = allItemsRef.current;
      // 스캔 전체를 배치로 묶어 _notify를 1회로 압축 — 다수 addSignal 호출로 인한 연속 리렌더 방지
      // beginBatch를 try 안에서 호출해 pair invariant 보장 (#229)
      let _batchOpened = false;
      try {
        beginBatch();
        _batchOpened = true;
        // ── 거래량 이상치 시그널 ──
        scanVolumeAnomalies(items);

        // ── 부팅 시드 — 시그널 0건이면 변동폭 상위 종목으로 즉시 생성 ──
        generateBootSeedSignals(items);
      } catch {
        // 에러 무시 — 다음 폴링에서 재시도
      } finally {
        runningRef.current = false;
        // 배치 종료 — beginBatch가 성공한 경우에만 (pair invariant)
        if (_batchOpened) endBatch();
      }
    }

    // 마운트 즉시 부팅 시드 — 가격 데이터 이미 있으면 바로 시그널 생성
    generateBootSeedSignals(allItemsRef.current);

    // 초기 풀 스캔 (마운트 후 2초 대기 — 가격 데이터 로딩 여유)
    // allItems가 비어있으면 4초 후 1회 재시도 (경합 조건 방어)
    const initTimer = setTimeout(() => {
      scan();
      if (!allItemsRef.current?.length) {
        retryTimer = setTimeout(scan, 4000);
      }
    }, 2000);

    // 15분 간격 폴링
    timerRef.current = setInterval(() => {
      if (!document.hidden) scan();
    }, POLL_INTERVAL);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(retryTimer);
      clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// 종목 등락률 추출 — 코인(id 존재)은 change24h, 주식은 changePct
function getPct(item) {
  if (item.id || item._market === 'COIN' || item.market === 'coin') return item.change24h ?? 0;
  return item.changePct ?? 0;
}

/** 부팅 시드 — 시그널 0건이면 변동폭 상위 종목으로 즉시 생성 */
function generateBootSeedSignals(allItems) {
  if (getActiveSignals().length > 0 || !allItems?.length) return;

  const topMovers = [...allItems]
    .filter(i => i._market && !STABLECOIN_SYMBOLS.has(i.symbol?.toUpperCase())) // 스테이블코인 제외
    .sort((a, b) => Math.abs(getPct(b)) - Math.abs(getPct(a)))
    .slice(0, 3);

  for (const item of topMovers) {
    const pct = getPct(item);
    if (Math.abs(pct) < 1) continue; // 1% 미만은 무시
    const marketLabel = item._market === 'COIN' ? '코인' : item._market === 'US' ? '미장' : '국장';
    const signal = createSignal({
      type: SIGNAL_TYPES.VOLUME_ANOMALY,
      symbol: item.symbol,
      name: item.name ?? item.symbol,
      market: (item._market || 'kr').toLowerCase(),
      direction: pct > 0 ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH,
      strength: Math.abs(pct) >= 5 ? 3 : 2,
      title: `${item.name ?? item.symbol} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% — 주목할 움직임`,
      detail: `${marketLabel} 변동폭 상위`,
    });
    addSignal(signal);
  }
}

/** 거래량 이상치 스캔 — 마켓 내 상위 5% (95th percentile) 기준 */
function scanVolumeAnomalies(allItems) {
  if (!allItems?.length) return;

  const markets = ['KR', 'US', 'COIN'];
  for (const market of markets) {
    const threshold = calcPercentileVolume(allItems, market);
    if (threshold <= 0) continue;

    const marketItems = allItems.filter(i => i._market === market);
    for (const item of marketItems) {
      // 스테이블코인은 거래량 시그널 제외 (투자 의미 없음)
      if (STABLECOIN_SYMBOLS.has(item.symbol?.toUpperCase())) continue;
      const vol = item.volume ?? item.volume24h ?? 0;
      if (vol <= 0) continue;
      if (vol >= threshold) {
        const pct = clampPct(item.changePct ?? item.change24h ?? 0);
        // addSignal의 가격 업그레이드 로직이 이후 폴링에서 priceAtFire를 갱신한다 (#116)
        const curPrice = getPriceFromItems(item.symbol, [item]);
        createVolumeSignal(
          item.symbol,
          item.name ?? item.symbol,
          market.toLowerCase(),
          vol,
          threshold,
          pct,
          curPrice,
        );
      }
    }
  }
}
