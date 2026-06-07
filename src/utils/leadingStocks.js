// 주도주 캐치 + 모핑 포커스 — 알고리즘 순수 모듈 (#335)
// architect(Opus) 확정 스펙(.tmp/spec-C-leading-stocks.md). UI 미포함(후속 #D).
//
// 핵심 아이디어:
//   "시총 대비 거래대금 쏠림(회전율)"으로 중소형 주도주를 포착한다.
//   삼성전자 같은 대형 저회전주가 상시 1위를 차지하는 문제를 회피하기 위해
//   거래대금 절대값이 아닌 회전율(turnover/marketCap) percentile을 1차 가중치로 둔다.
//
// 데이터 제약(설계 전제):
//   - 코인 marketCap=0 영구 → 회전율 불가 → 거래대금(accTradePrice24h) 절대 percentile로 대체.
//   - volume24h=0 영구 → 코인 거래량은 accTradePrice24h(거래대금)만 신뢰.
//   - 시간외 실시간 체결가 없음(스냅샷=정규장 종가) → GAP 모드는 "전일종가 갭+뉴스" 근사.
//   - 스냅샷 무섹터 → sector는 클라 정적맵 주입분만 존재 → 무섹터 주도주는 단일카드 폴백.
//   - baseline(20영업일 평균 거래대금) 없음 → 1차는 회전율로 대체, 2차에 KV 도입(w_surge).

import { DERIVATIVE_RE, US_NONCOMMON_RE, getPct, isCoinItem } from '../components/home/utils';
import { buildStockKeywords, matchesKeywords } from './newsAlias';
import { detectNewsSectors } from './newsTopicMap';

// ─── 상수 ────────────────────────────────────────────────────

// 잡주 컷 하한 (KRW 환산 거래대금). 초저시총 노이즈 제거.
// KR 50억 / US $50M(환율 환산) / COIN 100억
export const MIN_TURNOVER = {
  KR: 5_000_000_000,        // 50억 원
  US_USD: 50_000_000,       // $50M (turnoverKRW가 이미 KRW 환산이므로 비교 시 krwRate 곱)
  COIN: 10_000_000_000,     // 100억 원
};

// 스코어링 가중치. 1차는 baseline 부재로 w_surge=0(회전율로 대체).
export const SCORE_WEIGHTS = {
  primary:   { turn: 0.45, move: 0.35, news: 0.20, surge: 0.0 },
  secondary: { turn: 0.20, move: 0.25, news: 0.15, surge: 0.40 },
};

// 패널티
const PENALTY_DERIV = 60;   // 파생상품(레버리지/인버스 등)
const PENALTY_CLOSED = 40;  // 휴장 마켓 종목

// 핫섹터 부스트(테마 클러스터링)
const HOT_SECTOR_BOOST = 1.3;
const BREADTH_DENOM = 5;    // breadth = min(종목수/5, 1)

// 섹터 어휘 정규화 — item.sector(krStockList/usStockList 표준)와
// detectNewsSectors(newsTopicMap) 어휘가 달라 substring 매칭이 양방향 실패하는 문제 해소.
//   예) item.sector '2차전지' ↔ 뉴스 '배터리'/'전기차' → 둘 다 includes 실패 → 핫섹터·브릿지 무력화.
// 같은 캐노니컬 그룹으로 묶어 isHot 비교와 CROSS_MARKET 키 조회 양쪽에 적용한다.
//
// [W1 수정] newsTopicMap.ai_tech.sectors는 ['AI','IT소프트웨어','반도체']로 '소프트웨어'(범용)를
// 의도적으로 분리한다. 별칭이 AI/IT소프트웨어/소프트웨어를 모두 software로 통합하면 AI 뉴스 1건이
// 모든 범용 '소프트웨어' 섹터 종목을 isHot으로 만들어 ×1.3 부스트되는 과대평가 문제 발생.
// → 'AI'·'IT소프트웨어'·'AI/소프트웨어'는 software_ai(AI 뉴스 직접 영향), '소프트웨어'(범용)는
// software_generic(별도)로 분리해 newsTopicMap 어휘와 정합.
const SECTOR_ALIASES = {
  // KR item.sector 어휘
  '2차전지': 'battery',
  '자동차': 'auto',
  // US item.sector 어휘
  '전기차': 'battery',
  '소프트웨어': 'software_generic',     // 범용 SW — AI 뉴스에 자동 휩쓸리지 않음
  'AI/소프트웨어': 'software_ai',
  'IT소프트웨어': 'software_ai',
  '핀테크': 'fintech',
  '미디어': 'media',
  '리츠': 'reit',
  '산업': 'industrial',
  // detectNewsSectors(newsTopicMap) 어휘
  '배터리': 'battery',
  '자동차부품': 'auto',
  'AI': 'software_ai',
};

