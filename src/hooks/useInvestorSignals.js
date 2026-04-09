// 투자자 시그널 훅 — 외국인/기관 연속 매수매도 + 거래량 이상치 감지
// 5분 간격 폴링으로 시그널 엔진에 시그널 추가
import { useEffect, useRef } from 'react';
import { fetchInvestorTrendGateway } from '../api/_gateway';
import {
  createInvestorSignal, createVolumeSignal, createSignal, addSignal, getActiveSignals,
  createSmartMoneySignal, createVolumePriceDivergenceSignal,
  createCrossMarketSignal, createMarketMoodShiftSignal,
  createGapSignal, createRebalancingSignal, createFxImpactSignal,
  createCapitulationSignal, createStealthActivitySignal,
  createBtcLeadingSignal, createSectorOutlierSignal,
  removeSignalByTypeAndSymbol,
} from '../engine/signalEngine';
import { detectGap, detectRebalancingWindow, detectFxImpact } from '../engine/taCalculator';
import { SIGNAL_TYPES, DIRECTIONS, STABLECOIN_SYMBOLS } from '../engine/signalTypes';
import { THRESHOLDS } from '../constants/signalThresholds';
import { clampPct } from '../utils/clampPct';

// 교차시장 상관관계 쌍 — leader가 먼저 움직이면 lagger가 따라갈 가능성
const CROSS_MARKET_PAIRS = [
  { leader: 'BTC', lagger: 'MSTR', leaderMarket: 'COIN', laggerMarket: 'US' },
  { leader: 'BTC', lagger: 'IBIT', leaderMarket: 'COIN', laggerMarket: 'US' },
  { leader: 'ETH', lagger: 'COIN', leaderMarket: 'COIN', laggerMarket: 'US' },
  { leader: 'SOL', lagger: 'COIN', leaderMarket: 'COIN', laggerMarket: 'US' },
  { leader: 'NVDA', lagger: '000660', leaderMarket: 'US', laggerMarket: 'KR' },
  { leader: 'AAPL', lagger: '005930', leaderMarket: 'US', laggerMarket: 'KR' },
  { leader: 'TSLA', lagger: '373220', leaderMarket: 'US', laggerMarket: 'KR' },
];

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
  const moodPrevRef = useRef(null); // 시장 무드 이전 상태 (메모리 기반)
  const allItemsRef = useRef(allItems); // 최신 allItems를 ref로 유지 — 타이머 리셋 방지
  const sectorRanksPrevRef = useRef(null); // 섹터 순위 이전 상태 (localStorage 대신 메모리)

  // allItems가 변경될 때마다 ref 갱신 — useEffect 내에서 안전하게 참조
  useEffect(() => {
    allItemsRef.current = allItems;
  }, [allItems]);

  useEffect(() => {
    let retryTimer = null; // 재시도 타이머 추적 (언마운트 시 정리)

    async function scan() {
      if (runningRef.current) return;
      runningRef.current = true;

      const items = allItemsRef.current;
      try {
        // ── P0-1: 외국인/기관 연속 매수매도 시그널 ──
        await scanInvestorTrends();

        // ── P0-2: 거래량 이상치 시그널 ──
        scanVolumeAnomalies(items);

        // ── P0-3: 섹터 로테이션 + 현재 섹터 강세/약세 감지 ──
        detectSectorRotation(items, sectorRanksPrevRef);

        // ── P0-4: 부팅 시드 — 시그널 0건이면 변동폭 상위 종목으로 즉시 생성 ──
        generateBootSeedSignals(items);

        // ── 신규: 교차시장 상관관계 ──
        detectCrossMarketCorrelation(items);

        // ── 신규: 시장 무드 전환 ──
        detectMarketMoodShift(items, moodPrevRef);

        // ── 신규: 갭 분석 ──
        detectGapSignals(items);

        // ── 신규: 리밸런싱 경고 ──
        detectRebalancingSignal();

        // ── 신규: 환율 영향 ──
        detectFxImpactSignal(items);

        // ── Tier2: 투매 감지 (캐피튤레이션) ──
        detectCapitulation(items);

        // ── Tier2: 스텔스 활동 (뉴스 없는 거래 폭발) ──
        detectStealthActivity(items);

        // ── Tier2: BTC 선행 알트코인 예측 ──
        detectBtcLeading(items);

        // ── Tier2: 섹터 이탈 종목 ──
        detectSectorOutlier(items);
      } catch {
        // 에러 무시 — 다음 폴링에서 재시도
      } finally {
        runningRef.current = false;
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

    // 5분 간격 폴링
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

/** 외국인/기관 연속 매수매도 스캔 — 5종목 병렬 호출 */
async function scanInvestorTrends() {
  // Promise.allSettled로 병렬화 (기존 순차 for loop → 로딩 최적화)
  await Promise.allSettled(KR_TOP_SYMBOLS.map(async ({ symbol, name }) => {
    try {
      const result = await fetchInvestorTrendGateway(symbol, 10);
      const data = result?.data;
      if (!Array.isArray(data) || data.length === 0) return;

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

      // 스마트머니 — 외국인+기관 동시 MIN_DAYS일+ 매수 또는 매도
      const smMinDays = THRESHOLDS.SMART_MONEY.MIN_DAYS;
      if (foreign.buyDays >= smMinDays && inst.buyDays >= smMinDays) {
        createSmartMoneySignal(symbol, name, foreign.buyDays, inst.buyDays, foreign.totalAmt + inst.totalAmt, true);
      } else if (foreign.sellDays >= smMinDays && inst.sellDays >= smMinDays) {
        createSmartMoneySignal(symbol, name, foreign.sellDays, inst.sellDays, Math.abs(foreign.totalAmt) + Math.abs(inst.totalAmt), false);
      }
    } catch {
      // 개별 종목 실패 시 무시 — 다른 종목은 계속 진행
    }
  }));
}

/** 섹터 로테이션 감지 — 전일 대비 섹터 순위 3단계+ 변동 시 시그널
 * @param {Array} allItems - 전체 종목 배열
 * @param {{ current: object|null }} sectorRanksPrevRef - 이전 섹터 순위 ref (메모리 기반)
 */
function detectSectorRotation(allItems, sectorRanksPrevRef) {
  if (!allItems?.length) return;

  // 섹터별 평균 등락률
  const sectorPcts = {};
  for (const item of allItems) {
    if (!item.sector) continue;
    const pct = clampPct(item.changePct ?? item.change24h ?? 0);
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

  // 이전 순위 비교 (useRef 기반 — localStorage 대신 메모리)
  const prevRanks = sectorRanksPrevRef.current;
  sectorRanksPrevRef.current = curRanks;

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
        createVolumeSignal(
          item.symbol,
          item.name ?? item.symbol,
          market.toLowerCase(),
          vol,
          threshold,
          pct,
        );
      }

      // 거래량-가격 괴리 — 거래량 폭발인데 가격 정체 (accumulation), 또는 큰 가격 변동인데 거래량 부족 (weak_move)
      const pct = clampPct(item.changePct ?? item.change24h ?? 0);
      const volRatio = threshold > 0 ? vol / threshold : 0;
      const T_VP = THRESHOLDS.VOL_PRICE;
      if (volRatio >= T_VP.HIGH_VOL_LOW_PRICE_RATIO && Math.abs(pct) < T_VP.HIGH_VOL_MAX_PRICE) {
        // 거래량 2배+ 인데 가격 1% 미만 — 누군가 모으는 중
        createVolumePriceDivergenceSignal(item.symbol, item.name ?? item.symbol, market.toLowerCase(), 'accumulation', pct, volRatio);
      } else if (Math.abs(pct) >= T_VP.BIG_PRICE_MIN && vol > 0 && vol < threshold * 0.5) {
        // 가격 5%+ 변동인데 거래량 평균의 절반 이하 — 약한 움직임
        createVolumePriceDivergenceSignal(item.symbol, item.name ?? item.symbol, market.toLowerCase(), 'weak_move', pct, volRatio);
      }
    }
  }
}

/** 교차시장 상관관계 감지 — leader/lagger 괴리율 기준 */
function detectCrossMarketCorrelation(allItems) {
  if (!allItems?.length) return;

  // 심볼→종목 맵 (빠른 조회)
  const bySymbol = {};
  for (const item of allItems) {
    bySymbol[item.symbol] = item;
  }

  const T_CM = THRESHOLDS.CROSS_MARKET;
  const krNameMap = Object.fromEntries(KR_TOP_SYMBOLS.map(s => [s.symbol, s.name]));
  for (const pair of CROSS_MARKET_PAIRS) {
    const leaderItem = bySymbol[pair.leader];
    const laggerItem = bySymbol[pair.lagger];
    if (!leaderItem || !laggerItem) continue;

    const leaderPct = clampPct(leaderItem.changePct ?? leaderItem.change24h ?? 0);
    const laggerPct = clampPct(laggerItem.changePct ?? laggerItem.change24h ?? 0);
    const gap = Math.abs(leaderPct - laggerPct);

    // 같은 방향인데 괴리가 크거나, 반대 방향이면 시그널
    if (gap >= T_CM.DIVERGENCE) {
      const leaderName = leaderItem.name || pair.leader;
      const laggerName = laggerItem.name || krNameMap[pair.lagger] || pair.lagger;
      createCrossMarketSignal(pair.leader, pair.lagger, leaderPct, laggerPct, leaderName, laggerName);
    }
  }
}

/** 시장 무드 전환 감지 — 3시장 동시 방향 전환 또는 합의
 * @param {Array} allItems - 전체 종목 배열
 * @param {{ current: object|null }} moodPrevRef - 이전 시장 방향 상태 ref (메모리 기반)
 */
function detectMarketMoodShift(allItems, moodPrevRef) {
  if (!allItems?.length) return;

  const T_MM = THRESHOLDS.MARKET_MOOD;

  // 시장별 평균 등락률 계산
  const marketPcts = { KR: [], US: [], COIN: [] };
  for (const item of allItems) {
    const m = (item._market || '').toUpperCase();
    if (marketPcts[m]) {
      marketPcts[m].push(clampPct(item.changePct ?? item.change24h ?? 0));
    }
  }

  const marketAvgs = {};
  const marketDirs = {};
  for (const [market, pcts] of Object.entries(marketPcts)) {
    if (!pcts.length) continue;
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    marketAvgs[market] = +avg.toFixed(2);
    if (avg > T_MM.DIRECTION_THRESHOLD) marketDirs[market] = 'bullish';
    else if (avg < -T_MM.DIRECTION_THRESHOLD) marketDirs[market] = 'bearish';
    else marketDirs[market] = 'neutral';
  }

  const dirs = Object.values(marketDirs);
  const markets = Object.keys(marketDirs);
  if (markets.length < 3) return;

  // 항상 현재 상태 저장 (consensus 포함 — 조기 return 시 미갱신 방지)
  const prev = moodPrevRef.current;
  moodPrevRef.current = { dirs: marketDirs, ts: Date.now() };

  // 3시장 합의 (모두 같은 방향, neutral 제외)
  const nonNeutral = dirs.filter(d => d !== 'neutral');
  if (nonNeutral.length === 3 && new Set(nonNeutral).size === 1) {
    createMarketMoodShiftSignal('consensus', nonNeutral[0], markets, marketAvgs);
    return;
  }

  // 이전 상태 없거나 STALE_MS 초과 시 무시 (탭 비활성 후 복귀 시 허위 시그널 방지)
  if (!prev || Date.now() - prev.ts > T_MM.STALE_MS) return;
  const prevDirs = prev.dirs;

  const flipped = [];
  for (const market of markets) {
    const prevDir = prevDirs[market];
    const cur = marketDirs[market];
    if (prevDir && cur && prevDir !== 'neutral' && cur !== 'neutral' && prevDir !== cur) {
      flipped.push(market);
    }
  }

  if (flipped.length >= T_MM.MIN_FLIPS) {
    // 전환된 시장의 현재 방향 — 다수결
    const bullCount = flipped.filter(m => marketDirs[m] === 'bullish').length;
    const direction = bullCount > flipped.length / 2 ? 'bullish' : 'bearish';
    createMarketMoodShiftSignal('shift', direction, flipped, marketAvgs);
  }
}

/** 갭 분석 — sparkline/캔들 데이터가 있는 종목의 전일 종가 vs 당일 시가 갭 감지 */
function detectGapSignals(allItems) {
  if (!allItems?.length) return;
  const T_GAP = THRESHOLDS.GAP;

  for (const item of allItems) {
    // sparkline 데이터에서 캔들 추출 (open/close 필요)
    const candles = item.candles ?? item.sparkline;
    if (!Array.isArray(candles) || candles.length < 2) continue;

    const result = detectGap(candles);
    if (!result || Math.abs(result.gapPct) < T_GAP.MIN_PCT) continue;

    const market = (item._market || 'kr').toLowerCase();
    createGapSignal(item.symbol, item.name ?? item.symbol, market, result.gapPct);
  }
}

/** 리밸런싱 경고 — 월말/분기말 영업일 3일 이내 시 기관 매물 출회 경고 */
function detectRebalancingSignal() {
  const result = detectRebalancingWindow();
  if (!result || !result.isRebalancing) return;
  // 중복 방지: 기존 리밸런싱 시그널 제거 후 재생성
  removeSignalByTypeAndSymbol(SIGNAL_TYPES.REBALANCING_ALERT, 'MARKET');
  createRebalancingSignal(result.isQuarterEnd, result.daysLeft);
}

/** 환율 영향 — allItems에서 USDKRW 환율 데이터 추출 후 변동 감지 */
function detectFxImpactSignal(allItems) {
  if (!allItems?.length) return;

  // 환율 데이터는 별도 심볼 또는 메타데이터에서 추출
  const fxItem = allItems.find(i =>
    i.symbol === 'USDKRW' || i.symbol === 'USD/KRW' || i.symbol === 'KRW=X',
  );
  if (!fxItem) return;

  const rate = fxItem.price ?? fxItem.close ?? fxItem.currentPrice ?? 0;
  const prevRate = fxItem.prevClose ?? fxItem.previousClose ?? 0;
  if (!rate || !prevRate) return;

  const result = detectFxImpact(rate, prevRate);
  if (!result) return;

  createFxImpactSignal(rate, prevRate, result.changePct, result.impact);
}

/** 투매 감지 (캐피튤레이션) — 가격 급락 + 거래량 폭발 + 공포 극대 */
function detectCapitulation(allItems) {
  if (!allItems?.length) return;

  const T = THRESHOLDS.CAPITULATION;
  // 공포탐욕 지수는 기존 시그널에서 추출
  const fgSignal = getActiveSignals().find(s => s.type === SIGNAL_TYPES.FEAR_GREED_SHIFT);
  const fearGreed = fgSignal?.meta?.current ?? 50; // 기본값 50 (중립)

  const markets = ['KR', 'US', 'COIN'];
  for (const market of markets) {
    const threshold = calcPercentileVolume(allItems, market);
    if (threshold <= 0) continue;

    const marketItems = allItems.filter(i => i._market === market);
    for (const item of marketItems) {
      if (STABLECOIN_SYMBOLS.has(item.symbol?.toUpperCase())) continue;
      const pct = clampPct(item.changePct ?? item.change24h ?? 0);
      const vol = item.volume ?? item.volume24h ?? 0;
      const volRatio = threshold > 0 ? vol / threshold : 0;

      // 가격 급락 + 거래량 폭발 + 공포 지수 낮음
      if (pct <= T.PRICE_DROP && volRatio >= T.VOLUME_RATIO && fearGreed <= T.FEAR_GREED_MAX) {
        createCapitulationSignal(
          item.symbol, item.name ?? item.symbol,
          market.toLowerCase(), pct, volRatio, fearGreed,
        );
      }
    }
  }
}

/** 스텔스 활동 감지 — 거래량 폭발인데 해당 종목 뉴스 없음 */
function detectStealthActivity(allItems) {
  if (!allItems?.length) return;

  const T = THRESHOLDS.STEALTH;
  const markets = ['KR', 'US', 'COIN'];
  for (const market of markets) {
    const threshold = calcPercentileVolume(allItems, market);
    if (threshold <= 0) continue;

    const marketItems = allItems.filter(i => i._market === market);
    for (const item of marketItems) {
      if (STABLECOIN_SYMBOLS.has(item.symbol?.toUpperCase())) continue;
      const vol = item.volume ?? item.volume24h ?? 0;
      const volRatio = threshold > 0 ? vol / threshold : 0;

      if (volRatio >= T.VOLUME_RATIO) {
        createStealthActivitySignal(
          item.symbol, item.name ?? item.symbol,
          market.toLowerCase(), volRatio,
        );
      }
    }
  }
}

/** BTC 선행 알트코인 예측 — BTC 급등락인데 알트코인 미반영 */
function detectBtcLeading(allItems) {
  if (!allItems?.length) return;

  const T = THRESHOLDS.BTC_LEADING;
  const btcItem = allItems.find(i => i.symbol === 'BTC' || i.symbol === 'bitcoin');
  if (!btcItem) return;

  const btcChange = clampPct(btcItem.change24h ?? btcItem.changePct ?? 0);
  if (Math.abs(btcChange) < T.BTC_MIN_CHANGE) return;

  for (const altSymbol of T.ALT_SYMBOLS) {
    const altItem = allItems.find(i => i.symbol === altSymbol || i.symbol?.toUpperCase() === altSymbol);
    if (!altItem) continue;

    const altChange = clampPct(altItem.change24h ?? altItem.changePct ?? 0);
    if (Math.abs(altChange) < T.ALT_MAX_CHANGE) {
      createBtcLeadingSignal(altSymbol, btcChange, altChange);
    }
  }
}

/** 섹터 이탈 종목 감지 — 섹터 평균 대비 2σ 이상 이탈 */
function detectSectorOutlier(allItems) {
  if (!allItems?.length) return;

  const T = THRESHOLDS.SECTOR_OUTLIER;

  // 섹터별 등락률 수집
  const sectorData = {};
  for (const item of allItems) {
    if (!item.sector) continue;
    const pct = clampPct(item.changePct ?? item.change24h ?? 0);
    if (!sectorData[item.sector]) sectorData[item.sector] = [];
    sectorData[item.sector].push({ item, pct });
  }

  for (const [sector, entries] of Object.entries(sectorData)) {
    if (entries.length < T.MIN_SECTOR_SIZE) continue;

    // 섹터 평균 + 표준편차 계산
    const pcts = entries.map(e => e.pct);
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const variance = pcts.reduce((a, b) => a + (b - avg) ** 2, 0) / pcts.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev <= 0) continue;

    // 2σ 이상 이탈 종목 시그널
    for (const { item, pct } of entries) {
      const deviation = (pct - avg) / stdDev;
      if (Math.abs(deviation) >= T.MIN_DEVIATION) {
        const above = deviation > 0;
        const market = (item._market || 'kr').toLowerCase();
        createSectorOutlierSignal(
          item.symbol, item.name ?? item.symbol, market,
          +deviation.toFixed(2), +avg.toFixed(2), pct, sector, above,
        );
      }
    }
  }
}
