import { describe, it, expect } from 'vitest';
import { isNoiseInstrument } from '../components/home/utils.js';

// #360 — 미장 워런트 티커 규약 기반 판별. name이 기초기업명과 동일한 케이스(CORZW)까지 컷.
describe('isNoiseInstrument', () => {
  it('티커 규약(4글자+W/Z): name이 기초기업명과 동일해도 컷', () => {
    // 실제 프로덕션 케이스 — name은 기초기업명, 티커만 워런트 신호
    expect(isNoiseInstrument({ symbol: 'CORZW', name: 'Core Scientific, Inc.', market: 'us' })).toBe(true);
    expect(isNoiseInstrument({ symbol: 'RVMDW', name: 'Revolution Medicines, Inc.', market: 'us' })).toBe(true);
    expect(isNoiseInstrument({ symbol: 'NNAVW', name: 'NextNav Inc.', market: 'us' })).toBe(true);
    expect(isNoiseInstrument({ symbol: 'KYIVW', name: 'Kyivstar Group Ltd.', market: 'us' })).toBe(true);
    expect(isNoiseInstrument({ symbol: 'CORZZ', name: 'Core Scientific, Inc.', market: 'us' })).toBe(true); // Z 트랜치
  });

  it('name 기반(Warrant/Rights/Units 토큰)도 유지', () => {
    expect(isNoiseInstrument({ symbol: 'ABC', name: 'ABC Holdings Warrant', market: 'us' })).toBe(true);
    expect(isNoiseInstrument({ symbol: 'XYZ', name: 'XYZ Acquisition Units', market: 'us' })).toBe(true);
    expect(isNoiseInstrument({ symbol: 'LEV', name: 'KODEX 레버리지', market: 'kr' })).toBe(true);
  });

  it('오탐 가드 — 보통주 보존', () => {
    expect(isNoiseInstrument({ symbol: 'SNOW', name: 'Snowflake Inc.', market: 'us' })).toBe(false);  // 4글자 ending W
    expect(isNoiseInstrument({ symbol: 'NWS', name: 'News Corp', market: 'us' })).toBe(false);
    expect(isNoiseInstrument({ symbol: 'JWL', name: 'Jewels International', market: 'us' })).toBe(false);
    expect(isNoiseInstrument({ symbol: 'AAPL', name: 'Apple Inc.', market: 'us' })).toBe(false);
    expect(isNoiseInstrument({ symbol: '005930', name: '삼성전자', market: 'kr' })).toBe(false); // 국장 숫자 심볼
  });

  it('코인 가드 — id 보유 코인은 티커 규약 미적용', () => {
    // 코인은 워런트 규약과 무관 — 5글자 ending W라도 id 보유 시 컷 금지
    expect(isNoiseInstrument({ symbol: 'ABCDW', id: 'abcdw', name: 'SomeCoin', market: 'coin' })).toBe(false);
  });
});
