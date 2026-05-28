import { describe, it, expect } from 'vitest';
import {
  turnoverKRW,
  turnoverRatio,
  scoreLeading,
  scoreMarketItems,
  clusterThemes,
  decideMorphMode,
  buildTransitionBridge,
  computeMorphFocus,
  MORPH_MODE,
  MIN_TURNOVER,
  SCORE_WEIGHTS,
} from '../utils/leadingStocks.js';

// ─── 헬퍼: 종목/코인 팩토리 ───────────────────────────────────
const krStock = (o = {}) => ({
  _market: 'KR', market: 'kr',
  symbol: o.symbol || '000000', name: o.name || '테스트',
  price: o.price ?? 10000, volume: o.volume ?? 1_000_000,
  changePct: o.changePct ?? 0, marketCap: o.marketCap ?? 1_000_000_000_000,
  sector: o.sector,
});
const usStock = (o = {}) => ({
  _market: 'US', market: 'us',
  symbol: o.symbol || 'TST', name: o.name || 'Test',
  price: o.price ?? 100, volume: o.volume ?? 1_000_000,
  changePct: o.changePct ?? 0, marketCap: o.marketCap ?? 100_000_000_000,
  sector: o.sector,
});
const coin = (o = {}) => ({
  _market: 'COIN', market: 'coin', id: (o.symbol || 'btc').toLowerCase(),
  symbol: o.symbol || 'BTC', name: o.name || '비트코인',
  priceKrw: o.priceKrw ?? 50_000_000, change24h: o.change24h ?? 0,
  marketCap: 0, volume24h: 0,
  accTradePrice24h: o.accTradePrice24h ?? 0,
});

const KRW = 1400; // 환율

// ─── turnoverKRW ──────────────────────────────────────────────
describe('turnoverKRW', () => {
  it('KR = price × volume', () => {
    expect(turnoverKRW(krStock({ price: 10000, volume: 5000 }))).toBe(50_000_000);
  });
  it('US = price × volume × krwRate', () => {
    expect(turnoverKRW(usStock({ price: 100, volume: 1000 }), KRW)).toBe(100 * 1000 * KRW);
  });
  it('COIN = accTradePrice24h (환율 무관)', () => {
    expect(turnoverKRW(coin({ accTradePrice24h: 1.5e10 }), KRW)).toBe(1.5e10);
  });
  it('음수/누락 가격·거래량 → 0 방어', () => {
    expect(turnoverKRW(krStock({ price: -1, volume: 1000 }))).toBe(0);
    expect(turnoverKRW(krStock({ price: 100, volume: 0 }))).toBe(0);
    expect(turnoverKRW(null)).toBe(0);
  });
  it('US 환율 미로드(0) → 0', () => {
    expect(turnoverKRW(usStock({ price: 100, volume: 1000 }), 0)).toBe(0);
  });
});

// ─── turnoverRatio ────────────────────────────────────────────
describe('turnoverRatio', () => {
  it('주식 = 거래대금 / 시총', () => {
    const s = krStock({ price: 10000, volume: 1_000_000, marketCap: 1e12 });
    expect(turnoverRatio(s)).toBeCloseTo(1e10 / 1e12, 6);
  });
  it('코인(marketCap=0) → null', () => {
    expect(turnoverRatio(coin({ accTradePrice24h: 1e10 }))).toBeNull();
  });
  it('시총 0/누락 → null', () => {
    expect(turnoverRatio(krStock({ marketCap: 0 }))).toBeNull();
  });
});

// ─── 회전율 핵심: 중소형 고회전 > 대형 저회전 ──────────────────
describe('회전율 기반 주도주 포착', () => {
  it('삼성전자(대형 저회전)보다 중소형 고회전주가 상위', () => {
    const samsung = krStock({
      symbol: '005930', name: '삼성전자',
      price: 80000, volume: 10_000_000, // 거래대금 8000억 (절대값은 큼)
      marketCap: 500e12,                // 시총 500조 → 회전율 0.0016
      changePct: 1,
    });
    const midCap = krStock({
      symbol: '900000', name: '중소형테마주',
      price: 20000, volume: 5_000_000,  // 거래대금 1000억
      marketCap: 500e9,                 // 시총 5000억 → 회전율 0.2 (삼성의 ~125배)
      changePct: 5,
    });
    const scored = scoreMarketItems([samsung, midCap], {
      krwRate: KRW, recentNews: [], hotSectors: [], weights: SCORE_WEIGHTS.primary,
    });
    expect(scored[0].symbol).toBe('900000');
    expect(scored[0]._leadScore).toBeGreaterThan(scored[1]._leadScore);
  });
});

