// 세션 → 데이터 신뢰 모드 매핑
// dataMode: 'live' | 'delayed' | 'lastClose'
//   - live:      실시간 시세 (국장 정규장 = 한국투자증권 실시간)
//   - delayed:   지연 시세 (미장 정규장 = Yahoo 15분 지연)
//   - lastClose: 전일 종가 기준 (실시간 추적 안 됨)
//
// 2차 실데이터 연동 시 이 테이블만 수정하면 됨 (marketHours.js는 불변).
// 1차는 보수적으로 신규 세션(NXT·동시호가·데이마켓·프리·애프터)을 전부 lastClose로 둔다.
export const KR_SESSION_DATA_MODE = {
  open:       'live',
  preAuction: 'lastClose',
  preNxt:     'lastClose',
  afterNxt:   'lastClose',
  closed:     'lastClose',
};

export const US_SESSION_DATA_MODE = {
  open:      'delayed',
  pre:       'lastClose',
  after:     'lastClose',
  dayMarket: 'lastClose',
  closed:    'lastClose',
};