// 섹터명 → 캐노니컬 키(별칭 없으면 원문 유지). isHot/CROSS_MARKET 비교 정규화용.
function canonicalSector(sector) {
  if (!sector) return '';
  return SECTOR_ALIASES[sector] || sector;
}

// 두 섹터가 같은 테마인지 — 캐노니컬 일치 또는 (원문) 양방향 substring.
// [W1 보강] 둘 중 하나라도 SECTOR_ALIASES에 명시된 어휘라면 substring 폴백을 끄고
// 캐노니컬 일치만 인정 — 별칭 정의로 분리한 의도(예 '소프트웨어' vs 'IT소프트웨어')를
// substring("IT소프트웨어".includes("소프트웨어")=true)가 우회하는 버그 방지.
function sectorMatches(a, b) {
  if (!a || !b) return false;
  if (canonicalSector(a) === canonicalSector(b)) return true;
  // 한쪽이라도 별칭 사전에 정의되어 있으면 substring 매칭 비활성(분리 의도 보존).
  if (SECTOR_ALIASES[a] !== undefined || SECTOR_ALIASES[b] !== undefined) return false;
  return a.includes(b) || b.includes(a);
}

// 모핑 모드 식별자
export const MORPH_MODE = {
  KR_LEAD:   'KR_LEAD',
  US_LEAD:   'US_LEAD',
  US_GAP:    'US_GAP',
  KR_GAP:    'KR_GAP',
  COIN_LEAD: 'COIN_LEAD',
};

// ─── 기초 계산 ────────────────────────────────────────────────

// 거래대금(KRW 환산) — KR=price×volume / US=price×volume×krwRate / COIN=accTradePrice24h
// 음수/NaN/누락은 0으로 방어. 코인은 이미 KRW 기준 거래대금이므로 환율 미적용.
export function turnoverKRW(item, krwRate = 0) {
  if (!item) return 0;
  if (isCoinItem(item)) {
    const acc = Number(item.accTradePrice24h);
    return Number.isFinite(acc) && acc > 0 ? acc : 0;
  }
  const price = Number(item.price);
  const volume = Number(item.volume);
  if (!Number.isFinite(price) || !Number.isFinite(volume) || price <= 0 || volume <= 0) return 0;
  const raw = price * volume;
  if (item._market === 'US') {
    const rate = Number(krwRate);
    return Number.isFinite(rate) && rate > 0 ? raw * rate : 0;
  }
  return raw; // KR
}

// 회전율 = 거래대금 / 시가총액. 코인(marketCap=0)은 null 반환 → 절대 percentile로 대체.
export function turnoverRatio(item, krwRate = 0) {
  if (!item) return null; // turnoverKRW와 방어 일관성(null 유입 시 isCoinItem의 .id 접근 방지)
  if (isCoinItem(item)) return null;
  const cap = Number(item?.marketCap);
  if (!Number.isFinite(cap) || cap <= 0) return null;
  return turnoverKRW(item, krwRate) / cap;
}

// [W3/STYLE perf 수정] percentileRankSorted — 정렬된 모수 + 이진탐색으로 O(log n).
// 대량 모수(usItems 최대 ~2700, scoreMarketItems가 종목당 2회 percentile 계산) 시
// 기존 O(n²) → O(n log n). 동점 분산 보정(below + 0.5·equal) / n 동일.
// sortedValues는 오름차순 정렬되어 있어야 함.
function lowerBound(arr, target) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function upperBound(arr, target) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function percentileRankSorted(value, sortedValues) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return 50;
  if (sortedValues.length === 1) return 50;
  const below = lowerBound(sortedValues, value);          // value 미만 개수
  const equal = upperBound(sortedValues, value) - below;  // value와 같은 개수
  return ((below + 0.5 * equal) / sortedValues.length) * 100;
}