// ─── MIN_TURNOVER 잡주 컷 ─────────────────────────────────────
describe('MIN_TURNOVER 잡주 컷', () => {
  it('KR 50억 미달 잡주 제외', () => {
    const junk = krStock({ symbol: 'JUNK', price: 1000, volume: 1000, changePct: 20 }); // 거래대금 100만
    const valid = krStock({ symbol: 'VALID', price: 10000, volume: 1_000_000, changePct: 5 }); // 100억
    const scored = scoreMarketItems([junk, valid], { krwRate: KRW, recentNews: [] });
    expect(scored.find((s) => s.symbol === 'JUNK')).toBeUndefined();
    expect(scored.find((s) => s.symbol === 'VALID')).toBeDefined();
  });
  it('파생상품(레버리지/인버스) 제외', () => {
    const lev = krStock({ symbol: 'LEV', name: 'KODEX 레버리지', price: 20000, volume: 2_000_000, changePct: 8 });
    const inv = krStock({ symbol: 'INV', name: 'KODEX 인버스2X', price: 5000, volume: 10_000_000, changePct: 8 });
    const normal = krStock({ symbol: 'NORM', name: '정상주', price: 10000, volume: 1_000_000, changePct: 5 });
    const scored = scoreMarketItems([lev, inv, normal], { krwRate: KRW, recentNews: [] });
    expect(scored.find((s) => s.symbol === 'LEV')).toBeUndefined();
    expect(scored.find((s) => s.symbol === 'INV')).toBeUndefined();
    expect(scored.find((s) => s.symbol === 'NORM')).toBeDefined();
  });
  it('COIN 100억 미달 제외 / 충족 통과', () => {
    const small = coin({ symbol: 'SMALL', accTradePrice24h: 5e9, change24h: 10 }); // 50억
    const big = coin({ symbol: 'BTC', accTradePrice24h: 5e11, change24h: 5 });     // 5000억
    const scored = scoreMarketItems([small, big], { krwRate: KRW, recentNews: [] });
    expect(scored.find((s) => s.symbol === 'SMALL')).toBeUndefined();
    expect(scored.find((s) => s.symbol === 'BTC')).toBeDefined();
  });
});

// ─── scoreLeading 분해 ────────────────────────────────────────
describe('scoreLeading', () => {
  it('변동폭 클수록 move 점수 상승(상한 15%)', () => {
    const ctx = { krwRate: KRW, ratioPercentileOf: () => 50, weights: SCORE_WEIGHTS.primary };
    const small = scoreLeading(krStock({ changePct: 2 }), ctx);
    const big = scoreLeading(krStock({ changePct: 12 }), ctx);
    const over = scoreLeading(krStock({ changePct: 30 }), ctx);
    expect(big.breakdown.move).toBeGreaterThan(small.breakdown.move);
    expect(over.breakdown.move).toBe(100); // 15% 상한
  });
  it('하락 방향 dir = -1', () => {
    const ctx = { krwRate: KRW, ratioPercentileOf: () => 50 };
    expect(scoreLeading(krStock({ changePct: -7 }), ctx).dir).toBe(-1);
  });
  it('휴장 마켓 penalty(P_closed) 적용', () => {
    const ctx = { krwRate: KRW, ratioPercentileOf: () => 50 };
    const open = scoreLeading(krStock({ changePct: 5 }), { ...ctx, isClosed: false });
    const closed = scoreLeading(krStock({ changePct: 5 }), { ...ctx, isClosed: true });
    expect(closed.breakdown.penalty).toBe(40);
    expect(closed.score).toBeLessThan(open.score);
  });
  it('뉴스 매칭 + 핫섹터 소속 시 news 점수 가산', () => {
    const item = krStock({ symbol: '005930', name: '삼성전자', sector: '반도체', changePct: 3 });
    const news = [{ title: '삼성전자 HBM 신규 수주', summary: '' }];
    const res = scoreLeading(item, {
      krwRate: KRW, ratioPercentileOf: () => 50,
      recentNews: news, hotSectors: ['반도체'],
    });
    // 뉴스 1건(70/3≈23.3) + 핫섹터(30) = 53.3
    expect(res.breakdown.news).toBeGreaterThan(50);
    expect(res.newsCount).toBe(1);
  });
});

