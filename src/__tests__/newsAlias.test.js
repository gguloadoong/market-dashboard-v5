// #345 — getMatchConfidence 단어 경계 매칭 회귀 테스트
// substring(includes) → matchesKeywords(단어 경계) 전환 후, 짧은 심볼(arm 등)이
// 다른 단어의 부분 문자열로 잘못 DIRECT 승격되던 오분류가 차단되는지 검증.
import { describe, it, expect } from 'vitest';
import { getMatchConfidence, buildStockKeywords } from '../utils/newsAlias.js';

describe('getMatchConfidence 단어 경계 매칭 (#345)', () => {
  const armKeys = buildStockKeywords('ARM', 'ARM Holdings', 'US'); // ['arm','arm holdings','arm chip']
  const aaplKeys = buildStockKeywords('AAPL', 'Apple Inc', 'US');  // ['aapl','apple','애플']

  it('심볼 직접 언급은 DIRECT', () => {
    expect(getMatchConfidence('AAPL 신제품 출시', aaplKeys, 'AAPL')).toBe('DIRECT');
    expect(getMatchConfidence('ARM 신제품 발표', armKeys, 'ARM')).toBe('DIRECT');
  });

  it('짧은 심볼이 다른 단어의 부분 문자열이면 DIRECT 오분류 차단 (arm ⊄ warm)', () => {
    // 과거 substring: 'warm'.includes('arm') → DIRECT 오분류
    // 단어 경계: 'arm'이 독립 단어가 아니므로 WEAK
    expect(getMatchConfidence('글로벌 warm 트렌드 분석', armKeys, 'ARM')).toBe('WEAK');
  });

  it('한국어 별칭(slice(2) 키워드)은 SECTOR 등급', () => {
    // '애플'은 keywords[2] → directKeys(symbol+slice(0,2))에 미포함 → SECTOR
    expect(getMatchConfidence('애플 신제품 발표', aaplKeys, 'AAPL')).toBe('SECTOR');
  });

  it('섹터 키워드(유가 등)는 SECTOR', () => {
    const xomKeys = buildStockKeywords('XOM', 'Exxon Mobil', 'US');
    expect(getMatchConfidence('국제 유가 급등', xomKeys, 'XOM')).toBe('SECTOR');
  });

  it('관련 없는 제목은 WEAK', () => {
    expect(getMatchConfidence('부동산 시장 전망', aaplKeys, 'AAPL')).toBe('WEAK');
  });

  it('빈/null 입력에 안전 (WEAK 반환, throw 없음)', () => {
    expect(getMatchConfidence('', aaplKeys, 'AAPL')).toBe('WEAK');
    expect(getMatchConfidence(null, aaplKeys, 'AAPL')).toBe('WEAK');
    expect(getMatchConfidence('아무 제목', [], undefined)).toBe('WEAK');
  });
});