// 잡주 컷 — 스코어링 전 필터. 통과 시 true.
// 제외: 거래대금 하한 미달 / 파생상품 / 지수 ETF / (무변동 & 회전율 percentile<50)
function passesNoiseGate(item, ctx) {
  if (!item) return false;
  const name = item.name || '';
  // 파생상품 + 미장 워런트/권리/트랜치 잡주 컷 (#355) — usItems 1차 필터와 이중 방어
  if (DERIVATIVE_RE.test(name) || US_NONCOMMON_RE.test(name)) return false;
  // [HIGH3 수정] 지수 ETF(SPY/QQQ/KODEX200 등) 배제. 주도주/테마는 개별주여야 함.
  // index.jsx에서 _isEtf=true로 표시된 항목은 LEAD/GAP/COIN 분기 어디에도 진입 금지.
  if (item._isEtf) return false;

  const market = item._market;
  const rate = Number(ctx.krwRate) || 0;

  // US 하한은 krwRate로 KRW 환산 비교가 기본. 단 환율 미로드(rate<=0)면
  // turnoverKRW가 0을 반환해 KRW 비교가 무력화되므로(죽은 폴백), USD raw(price×volume)를
  // MIN_TURNOVER.US_USD와 직접 비교해 종목을 실제 보존한다.
  if (market === 'US' && rate <= 0) {
    const price = Number(item.price);
    const volume = Number(item.volume);
    const rawUsd = (Number.isFinite(price) && Number.isFinite(volume) && price > 0 && volume > 0)
      ? price * volume : 0;
    if (rawUsd < MIN_TURNOVER.US_USD) return false;
  } else {
    const turn = turnoverKRW(item, ctx.krwRate);
    let minTurn;
    if (market === 'US') minTurn = MIN_TURNOVER.US_USD * rate;
    else if (isCoinItem(item) || market === 'COIN') minTurn = MIN_TURNOVER.COIN;
    else minTurn = MIN_TURNOVER.KR;
    if (turn < minTurn) return false;
  }

  // 무변동 + 회전율 하위 → 거래대금만 큰 비주류 → 제외
  // [W2/STYLE4 수정] 코인은 turnoverRatio가 항상 null → ratioPercentileOf=0 → pct===0(데이터 지연 포함)
  // 코인이 거래대금 무관하게 컷되는 문제. 코인은 turnoverPercentileOf 기준으로 판정.
  const pct = getPct(item);
  if (pct === 0) {
    const isCoin = isCoinItem(item) || market === 'COIN';
    const pctileFn = isCoin ? ctx.turnoverPercentileOf : ctx.ratioPercentileOf;
    const pctile = pctileFn ? pctileFn(item) : 50;
    if (pctile < 50) return false;
  }
  return true;
}

// ─── 스코어링 ────────────────────────────────────────────────

// 뉴스 매칭 건수 + 핫섹터 소속 점수(0~100)
//   S_news = min(newsCount,3)/3·70 + (핫섹터 소속 시 30)
function scoreNews(item, recentNews, hotSectors) {
  let newsCount = 0;
  if (Array.isArray(recentNews) && recentNews.length > 0) {
    const market = item._market === 'COIN' ? 'COIN' : item._market === 'KR' ? 'KR' : 'US';
    const kws = buildStockKeywords(item.symbol, item.name, market);
    for (const n of recentNews) {
      if (newsCount >= 3) break;
      const text = `${n?.title || ''} ${n?.summary || ''}`;
      if (matchesKeywords(text, kws)) newsCount += 1;
    }
  }
  const base = (Math.min(newsCount, 3) / 3) * 70;
  const sector = item.sector || '';
  const inHot = sector && Array.isArray(hotSectors)
    && hotSectors.some((s) => sectorMatches(sector, s));
  return { score: base + (inHot ? 30 : 0), newsCount };
}

// 방향가중 변동폭 점수 — min(|pct|,15)/15·100, 부호는 dir로 분리.
function scoreMove(item) {
  const pct = getPct(item);
  const mag = (Math.min(Math.abs(pct), 15) / 15) * 100;
  return { score: mag, dir: Math.sign(pct), pct };
}

