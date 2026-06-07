import { describe, it, expect } from 'vitest';
import { computeMarketRegime, REGIME_THRESHOLD } from '../utils/marketRegime.js';

const idx = (id, changePct) => ({ id, changePct });

describe('computeMarketRegime', () => {
  it('주식 지수 평균 ≤ -2% → 하락장', () => {
    const r = computeMarketRegime([
      idx('KOSPI', -5.5), idx('KOSDAQ', -4.5), idx('NDX', -2.6), idx('DJI', -1.3),
    ]);
    expect(r.regime).toBe('down');
    expect(r.label).toBe('하락장');
    expect(r.avg).toBeLessThan(0);
  });

  it('주식 지수 평균 ≥ +2% → 상승장', () => {
    const r = computeMarketRegime([idx('KOSPI', 3), idx('SPX', 2.5)]);
    expect(r.regime).toBe('up');
    expect(r.label).toBe('상승장');
  });

  it('±2% 이내 → 혼조', () => {
    const r = computeMarketRegime([idx('KOSPI', 0.5), idx('NDX', -0.8)]);
    expect(r.regime).toBe('mixed');
    expect(r.label).toBe('혼조');
  });

  it('DXY(달러인덱스)는 평균에서 제외 — 주식 지수만', () => {
    // 주식 KOSPI -5는 하락장이지만 DXY +10이 섞이면 평균이 왜곡됨 → DXY 제외 확인
    const r = computeMarketRegime([idx('KOSPI', -5), idx('NDX', -5), idx('DXY', 10)]);
    expect(r.regime).toBe('down');
    expect(r.avg).toBe(-5); // (-5 + -5) / 2, DXY 미포함
  });

  it('유효 주식 지수 없음 → null (빈 데이터로 가짜 혼조 방지)', () => {
    expect(computeMarketRegime([])).toBeNull();
    expect(computeMarketRegime([idx('DXY', 1)])).toBeNull();
    expect(computeMarketRegime([idx('KOSPI', NaN)])).toBeNull();
    expect(computeMarketRegime(null)).toBeNull();
    expect(computeMarketRegime(undefined)).toBeNull();
  });

  it('changePct null/빈문자열/false는 0으로 강제변환되지 않고 제외 (계약: 가짜 혼조 방지)', () => {
    // null 단독 → 유효값 없음 → null (Number(null)===0으로 혼조가 되면 안 됨)
    expect(computeMarketRegime([idx('KOSPI', null)])).toBeNull();
    expect(computeMarketRegime([idx('KOSPI', '')])).toBeNull();
    expect(computeMarketRegime([idx('KOSPI', false)])).toBeNull();
    // 하락 지수 + null 지수 → null은 평균에서 제외, 하락장 유지(0%로 희석 금지)
    const r = computeMarketRegime([idx('KOSPI', -6), idx('KOSDAQ', null)]);
    expect(r.regime).toBe('down');
    expect(r.avg).toBe(-6);
  });

  it('경계값 정확히 -2% → 하락장 (≤ 경계 포함)', () => {
    expect(computeMarketRegime([idx('KOSPI', -REGIME_THRESHOLD)]).regime).toBe('down');
    expect(computeMarketRegime([idx('KOSPI', REGIME_THRESHOLD)]).regime).toBe('up');
  });

  it('일부 지수 changePct 누락 시 유효값만 평균', () => {
    const r = computeMarketRegime([idx('KOSPI', -4), idx('KOSDAQ', undefined), idx('NDX', -2)]);
    expect(r.avg).toBe(-3); // (-4 + -2) / 2
    expect(r.regime).toBe('down');
  });
});