// ─── clusterThemes ────────────────────────────────────────────
describe('clusterThemes', () => {
  const scored = [
    { symbol: 'A', name: 'A', sector: '반도체', _leadScore: 80 },
    { symbol: 'B', name: 'B', sector: '반도체', _leadScore: 60 },
    { symbol: 'C', name: 'C', sector: '바이오', _leadScore: 50 },
    { symbol: 'D', name: 'D', sector: undefined, _leadScore: 70 }, // 무섹터
  ];

  it('정적 sector로 테마 묶기 + 대장주 상위 1~3', () => {
    const { themes } = clusterThemes(scored, []);
    const semi = themes.find((t) => t.theme === '반도체');
    expect(semi.members.length).toBe(2);
    expect(semi.leaders[0].symbol).toBe('A');
    expect(semi.leaders.length).toBeLessThanOrEqual(3);
  });

  it('무섹터 종목은 soloMovers(단일카드 폴백)로 분리', () => {
    const { themes, soloMovers } = clusterThemes(scored, []);
    expect(soloMovers.map((s) => s.symbol)).toContain('D');
    expect(themes.every((t) => t.theme)).toBe(true); // 무섹터가 테마로 새지 않음
  });

  it('핫섹터(뉴스) newsBoost 1.3배 반영', () => {
    const hotNews = [{ title: 'HBM 반도체 슈퍼사이클' }]; // detectNewsSectors → 반도체
    const cold = clusterThemes(scored, []);
    const hot = clusterThemes(scored, hotNews);
    const coldSemi = cold.themes.find((t) => t.theme === '반도체');
    const hotSemi = hot.themes.find((t) => t.theme === '반도체');
    expect(hotSemi.hot).toBe(true);
    expect(coldSemi.hot).toBe(false);
    expect(hotSemi.score).toBeGreaterThan(coldSemi.score);
  });

  it('섹터 별칭: item.sector "2차전지" ↔ 뉴스 "배터리"/"전기차" 핫섹터 매칭', () => {
    // item.sector(krStockList 표준)는 '2차전지', detectNewsSectors는 '배터리'/'전기차' → 별칭 정규화로 매칭.
    const batteryScored = [
      { symbol: '373220', name: 'LG에너지솔루션', sector: '2차전지', _leadScore: 80 },
      { symbol: '006400', name: '삼성SDI', sector: '2차전지', _leadScore: 60 },
    ];
    const batteryNews = [{ title: '전기차 배터리 수요 급증 양극재 강세' }]; // → 배터리/전기차/자동차부품
    const cold = clusterThemes(batteryScored, []);
    const hot = clusterThemes(batteryScored, batteryNews);
    const coldBat = cold.themes.find((t) => t.theme === '2차전지');
    const hotBat = hot.themes.find((t) => t.theme === '2차전지');
    expect(coldBat.hot).toBe(false);
    expect(hotBat.hot).toBe(true); // 별칭 정규화 전이면 false였음(버그)
    expect(hotBat.score).toBeGreaterThan(coldBat.score);
  });

  it('음수 _leadScore 테마는 핫섹터 부스트로 더 낮아지지 않음(Math.max 가드)', () => {
    // 휴장 penalty 등으로 sum이 음수면 newsBoost(1.3)가 점수를 더 낮추던 역효과 방지.
    const negScored = [{ symbol: 'X', name: 'X', sector: '반도체', _leadScore: -20 }];
    const hotNews = [{ title: 'HBM 반도체 슈퍼사이클' }];
    const hot = clusterThemes(negScored, hotNews).themes.find((t) => t.theme === '반도체');
    expect(hot.hot).toBe(true);
    expect(hot.score).toBe(0); // Math.max(-20,0)=0 → 부스트가 음수를 더 키우지 않음
  });
});

