// 투자자 시그널 훅 — 외국인/기관 연속 매수매도 + 거래량 이상치 감지
// 5분 간격 폴링으로 시그널 엔진에 시그널 추가
import { useEffect, useRef } from 'react';
import { fetchInvestorTrendGateway } from '../api/_gateway';
import { createInvestorSignal, createVolumeSignal, createSignal, addSignal, getActiveSignals } from '../engine/signalEngine';
import { SIGNAL_TYPES, DIRECTIONS } from '../engine/signalTypes';

// 시총 상위 KR 종목 (최소 5개)
const KR_TOP_SYMBOLS = [
  { symbol: '005930', name: '삼성전자' },
  { symbol: '000660', name: 'SK하이닉스' },
  { symbol: '373220', name: 'LG에너지솔루션' },
  { symbol: '207940', name: '삼성바이오로직스' },
  { symbol: '005380', name: '현대차' },
];

const POLL_INTERVAL = 5 * 60 * 1000; // 5분
const CONSECUTIVE_THRESHOLD = 3; // 3일 연속부터 시그널 발화
// 기획: 20일 평균 대비 3배이나 히스토리 API 한계로 마켓 내 상위 5% 기준 적용
const VOLUME_PERCENTILE_THRESHOLD = 0.95; // 상위 5% (95th percentile)

/**
 * 투자자 동향 데이터에서 연속 순매수/순매도 일수 계산
 * @param {Array} data - [{ date, foreign, institution }] (최신→과거 순)
 * @param {'foreign'|'institution'} investorKey
 * @returns {{ buyDays: number, sellDays: number, totalAmt: number }}
 */
function calcConsecutive(data, investorKey) {
  if (!data?.length) return { buyDays: 0, sellDays: 0, totalAmt: 0 };

  let buyDays = 0;
  let sellDays = 0;
  let totalAmt = 0;

  // 최신일부터 연속 체크
  const firstVal = data[0]?.[investorKey] ?? 0;
  if (firstVal > 0) {
    // 연속 순매수
    for (const row of data) {
      const val = row[investorKey] ?? 0;
      if (val <= 0) break;
      buyDays += 1;
      totalAmt += val;
    }
  } else if (firstVal < 0) {
    // 연속 순매도
    for (const row of data) {
      const val = row[investorKey] ?? 0;
      if (val >= 0) break;
      sellDays += 1;
      totalAmt += val;
    }
  }

  return { buyDays, sellDays, totalAmt };
}

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
 * 투자자 연속 매수매도 + 거래량 이상치 시그널 훅
 * @param {Array} allItems - 전체 종목 배열 ({ symbol, name, volume, _market } 포함)
 */
export function useInvestorSignals(allItems = []) {
  const timerRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    async function scan() {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        // ── P0-1: 외국인/기관 연속 매수매도 시그널 ──
        await scanInvestorTrends();

        // ── P0-2: 거래량 이상치 시그널 ──
        scanVolumeAnomalies(allItems);

        // ── P0-3: 섹터 로테이션 + 현재 섹터 강세/약세 감지 ──
        detectSectorRotation(allItems);

        // ── P0-4: 부팅 시드 — 시그널 0건이면 변동폭 상위 종목으로 즉시 생성 ──
        generateBootSeedSignals(allItems);
      } catch {
        // 에러 무시 — 다음 폴링에서 재시도
      } finally {
        runningRef.current = false;
      }
    }

    // 초기 실행 (마운트 후 3초 대기 — 가격 데이터 로딩 여유)
    const initTimer = setTimeout(scan, 3000);

    // 5분 간격 폴링
    timerRef.current = setInterval(() => {
      if (!document.hidden) scan();
    }, POLL_INTERVAL);

    return () => {
      clearTimeout(initTimer);
      clearInterval(timerRef.current);
    };
  }, [allItems]);
}

/** 외국인/기관 연속 매수매도 스캔 */
async function scanInvestorTrends() {
  // 종목별 순차 호출 (API 부하 최소화)
  for (const { symbol, name } of KR_TOP_SYMBOLS) {
    try {
      const result = await fetchInvestorTrendGateway(symbol, 10);
      const data = result?.data;
      if (!Array.isArray(data) || data.length === 0) continue;

      // 외국인
      const foreign = calcConsecutive(data, 'foreign');
      if (foreign.buyDays >= CONSECUTIVE_THRESHOLD) {
        createInvestorSignal(
          symbol, name, 'kr',
          SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY,
          foreign.buyDays, foreign.totalAmt,
        );
      }
      if (foreign.sellDays >= CONSECUTIVE_THRESHOLD) {
        createInvestorSignal(
          symbol, name, 'kr',
          SIGNAL_TYPES.FOREIGN_CONSECUTIVE_SELL,
          foreign.sellDays, Math.abs(foreign.totalAmt),
        );
      }

      // 기관
      const inst = calcConsecutive(data, 'institution');
      if (inst.buyDays >= CONSECUTIVE_THRESHOLD) {
        createInvestorSignal(
          symbol, name, 'kr',
          SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_BUY,
          inst.buyDays, inst.totalAmt,
        );
      }
      if (inst.sellDays >= CONSECUTIVE_THRESHOLD) {
        createInvestorSignal(
          symbol, name, 'kr',
          SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_SELL,
          inst.sellDays, Math.abs(inst.totalAmt),
        );
      }
    } catch {
      // 개별 종목 실패 시 다음 종목 계속
    }
  }
}

