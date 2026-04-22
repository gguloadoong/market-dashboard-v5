// US 듀얼클래스 보통주 — 우선주 패턴 판별 예외 목록 (#183)
// 현재 `symbolKey.isPreferredOrSpecial`은 `WS`/`WT` 워런트와 `^`/`.PR.`/`-PR.` 명시 토큰만 잡으므로
// 여기 등재된 대부분은 실제 필터 대상이 아니다. 보수적 안전망 + 추후 규칙 강화 대비.
// KR 심볼은 숫자 6자리라 충돌 없음 — US 전용.
export const US_DUAL_CLASS_WHITELIST = new Set([
  // 버크셔 해서웨이 — 앱 내부 포맷은 하이픈, 외부 소스 점 포맷도 방어
  'BRK-A', 'BRK-B', 'BRK.A', 'BRK.B',
  // 브라운포먼
  'BF-A', 'BF-B', 'BF.A', 'BF.B',
  // 알파벳
  'GOOG', 'GOOGL',
  // 폭스
  'FOX', 'FOXA',
  // 레나
  'LEN-B', 'LEN.B',
  // HEICO
  'HEI-A', 'HEI.A',
  // 뉴스코프
  'NWS', 'NWSA',
  // 언더아머
  'UA', 'UAA',
]);