// ─── decideMorphMode 5종 ──────────────────────────────────────
describe('decideMorphMode', () => {
  const st = (phase) => ({ phase });
  it('KR open → KR_LEAD', () => {
    expect(decideMorphMode(st('open'), st('closed'))).toBe(MORPH_MODE.KR_LEAD);
  });
  it('US open(국장 휴장) → US_LEAD', () => {
    expect(decideMorphMode(st('closed'), st('open'))).toBe(MORPH_MODE.US_LEAD);
  });
  it('US pre/after/dayMarket → US_GAP', () => {
    expect(decideMorphMode(st('closed'), st('pre'))).toBe(MORPH_MODE.US_GAP);
    expect(decideMorphMode(st('closed'), st('after'))).toBe(MORPH_MODE.US_GAP);
    expect(decideMorphMode(st('closed'), st('dayMarket'))).toBe(MORPH_MODE.US_GAP);
  });
  it('KR preAuction/preNxt(미장 휴장) → KR_GAP', () => {
    expect(decideMorphMode(st('preAuction'), st('closed'))).toBe(MORPH_MODE.KR_GAP);
    expect(decideMorphMode(st('preNxt'), st('closed'))).toBe(MORPH_MODE.KR_GAP);
  });
  it('KR afterNxt(NXT 시간외, 미장 휴장) → KR_GAP (미장 after와 대칭)', () => {
    expect(decideMorphMode(st('afterNxt'), st('closed'))).toBe(MORPH_MODE.KR_GAP);
  });
  it('둘 다 closed → COIN_LEAD', () => {
    expect(decideMorphMode(st('closed'), st('closed'))).toBe(MORPH_MODE.COIN_LEAD);
  });
  it('KR open 우선(KR open + US open) → KR_LEAD', () => {
    expect(decideMorphMode(st('open'), st('open'))).toBe(MORPH_MODE.KR_LEAD);
  });
});

// ─── buildTransitionBridge 단정 회피 ──────────────────────────
describe('buildTransitionBridge', () => {
  const idx = (ndxPct) => [{ id: 'NDX', name: '나스닥', changePct: ndxPct }];

  it('미장 모드(US_LEAD)는 브릿지 없음(null)', () => {
    expect(buildTransitionBridge({ mode: MORPH_MODE.US_LEAD, indices: idx(2) })).toBeNull();
  });
  it('나스닥 |변동|<0.5% → 보합 표기(단정 회피)', () => {
    const b = buildTransitionBridge({ mode: MORPH_MODE.KR_LEAD, indices: idx(0.3) });
    expect(b.tone).toBe('flat');
    expect(b.line).toContain('보합');
    expect(b.pair).toBeNull();
  });
  it('지수 데이터 없으면 브릿지 생략(null)', () => {
    expect(buildTransitionBridge({ mode: MORPH_MODE.KR_LEAD, indices: [] })).toBeNull();
  });
  it('테마 페어 있으면 국장 동조 함의 + "주목"(확정 금지)', () => {
    const b = buildTransitionBridge({
      mode: MORPH_MODE.KR_LEAD, indices: idx(1.8),
      primaryTheme: { theme: '반도체' },
    });
    expect(b.line).toContain('주목');
    expect(b.line).not.toContain('확정');
    expect(b.pair).not.toBeNull();
    expect(b.pair.krSector).toBe('반도체');
  });
  it('2차전지 주도 시 CROSS_MARKET 페어 매칭(별칭 키 추가)', () => {
    const b = buildTransitionBridge({
      mode: MORPH_MODE.KR_LEAD, indices: idx(2.1),
      primaryTheme: { theme: '2차전지' },
    });
    expect(b.pair).not.toBeNull();
    expect(b.pair.krSector).toBe('2차전지');
    expect(b.line).toContain('2차전지');
  });
  it('페어 없으면 지수 한 줄만(테마 단정 회피)', () => {
    const b = buildTransitionBridge({
      mode: MORPH_MODE.KR_GAP, indices: idx(-1.5),
      primaryTheme: { theme: '듣보섹터' },
    });
    expect(b.pair).toBeNull();
    expect(b.tone).toBe('down');
    expect(b.line).toContain('국장 영향');
  });
});

