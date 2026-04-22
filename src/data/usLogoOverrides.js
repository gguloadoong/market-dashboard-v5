// US 종목 로고 도메인 화이트리스트 — parqet 실패 케이스 전용 clearbit 보조
// 심볼.com 도메인 추측이 오매칭을 일으키므로(F.com≠Ford 등) 화이트리스트 방식으로만 clearbit 사용.
// QA 피드백 기반 확장 — 초기엔 명백한 케이스만, 잘못된 로고 확인 시 추가.
export const US_LOGO_DOMAIN = Object.freeze({
  // 버크셔 해서웨이 — parqet에 BRK/BRK.A/BRK.B 모두 실패
  BRK: 'berkshirehathaway.com',
  'BRK.A': 'berkshirehathaway.com',
  'BRK.B': 'berkshirehathaway.com',
  // 알파벳 (구글 모회사) — parqet GOOG/GOOGL 실패
  GOOG: 'abc.xyz',
  GOOGL: 'abc.xyz',
});
