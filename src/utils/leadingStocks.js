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

import { DERIVATIVE_RE, getPct, isCoinItem } from '../components/home/utils';
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
const SECTOR_ALIASES = {
  // KR item.sector 어휘
  '2차전지': 'battery',
  '자동차': 'auto',
  // US item.sector 어휘
  '전기차': 'battery',
  '소프트웨어': 'software',
  'AI/소프트웨어': 'software',
  'IT소프트웨어': 'software',
  '핀테크': 'fintech',
  '미디어': 'media',
  '리츠': 'reit',
  '산업': 'industrial',
  // detectNewsSectors(newsTopicMap) 어휘
  '배터리': 'battery',
  '자동차부품': 'auto',
  'AI': 'software',
};

// 섹터명 → 캐노니컬 키(별칭 없으면 원문 유지). isHot/CROSS_MARKET 비교 정규화용.
function canonicalSector(sector) {
  if (!sector) return '';
  return SECTOR_ALIASES[sector] || sector;
}

// 두 섹터가 같은 테마인지 — 캐노니컬 일치 또는 (원문) 양방향 substring.
function sectorMatches(a, b) {
  if (!a || !b) return false;
  if (canonicalSector(a) === canonicalSector(b)) return true;
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

// percentile rank(0~100) — value가 values 중 몇 %ile인지. values 비거나 단일값이면 50 중립.
function percentileRank(value, values) {
  if (!Array.isArray(values) || values.length === 0) return 50;
  if (values.length === 1) return 50;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  // 중앙값 보정(동점 분산) — (below + 0.5·equal) / n
  return ((below + 0.5 * equal) / values.length) * 100;
}

// 잡주 컷 — 스코어링 전 필터. 통과 시 true.
// 제외: 거래대금 하한 미달 / 파생상품 / (무변동 & 회전율 percentile<50)
function passesNoiseGate(item, ctx) {
  if (!item) return false;
  const name = item.name || '';
  if (DERIVATIVE_RE.test(name)) return false;

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
  const pct = getPct(item);
  if (pct === 0) {
    const ratioPct = ctx.ratioPercentileOf ? ctx.ratioPercentileOf(item) : 50;
    if (ratioPct < 50) return false;
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
      const text = `${n.title || ''} ${n.summary || ''}`;
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
  const ratios = [];
  const turnovers = [];
  for (const it of items) {
    const r = turnoverRatio(it, baseCtx.krwRate);
    if (r != null && Number.isFinite(r)) ratios.push(r);
    const t = turnoverKRW(it, baseCtx.krwRate);
    if (Number.isFinite(t) && t > 0) turnovers.push(t);
  }
  const ratioPercentileOf = (it) => {
    const r = turnoverRatio(it, baseCtx.krwRate);
    if (r == null || !Number.isFinite(r)) return 0;
    return percentileRank(r, ratios);
  };
  const turnoverPercentileOf = (it) => {
    const t = turnoverKRW(it, baseCtx.krwRate);
    if (!Number.isFinite(t) || t <= 0) return 0;
    return percentileRank(t, turnovers);
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
 * @param {object[]} scoredItems  scoreMarketItems 결과(_leadScore 보유)
 * @param {object[]} recentNews
 * @returns {object} { themes:[{theme, score, breadth, hot, leaders, members}], soloMovers:[item], hotSectors:[string] }
 */
export function clusterThemes(scoredItems, recentNews = []) {
  const hotSectors = new Set();
  if (Array.isArray(recentNews)) {
    for (const n of recentNews) {
      for (const s of detectNewsSectors(n.title || '')) hotSectors.add(s);
    }
  }
  const hotList = [...hotSectors];
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
 *   US pre·after·dayMarket → US_GAP / KR preAuction·preNxt → KR_GAP
 *   둘 다 closed → COIN_LEAD
 * 우선순위: 정규장(LEAD) > 갭(GAP) > 코인. KR LEAD를 US LEAD보다 우선(국내 사용자 기준).
 */
export function decideMorphMode(krStatus, usStatus) {
  const krPhase = krStatus?.phase;
  const usPhase = usStatus?.phase;

  if (krPhase === 'open') return MORPH_MODE.KR_LEAD;
  if (usPhase === 'open') return MORPH_MODE.US_LEAD;
  if (usPhase === 'pre' || usPhase === 'after' || usPhase === 'dayMarket') return MORPH_MODE.US_GAP;
  // afterNxt(정규장 마감 후 NXT 시간외, marketHours.js:255)도 국장 연장거래 → KR_GAP.
  // 미장 after를 US_GAP으로 잡는 것과 대칭(afterNxt 누락 시 COIN_LEAD로 오폴백).
  if (krPhase === 'preAuction' || krPhase === 'preNxt' || krPhase === 'afterNxt') return MORPH_MODE.KR_GAP;
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
  if (abs < 0.5) {
    return {
      line: `간밤 나스닥 보합(${pctText}) — 방향성 제한적`,
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
      line: `간밤 나스닥 ${pctText} ${dirWord} — 오늘 ${pair.krSector}(${leadersText}) 주목`,
      nasdaqPct,
      tone: nasdaqPct > 0 ? 'up' : 'down',
      pair,
    };
  }

  // 페어 없음 → 지수 한 줄만(테마 단정 회피).
  return {
    line: `간밤 나스닥 ${pctText} ${dirWord} — 오늘 국장 영향 주목`,
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
    weights = SCORE_WEIGHTS.primary,
  } = params;

  const mode = decideMorphMode(krStatus, usStatus);

  // 휴장 여부 — P_closed 부여용.
  const krClosed = krStatus?.phase === 'closed';
  const usClosed = usStatus?.phase === 'closed';

  // 핫섹터(뉴스) — scoreNews와 clusterThemes에 공유.
  const hotSectors = new Set();
  for (const n of (recentNews || [])) {
    for (const s of detectNewsSectors(n.title || '')) hotSectors.add(s);
  }
  const hotList = [...hotSectors];

  // baseline → w_surge용 surgeScoreOf. 부재 시 null(점수 0).
  const surgeScoreOf = baselineMap
    ? (item) => {
        const base = baselineMap[item.symbol]?.avg20d;
        const turn = turnoverKRW(item, krwRate);
        if (!base || base <= 0 || turn <= 0) return 0;
        const ratio = turn / base;
        if (ratio <= 1) return 0;
        return Math.min(Math.log2(ratio) * 40, 100); // 2배→40, 4배→80
      }
    : null;

  const baseCtxFor = (market, isClosed) => ({
    krwRate: krwRateLoaded ? krwRate : 0,
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
    const { themes, soloMovers } = clusterThemes(scored, recentNews);
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
    const { themes } = clusterThemes(scored, recentNews);
    result.primaryTheme = themes[0] || null;
    result.altThemes = themes.slice(1, 3);
  } else {
    // COIN_LEAD: 거래대금(accTradePrice24h) + move. 코인 테마(암호화폐 단일).
    const { themes, soloMovers } = clusterThemes(scoredCoin, recentNews);
    result.primaryTheme = themes[0] || null;
    result.altThemes = themes.slice(1, 3);
    // 코인은 대부분 무섹터 → 거래대금 상위가 곧 주도 코인.
    result.movers = (soloMovers.length ? soloMovers : scoredCoin).slice(0, 6).map(toSoloMover);
  }

  // ── 전이 브릿지(국장 모드만) ──
  result.bridge = buildTransitionBridge({
    mode,
    indices,
    primaryTheme: result.primaryTheme,
  });

  return result;
}
