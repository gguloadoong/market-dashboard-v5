// 시장 레짐 — 주요 주식 지수 등락률 평균으로 하락장/혼조/상승장 판정 (#358)
//
// 배경: 시그널 엔진은 하락을 잡지만(약세 시그널 발화) 화면이 상승 위주로 보여
//   "하락장 미반영"으로 체감된다(architect 진단 = 정보위계 갭). 알고리즘을 바꾸지 않고
//   "오늘 시장이 어느 방향인지"를 한 줄 배지로 명시해 맥락을 복원한다.
//
// 설계:
//   - 주식 지수만 사용(DXY 달러인덱스 제외 — 환율은 주식 레짐과 무관, 평균 왜곡).
//   - 단순 평균 등락률 → ±REGIME_THRESHOLD(2%) 경계로 3분류.
//   - 지수 데이터 없으면 null(배지 미표시) — 빈/0 데이터로 가짜 '혼조' 표시 방지.

// 레짐 판정에 쓰는 주식 지수 id (market-indices.js: KOSPI/KOSDAQ/SPX/NDX/DJI, DXY 제외)
const EQUITY_INDEX_IDS = new Set(['KOSPI', 'KOSDAQ', 'SPX', 'NDX', 'DJI']);

// ±경계(%) — 하루 지수 평균 등락이 이 값을 넘으면 방향성 장세로 판정
export const REGIME_THRESHOLD = 2;

/**
 * computeMarketRegime — 주식 지수 평균 등락률로 시장 레짐 판정.
 * @param {Array<{id?:string, changePct?:number}>} indices useIndices().indices
 * @returns {{ regime:'down'|'mixed'|'up', label:string, avg:number }|null}
 *   유효한 주식 지수가 하나도 없으면 null. (색/글리프는 표시 컴포넌트가 소유 — ADR-002 빨강=상승/파랑=하락)
 */
export function computeMarketRegime(indices = []) {
  if (!Array.isArray(indices)) return null;

  // 실제 number 만 채택 — Number(null)/Number('')/Number(false)===0 이 평균에 0%로 섞여
  // '가짜 혼조'를 만드는 것을 차단(함수 계약). API(market-indices.js)는 changePct를 number로 공급.
  const pcts = indices
    .filter(idx => EQUITY_INDEX_IDS.has(idx?.id))
    .map(idx => idx?.changePct)
    .filter(v => typeof v === 'number' && Number.isFinite(v));

  if (pcts.length === 0) return null;

  const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  const rounded = Math.round(avg * 10) / 10; // 소수 1자리

  if (avg <= -REGIME_THRESHOLD) return { regime: 'down', label: '하락장', avg: rounded };
  if (avg >= REGIME_THRESHOLD) return { regime: 'up', label: '상승장', avg: rounded };
  return { regime: 'mixed', label: '혼조', avg: rounded };
}