/**
 * scoreLeading — 단일 종목 주도주 점수.
 * @param {object} item   _market 태그된 종목/코인
 * @param {object} ctx    {
 *   krwRate, recentNews, hotSectors,
 *   ratioPercentileOf(item)→0~100,        // 회전율 percentile(주식)
 *   turnoverPercentileOf(item)→0~100,     // 거래대금 절대 percentile(코인 대체)
 *   isClosed,                              // 휴장 마켓 여부 → P_closed
 *   weights                                // SCORE_WEIGHTS.primary | secondary
 * }
 * @returns {object} { score, breakdown:{turn,move,news,surge,penalty}, dir, pct, newsCount, turnover }
 */
export function scoreLeading(item, ctx = {}) {
  const w = ctx.weights || SCORE_WEIGHTS.primary;
  const turnover = turnoverKRW(item, ctx.krwRate);

  // S_turnover — 주식은 회전율 percentile, 코인은 거래대금 절대 percentile로 대체.
  let S_turnover;
  if (isCoinItem(item)) {
    S_turnover = ctx.turnoverPercentileOf ? ctx.turnoverPercentileOf(item) : 50;
  } else {
    S_turnover = ctx.ratioPercentileOf ? ctx.ratioPercentileOf(item) : 50;
  }

  const move = scoreMove(item);
  const news = scoreNews(item, ctx.recentNews, ctx.hotSectors);

  // S_surge(2차) — baseline 부재 시 0. weights.surge=0이면 무영향.
  const S_surge = ctx.surgeScoreOf ? ctx.surgeScoreOf(item) : 0;

  let penalty = 0;
  // 통합경로(scoreMarketItems)에선 passesNoiseGate가 파생상품을 선컷하므로 이 분기는 dead path.
  // scoreLeading 직접 호출(단위 테스트 등) 시 방어용으로 유지.
  if (DERIVATIVE_RE.test(item.name || '')) penalty += PENALTY_DERIV;
  if (ctx.isClosed) penalty += PENALTY_CLOSED;

  const score =
    w.turn * S_turnover +
    w.move * move.score +
    w.news * news.score +
    w.surge * S_surge -
    penalty;

  return {
    score,
    breakdown: { turn: S_turnover, move: move.score, news: news.score, surge: S_surge, penalty },
    dir: move.dir,
    pct: move.pct,
    newsCount: news.newsCount,
    turnover,
  };
}

// 한 마켓의 종목 배열을 스코어링 — 잡주 컷 통과분만 _leadScore 부여해 반환(내림차순).
//   ctx 내부 percentile 함수를 마켓 모수 기준으로 미리 구성한다.
export function scoreMarketItems(items, baseCtx = {}) {
  if (!Array.isArray(items) || items.length === 0) return [];

  // 회전율/거래대금 모수 — percentile 계산용(잡주 컷 전 전체 모수로 계산해야 안정적).
  // [W3/perf 수정] 1회 정렬 후 이진탐색으로 종목당 O(log n) — 대량 모수(usItems ~2700) 대응.
  const ratios = [];
  const turnovers = [];
  for (const it of items) {
    const r = turnoverRatio(it, baseCtx.krwRate);
    if (r != null && Number.isFinite(r)) ratios.push(r);
    const t = turnoverKRW(it, baseCtx.krwRate);
    if (Number.isFinite(t) && t > 0) turnovers.push(t);
  }
  ratios.sort((a, b) => a - b);
  turnovers.sort((a, b) => a - b);
  const ratioPercentileOf = (it) => {
    const r = turnoverRatio(it, baseCtx.krwRate);
    if (r == null || !Number.isFinite(r)) return 0;
    return percentileRankSorted(r, ratios);
  };
  const turnoverPercentileOf = (it) => {
    const t = turnoverKRW(it, baseCtx.krwRate);
    if (!Number.isFinite(t) || t <= 0) return 0;
    return percentileRankSorted(t, turnovers);
  };

  const ctx = { ...baseCtx, ratioPercentileOf, turnoverPercentileOf };

  const scored = [];
  for (const it of items) {
    if (!passesNoiseGate(it, ctx)) continue;
    const res = scoreLeading(it, ctx);
    scored.push({
      ...it,
      _leadScore: res.score,
      _leadBreakdown: res.breakdown,
      _leadDir: res.dir,
      _leadPct: res.pct,
      _leadNewsCount: res.newsCount,
      _leadTurnover: res.turnover,
    });
  }
  scored.sort((a, b) => b._leadScore - a._leadScore);
  return scored;
}