/** 섹터 로테이션 감지 — 전일 대비 섹터 순위 3단계+ 변동 시 시그널 */
function detectSectorRotation(allItems) {
  if (!allItems?.length) return;

  // 섹터별 평균 등락률
  const sectorPcts = {};
  for (const item of allItems) {
    if (!item.sector) continue;
    const pct = item.changePct ?? item.change24h ?? 0;
    if (!sectorPcts[item.sector]) sectorPcts[item.sector] = [];
    sectorPcts[item.sector].push(pct);
  }

  const sectorAvg = Object.entries(sectorPcts)
    .map(([sector, pcts]) => ({
      sector,
      avg: pcts.reduce((a, b) => a + b, 0) / pcts.length,
    }))
    .sort((a, b) => b.avg - a.avg);

  // 현재 순위
  const curRanks = {};
  sectorAvg.forEach((s, i) => { curRanks[s.sector] = i + 1; });

  // 이전 순위 비교
  const prevRaw = localStorage.getItem('sector_ranks_prev');
  const prevRanks = prevRaw ? JSON.parse(prevRaw) : null;
  localStorage.setItem('sector_ranks_prev', JSON.stringify(curRanks));

  // ── P0-3: 첫 방문에도 섹터 강세/약세 시그널 생성 ──
  // 상위 3개 섹터 평균 등락률 2% 이상이면 강세 시그널
  const topSectors = sectorAvg.slice(0, 3);
  for (const { sector, avg } of topSectors) {
    if (avg >= 2) {
      const signal = createSignal({
        type: SIGNAL_TYPES.SECTOR_ROTATION,
        symbol: null,
        name: sector,
        market: 'kr',
        direction: DIRECTIONS.BULLISH,
        strength: avg >= 5 ? 3 : 2,
        title: `${sector} 섹터 +${avg.toFixed(1)}% 강세`,
        meta: { sector, avg },
      });
      addSignal(signal);
    }
  }
  // 하위 3개 섹터 평균 등락률 -2% 이하이면 약세 시그널
  const bottomSectors = sectorAvg.slice(-3);
  for (const { sector, avg } of bottomSectors) {
    if (avg <= -2) {
      const signal = createSignal({
        type: SIGNAL_TYPES.SECTOR_ROTATION,
        symbol: null,
        name: sector,
        market: 'kr',
        direction: DIRECTIONS.BEARISH,
        strength: avg <= -5 ? 3 : 2,
        title: `${sector} 섹터 ${avg.toFixed(1)}% 약세`,
        meta: { sector, avg },
      });
      addSignal(signal);
    }
  }

  if (!prevRanks) return;

  for (const [sector, curRank] of Object.entries(curRanks)) {
    const prevRank = prevRanks[sector];
    if (!prevRank) continue;
    const diff = prevRank - curRank; // 양수면 순위 상승
    if (Math.abs(diff) >= 3) {
      const direction = diff > 0 ? DIRECTIONS.BULLISH : DIRECTIONS.BEARISH;
      const strength = Math.min(Math.abs(diff), 5);
      const title = `${sector} 섹터 ${diff > 0 ? '급상승' : '급하락'} (${prevRank}위\u2192${curRank}위)`;

      const signal = createSignal({
        type: SIGNAL_TYPES.SECTOR_ROTATION,
        symbol: null,
        name: sector,
        market: 'kr',
        direction,
        strength,
        title,
        meta: { sector, prevRank, curRank, diff },
      });
      addSignal(signal);
    }
  }
}

/** 부팅 시드 — 시그널 0건이면 변동폭 상위 종목으로 즉시 생성 */
function generateBootSeedSignals(allItems) {
  if (getActiveSignals().length > 0 || !allItems?.length) return;

  // 등락률 추출 헬퍼
  const getPct = (item) => item.changePct ?? item.change24h ?? 0;

  const topMovers = [...allItems]
    .filter(i => i._market) // 유효한 종목만
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
      const vol = item.volume ?? item.volume24h ?? 0;
      if (vol <= 0) continue;
      if (vol >= threshold) {
        createVolumeSignal(
          item.symbol,
          item.name ?? item.symbol,
          market.toLowerCase(),
          vol,
          threshold,
        );
      }
    }
  }
}
