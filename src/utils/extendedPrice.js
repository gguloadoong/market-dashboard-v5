// 연장세션 참고가 헬퍼 — #334 네이버 overMarketPriceInfo 표시 로직 통합
//
// 적용 규칙(컴포넌트 공통):
//   1) 종목에 extendedPrice 가 있고
//   2) extendedStatus === 'OPEN' (네이버가 OPEN/CLOSE 둘 다 줄 수 있으나 OPEN 만 신뢰)
//   3) status.dataMode === 'delayed' (sessionDataMode.js 매핑 결과)
//   위 세 조건을 모두 만족할 때 가격/등락률을 ext 값으로 표시.
//
// status.dataMode 가 'live'(국장 정규장)인 경우 정규장 시세 우선 — ext 무시.
// 'lastClose' 인 경우는 종가 기반 표시 유지.

// item: snapshot 종목 객체 (extendedPrice/extendedChangePct/extendedStatus/extendedSessionType 포함 가능)
// status: getKoreanMarketStatus() / getUsMarketStatus() 결과 ({ dataMode, phase, ... })
export function hasLiveExtended(item, status) {
  if (!item || !status) return false;
  if (status.dataMode !== 'delayed') return false;
  if (status.phase === 'open') return false; // 정규장은 메인 시세 우선
  const p = Number(item.extendedPrice);
  if (!Number.isFinite(p) || p <= 0) return false;
  if (item.extendedStatus !== 'OPEN') return false;
  return true;
}

// "참고가" 배지 라벨 — sessionType 별 분기
export function extendedBadgeLabel(item) {
  switch (item?.extendedSessionType) {
    case 'PRE_MARKET':  return '프리 참고가';
    case 'AFTER_MARKET':return '애프터 참고가';
    case 'NXT_PRE':     return 'NXT 프리';
    case 'NXT_AFTER':   return 'NXT 시간외';
    default:            return '참고가';
  }
}