// ─── 테마 클러스터링 ──────────────────────────────────────────

/**
 * clusterThemes — 정적 item.sector로 묶고, 뉴스 핫섹터로 부스트.
 * 무섹터 고득점 종목은 별도 "단일 종목" 그룹으로 graceful degrade.
 *
 * [의도 — W5/STYLE6 명시] 핫섹터는 종목 점수(scoreNews에서 +30, 가중 0.20=실효 +6)와
 * 테마 점수(여기서 ×1.3) 양쪽에 의도적으로 이중 반영한다.
 * 종목 단위에선 "뉴스 관련주" 신호, 테마 단위에선 "전체 테마 무게"를 분리해 강화하기 위함.
 *
 * @param {object[]} scoredItems  scoreMarketItems 결과(_leadScore 보유)
 * @param {object[]} recentNews
 * @param {string[]} [precomputedHotList] computeMorphFocus에서 미리 계산한 핫섹터 — 중복계산 회피용 옵셔널.
 * @returns {object} { themes:[{theme, score, breadth, hot, leaders, members}], soloMovers:[item], hotSectors:[string] }
 */
export function clusterThemes(scoredItems, recentNews = [], precomputedHotList = null) {
  // [W5 수정] precomputedHotList가 주어지면 detectNewsSectors 중복 계산 회피.
  let hotList;
  if (Array.isArray(precomputedHotList)) {
    hotList = precomputedHotList;
  } else {
    const hotSectors = new Set();
    if (Array.isArray(recentNews)) {
      for (const n of recentNews) {
        for (const s of detectNewsSectors(n?.title || '')) hotSectors.add(s);
      }
    }
    hotList = [...hotSectors];
  }
  const isHot = (sector) =>
    !!sector && hotList.some((h) => sectorMatches(sector, h));

  // sector별 그룹화. 무섹터는 solo로.
  const groups = new Map();
  const solo = [];
  for (const it of scoredItems) {
    const sector = it.sector || '';
    if (!sector) { solo.push(it); continue; }
    if (!groups.has(sector)) groups.set(sector, []);
    groups.get(sector).push(it);
  }

  const themes = [];
  for (const [sector, members] of groups.entries()) {
    members.sort((a, b) => b._leadScore - a._leadScore);
    const sum = members.reduce((acc, m) => acc + (m._leadScore || 0), 0);
    const breadth = Math.min(members.length / BREADTH_DENOM, 1);
    const hot = isHot(sector);
    const newsBoost = hot ? HOT_SECTOR_BOOST : 1;
    // 음수 sum(휴장 penalty 등)에 newsBoost(1.3)를 곱하면 핫섹터가 오히려 더 낮아지는 역효과 →
    // 부스트는 양수 점수에만 적용(Math.max).
    const score = Math.max(sum, 0) * breadth * newsBoost;
    themes.push({
      theme: sector,
      score,
      breadth,
      hot,
      leaders: members.slice(0, 3),
      members,
    });
  }
  themes.sort((a, b) => b.score - a.score);

  return { themes, soloMovers: solo, hotSectors: hotList };
}

// ─── 모핑 모드 결정 ───────────────────────────────────────────

/**
 * decideMorphMode — marketHours phase 기반 5모드.
 *   KR open → KR_LEAD / US open → US_LEAD
 *   KR preAuction·preNxt·afterNxt → KR_GAP (한국 활동시간 우선)
 *   US pre·after·dayMarket → US_GAP (한국 야간)
 *   그 외(둘 다 closed) → COIN_LEAD
 *
 * [B1/HIGH2 수정] 우선순위: LEAD > KR_GAP > US_GAP > COIN.
 *   marketHours.js상 평일 ET는 pre→open→after→dayMarket로 24h 빈틈없이 커버 →
 *   평일에는 usPhase가 'closed'가 될 수 없음. KR_GAP을 US_GAP 뒤에 두면
 *   평일 afterNxt/preNxt/preAuction이 도달불가(미국 휴장일에만 진입).
 *   "한국 활동시간엔 국장(LEAD/GAP), 한국 야간엔 미장" 의도를 관철하기 위해
 *   KR_GAP을 US_GAP보다 먼저 평가한다 (LEAD가 KR 우선인 것과 일관).
 */