// ─── computeMorphFocus 통합 ───────────────────────────────────
describe('computeMorphFocus', () => {
  const st = (phase) => ({ phase });

  it('KR_LEAD: 주도 테마 + 대장주 + 브릿지 동시 반환', () => {
    const krItems = [
      krStock({ symbol: '005930', name: '삼성전자', sector: '반도체', price: 80000, volume: 5_000_000, marketCap: 500e12, changePct: 3 }),
      krStock({ symbol: '000660', name: 'SK하이닉스', sector: '반도체', price: 200000, volume: 3_000_000, marketCap: 150e12, changePct: 4 }),
      krStock({ symbol: '900000', name: '소형반도체', sector: '반도체', price: 30000, volume: 4_000_000, marketCap: 800e9, changePct: 8 }),
    ];
    const res = computeMorphFocus({
      krItems, usItems: [], coinItems: [],
      recentNews: [{ title: '반도체 HBM 슈퍼사이클 진입' }],
      krwRate: KRW, indices: [{ id: 'NDX', changePct: 1.5 }],
      krStatus: st('open'), usStatus: st('closed'),
    });
    expect(res.mode).toBe(MORPH_MODE.KR_LEAD);
    expect(res.primaryTheme).not.toBeNull();
    expect(res.primaryTheme.theme).toBe('반도체');
    expect(res.primaryTheme.leaders.length).toBeGreaterThan(0);
    expect(res.bridge).not.toBeNull();
    expect(res.bridge.pair.krSector).toBe('반도체');
  });

  it('COIN_LEAD: 둘 다 휴장 → 거래대금 상위 코인 movers, 브릿지 없음', () => {
    const coinItems = [
      coin({ symbol: 'BTC', accTradePrice24h: 5e11, change24h: 3 }),
      coin({ symbol: 'ETH', accTradePrice24h: 3e11, change24h: 5 }),
      coin({ symbol: 'SMALL', accTradePrice24h: 1e9, change24h: 20 }), // 컷 대상
    ];
    const res = computeMorphFocus({
      krItems: [], usItems: [], coinItems,
      recentNews: [], krwRate: KRW, indices: [],
      krStatus: st('closed'), usStatus: st('closed'),
    });
    expect(res.mode).toBe(MORPH_MODE.COIN_LEAD);
    expect(res.bridge).toBeNull();
    expect(res.movers.length).toBeGreaterThan(0);
    expect(res.movers.map((m) => m.symbol)).not.toContain('SMALL');
    expect(res.movers.map((m) => m.symbol)).toContain('BTC');
  });

  it('무섹터 종목만 있을 때 단일카드(movers) 폴백 — primaryTheme null', () => {
    const krItems = [
      krStock({ symbol: '999999', name: '신규테마무섹터', sector: undefined, price: 50000, volume: 3_000_000, marketCap: 1e12, changePct: 12 }),
    ];
    const res = computeMorphFocus({
      krItems, usItems: [], coinItems: [],
      recentNews: [], krwRate: KRW, indices: [{ id: 'NDX', changePct: 1.2 }],
      krStatus: st('open'), usStatus: st('closed'),
    });
    expect(res.mode).toBe(MORPH_MODE.KR_LEAD);
    expect(res.primaryTheme).toBeNull(); // 섹터 없음 → 테마 미분류
    expect(res.movers.length).toBe(1);
    expect(res.movers[0].symbol).toBe('999999');
  });

  it('US_GAP: 미장 프리마켓 → move(갭) 우선 movers', () => {
    const usItems = [
      usStock({ symbol: 'AAA', name: 'Big Turnover', price: 100, volume: 5_000_000, marketCap: 500e9, changePct: 2 }),
      usStock({ symbol: 'BBB', name: 'Big Gap', price: 50, volume: 2_000_000, marketCap: 100e9, changePct: 11 }),
    ];
    const res = computeMorphFocus({
      krItems: [], usItems, coinItems: [],
      recentNews: [], krwRate: KRW, indices: [],
      krStatus: st('closed'), usStatus: st('pre'),
    });
    expect(res.mode).toBe(MORPH_MODE.US_GAP);
    // 갭(변동폭) 우선 정렬 → BBB가 상위
    expect(res.movers[0].symbol).toBe('BBB');
  });

  it('krwRateLoaded=false면 US는 USD raw($) 하한으로 비교 — $50M 초과 종목 보존', () => {
    const usItems = [
      // USD raw = 100 × 1,000,000 = $100M > MIN_TURNOVER.US_USD($50M) → 보존
      usStock({ symbol: 'CCC', name: 'US Stock', price: 100, volume: 1_000_000, marketCap: 100e9, changePct: 5 }),
    ];
    const res = computeMorphFocus({
      krItems: [], usItems, coinItems: [],
      recentNews: [], krwRate: 0, krwRateLoaded: false, indices: [],
      krStatus: st('closed'), usStatus: st('open'),
    });
    expect(res.mode).toBe(MORPH_MODE.US_LEAD);
    // 환율 미로드 시 turnoverKRW는 0이지만, passesNoiseGate가 USD raw로 직접 비교 → 컷되지 않음.
    const ccc = res._scored.us.find((s) => s.symbol === 'CCC');
    expect(ccc).toBeDefined();
  });

  it('krwRateLoaded=false여도 US USD raw $50M 미달 종목은 컷(폴백이 잡주를 통과시키지 않음)', () => {
    const usItems = [
      // USD raw = 10 × 1,000,000 = $10M < $50M → 컷
      usStock({ symbol: 'TINY', name: 'Tiny US', price: 10, volume: 1_000_000, marketCap: 5e9, changePct: 7 }),
    ];
    const res = computeMorphFocus({
      krItems: [], usItems, coinItems: [],
      recentNews: [], krwRate: 0, krwRateLoaded: false, indices: [],
      krStatus: st('closed'), usStatus: st('open'),
    });
    expect(res.mode).toBe(MORPH_MODE.US_LEAD);
    expect(res._scored.us.find((s) => s.symbol === 'TINY')).toBeUndefined();
  });

  it('baselineMap 제공 시 surge 점수 반영(w_surge>0 weights)', () => {
    const item = krStock({ symbol: '005930', name: '삼성전자', sector: '반도체', price: 80000, volume: 10_000_000, marketCap: 500e12, changePct: 3 });
    const turn = turnoverKRW(item, KRW); // 8000억
    const res = computeMorphFocus({
      krItems: [item], usItems: [], coinItems: [],
      recentNews: [], krwRate: KRW, indices: [],
      krStatus: st('open'), usStatus: st('closed'),
      baselineMap: { '005930': { avg20d: turn / 4 } }, // 4배 급증 → surge 80
      weights: SCORE_WEIGHTS.secondary,
    });
    const scored = res._scored.kr.find((s) => s.symbol === '005930');
    expect(scored._leadBreakdown.surge).toBeGreaterThan(0);
    expect(scored._leadBreakdown.surge).toBeCloseTo(80, 0);
  });
});

// ─── 상수 무결성 ──────────────────────────────────────────────
describe('상수', () => {
  it('1차 가중치 합 = 1, w_surge = 0', () => {
    const w = SCORE_WEIGHTS.primary;
    expect(w.turn + w.move + w.news + w.surge).toBeCloseTo(1, 6);
    expect(w.surge).toBe(0);
  });
  it('MIN_TURNOVER 하한값', () => {
    expect(MIN_TURNOVER.KR).toBe(5_000_000_000);
    expect(MIN_TURNOVER.US_USD).toBe(50_000_000);
    expect(MIN_TURNOVER.COIN).toBe(10_000_000_000);
  });
});