export function decideMorphMode(krStatus, usStatus) {
  const krPhase = krStatus?.phase;
  const usPhase = usStatus?.phase;

  if (krPhase === 'open') return MORPH_MODE.KR_LEAD;
  if (usPhase === 'open') return MORPH_MODE.US_LEAD;
  // KR 활동시간(시간외/프리/동시호가) — 한국 사용자 기준 KR_GAP 우선
  if (krPhase === 'preAuction' || krPhase === 'preNxt' || krPhase === 'afterNxt') return MORPH_MODE.KR_GAP;
  // 한국 야간(KR closed) — US 시간외/프리/데이마켓
  if (usPhase === 'pre' || usPhase === 'after' || usPhase === 'dayMarket') return MORPH_MODE.US_GAP;
  return MORPH_MODE.COIN_LEAD;
}

// ─── 전이구간 브릿지 ──────────────────────────────────────────

// 지수 배열에서 id로 changePct 추출(없으면 null).
function indexChangePct(indices, id) {
  if (!Array.isArray(indices)) return null;
  const found = indices.find((i) => i.id === id);
  const v = Number(found?.changePct);
  return Number.isFinite(v) ? v : null;
}

// cross-market 섹터 페어(역인덱싱) — relatedAssets.js NVDA↔삼성/하이닉스 패턴의 소형 테이블.
//   미장 섹터 → 국장 동조 섹터/대표주 함의. 1차는 반도체 중심 최소 셋(2차에 확장).
// krSector는 krStockList.js 표준 어휘(예 '2차전지') — UI 라벨/findStocksBySectors 정합.
const CROSS_MARKET_SECTOR_PAIRS = {
  반도체:   { krSector: '반도체', krLeaders: ['삼성전자', 'SK하이닉스'] },
  AI:       { krSector: '반도체', krLeaders: ['삼성전자', 'SK하이닉스'] },
  전기차:   { krSector: '2차전지', krLeaders: ['LG에너지솔루션', '삼성SDI'] },
  배터리:   { krSector: '2차전지', krLeaders: ['LG에너지솔루션', '삼성SDI'] },
  '2차전지': { krSector: '2차전지', krLeaders: ['LG에너지솔루션', '삼성SDI'] },
  바이오:   { krSector: '바이오', krLeaders: ['삼성바이오로직스', '셀트리온'] },
};

/**
 * buildTransitionBridge — 전이구간(국장 모드) 직전 미장 함의 한 줄.
 * 단정 회피 가드(필수):
 *   - |NASDAQ changePct| < 0.5% → "보합" 표기 또는 생략.
 *   - "확정" 금지 → "주목"(상관≠인과).
 *   - 페어 없으면 지수 한 줄만.
 * KR 모드(KR_LEAD/KR_GAP)에서만 의미. 그 외 모드는 null.
 * @param {object} p { mode, indices, primaryTheme }
 * @returns {object|null} { line, nasdaqPct, tone, pair } | null
 */
export function buildTransitionBridge({ mode, indices, primaryTheme } = {}) {
  if (mode !== MORPH_MODE.KR_LEAD && mode !== MORPH_MODE.KR_GAP) return null;

  const nasdaqPct = indexChangePct(indices, 'NDX');
  if (nasdaqPct == null) return null; // 지수 데이터 없음 → 브릿지 생략

  const abs = Math.abs(nasdaqPct);
  const sign = nasdaqPct > 0 ? '+' : nasdaqPct < 0 ? '' : '';
  const pctText = `${sign}${nasdaqPct.toFixed(1)}%`;

  // 보합/약변동(<0.5%) → 단정 회피. 지수 한 줄만(테마 함의 생략).
  // [W6 수정] 'NDX'는 NASDAQ-100(^NDX). Composite(^IXIC)와 등락이 갈리는 날 멘트 어긋남 방지 → '나스닥100'.
  if (abs < 0.5) {
    return {
      line: `간밤 나스닥100 보합(${pctText}) — 방향성 제한적`,
      nasdaqPct,
      tone: 'flat',
      pair: null,
    };
  }

  // 테마 페어 매칭 — 있으면 국장 동조 함의, 없으면 지수 한 줄만.
  // 페어 키 조회 — 직접 매칭 우선, 없으면 섹터 별칭 정규화 경유(예 '2차전지' ↔ '배터리'/'전기차').
  const themeName = primaryTheme?.theme || '';
  const pair = themeName
    ? (CROSS_MARKET_SECTOR_PAIRS[themeName]
       || Object.entries(CROSS_MARKET_SECTOR_PAIRS)
            .find(([k]) => sectorMatches(themeName, k))?.[1])
    : null;

  const dirWord = nasdaqPct > 0 ? '강세' : '약세';
  if (pair) {
    // "주목" 사용(상관≠인과). "확정" 금지.
    const leadersText = pair.krLeaders.slice(0, 2).join('·');
    return {
      line: `간밤 나스닥100 ${pctText} ${dirWord} — 오늘 ${pair.krSector}(${leadersText}) 주목`,
      nasdaqPct,
      tone: nasdaqPct > 0 ? 'up' : 'down',
      pair,
    };
  }

  // 페어 없음 → 지수 한 줄만(테마 단정 회피).
  return {
    line: `간밤 나스닥100 ${pctText} ${dirWord} — 오늘 국장 영향 주목`,
    nasdaqPct,
    tone: nasdaqPct > 0 ? 'up' : 'down',
    pair: null,
  };
}

// ─── 진입점: computeMorphFocus ────────────────────────────────

// 단일 종목 → solo card용 경량 표현(무섹터 graceful degrade).
function toSoloMover(item) {
  return {
    symbol: item.symbol,
    name: item.name,
    market: item._market,
    pct: item._leadPct,
    dir: item._leadDir,
    newsCount: item._leadNewsCount,
    turnover: item._leadTurnover,
    score: item._leadScore,
    item,
  };
}

/**
 * computeMorphFocus — 모핑 포커스 진입점. 모드 분기 후 주도 테마/무버/브릿지 조합.
 * @param {object} p {
 *   krItems, usItems, coinItems,   // _market 태그된 배열
 *   recentNews, krwRate, indices,
 *   krStatus, usStatus,            // getKoreanMarketStatus()/getUsMarketStatus() 결과(.phase 사용)
 *   krwRateLoaded = true,          // false면 fx 의존 컷(US turnover 하한)
 *   baselineMap = null,            // 2차: {symbol: {avg20d}} → w_surge 활성
 *   weights = SCORE_WEIGHTS.primary
 * }
 * @returns {object} {
 *   mode,                                      // MORPH_MODE
 *   primaryTheme: {theme,score,leaders,members,hot}|null,
 *   altThemes: [...],                          // 동반 테마(primary 제외 상위)
 *   movers: [soloMover],                       // 갭/무섹터 단일 종목 카드용
 *   bridge: {line,nasdaqPct,tone,pair}|null,
 *   _scored: {...}                             // 디버그/UI 보조(마켓별 스코어 결과)
 * }
 */
export function computeMorphFocus(params = {}) {
  const {
    krItems = [],
    usItems = [],
    coinItems = [],
    recentNews = [],
    krwRate = 0,
    indices = [],
    krStatus = null,
    usStatus = null,
    krwRateLoaded = true,
    baselineMap = null,
    weights: weightsOverride = null,
  } = params;

  // [W4 수정] baselineMap이 주어지면 surge 가중을 활성화한 SECONDARY로 자동 전환.
  // 명시 override가 있으면 그것 우선. 기존엔 primary 고정이라 surgeScoreOf 결과가 0으로 사장됐음.
  const weights = weightsOverride
    || (baselineMap ? SCORE_WEIGHTS.secondary : SCORE_WEIGHTS.primary);

  const mode = decideMorphMode(krStatus, usStatus);

  // 휴장 여부 — P_closed 부여용.
  const krClosed = krStatus?.phase === 'closed';
  const usClosed = usStatus?.phase === 'closed';

  // 핫섹터(뉴스) — scoreNews와 clusterThemes에 공유(중복 계산 방지: precomputedHotList).
  const hotSectors = new Set();
  for (const n of (recentNews || [])) {
    for (const s of detectNewsSectors(n.title || '')) hotSectors.add(s);
  }
  const hotList = [...hotSectors];

  // [STYLE5 수정] krwRateLoaded=false면 환율 0으로 캡처(baseCtxFor와 일관).
  // 환율 미로드 구간에서 US turnover 분모를 부정확하게 산정하는 문제 방지.
  const effectiveKrwRate = krwRateLoaded ? krwRate : 0;

  // baseline → w_surge용 surgeScoreOf. 부재 시 null(점수 0).
  const surgeScoreOf = baselineMap
    ? (item) => {
        const base = baselineMap[item.symbol]?.avg20d;
        const turn = turnoverKRW(item, effectiveKrwRate);
        if (!base || base <= 0 || turn <= 0) return 0;
        const ratio = turn / base;
        if (ratio <= 1) return 0;
        return Math.min(Math.log2(ratio) * 40, 100); // 2배→40, 4배→80
      }
    : null;

  const baseCtxFor = (market, isClosed) => ({
    krwRate: effectiveKrwRate,
    recentNews,
    hotSectors: hotList,
    isClosed,
    weights,
    surgeScoreOf,
    _market: market,
  });

  const scoredKr = scoreMarketItems(krItems, baseCtxFor('KR', krClosed));
  const scoredUs = scoreMarketItems(usItems, baseCtxFor('US', usClosed));
  const scoredCoin = scoreMarketItems(coinItems, baseCtxFor('COIN', false));

  const result = {
    mode,
    primaryTheme: null,
    altThemes: [],
    movers: [],
    bridge: null,
    _scored: { kr: scoredKr, us: scoredUs, coin: scoredCoin },
  };

  // ── 모드별 분기 ──
  if (mode === MORPH_MODE.KR_LEAD || mode === MORPH_MODE.US_LEAD) {
    // LEAD: 주도 테마 + 대장주 + 동반 테마.
    const scored = mode === MORPH_MODE.KR_LEAD ? scoredKr : scoredUs;
    const { themes, soloMovers } = clusterThemes(scored, recentNews, hotList);
    result.primaryTheme = themes[0] || null;
    result.altThemes = themes.slice(1, 4);
    // 무섹터 고득점 종목 → 단일카드 폴백(상위 5). 단 primaryTheme이 있으면 UI는 테마 카드만
    // 렌더하고 soloMovers는 미표시(테마 중심 의도) — 무섹터 종목 폴백은 primaryTheme 부재 시에만 노출.
    result.movers = soloMovers.slice(0, 5).map(toSoloMover);
  } else if (mode === MORPH_MODE.US_GAP || mode === MORPH_MODE.KR_GAP) {
    // GAP: 시간외 실시간 체결가 없음 → 변동폭(전일종가 갭) 우선, 테마 약화.
    //   move 우선 정렬로 재배치(거래대금보다 갭 폭 + 뉴스).
    const scored = mode === MORPH_MODE.US_GAP ? scoredUs : scoredKr;
    const gapSorted = [...scored].sort((a, b) => {
      const am = Math.abs(a._leadPct || 0);
      const bm = Math.abs(b._leadPct || 0);
      if (bm !== am) return bm - am;
      return (b._leadNewsCount || 0) - (a._leadNewsCount || 0);
    });
    result.movers = gapSorted.slice(0, 6).map(toSoloMover);
    // 갭 모드에서도 테마가 뚜렷하면 보조 표시(약화).
    const { themes } = clusterThemes(scored, recentNews, hotList);
    result.primaryTheme = themes[0] || null;
    result.altThemes = themes.slice(1, 3);
  } else {
    // COIN_LEAD: 거래대금(accTradePrice24h) + move.
    // [STYLE6] 코인은 대부분 무섹터(sector 없음) → clusterThemes 결과의 themes/leaders가
    // 사실상 비어 있고, UI(MorphingFocusSection.jsx isCoin 분기)는 movers만 소비함.
    // 의도적으로 clusterThemes를 생략하고 거래대금 상위 코인을 그대로 movers로 사용.
    result.movers = scoredCoin.slice(0, 6).map(toSoloMover);
  }

  // ── 전이 브릿지(국장 모드만) ──
  result.bridge = buildTransitionBridge({
    mode,
    indices,
    primaryTheme: result.primaryTheme,
  });

  return result;
}
