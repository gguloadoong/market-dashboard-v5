// 세션 → 데이터 신뢰 모드 매핑
// dataMode: 'live' | 'delayed' | 'lastClose'
//   - live:      실시간 시세 (국장 정규장 = 한국투자증권 실시간)
//   - delayed:   지연 시세 (미장 정규장 = Yahoo 15분 지연, 연장세션 = 네이버 비공식 ~수십초 지연)
//   - lastClose: 전일 종가 기준 (실시간 추적 안 됨)
//
// 2차 실데이터 연동 시 이 테이블만 수정하면 됨 (marketHours.js는 불변).
// #334: 네이버 비공식 overMarketPriceInfo 실증 완료된 세션만 'delayed' 로 플립.
//   - US pre/after: AAPL/NVDA/TSLA 프리·애프터 실시간 확인 (2026-05-27)
//   - KR afterNxt:  삼성전자/SK하이닉스 NXT 시간외 KST15:30~20:00 연속체결 확인
//   - US dayMarket: 블루오션 야간 ET20~04 네이버 overMarketStatus null 가능성 → 실증 후 2차
//   - KR preNxt:    NXT 프리 KST08:00~08:50 미확인 → 실증 후 2차
export const KR_SESSION_DATA_MODE = {
  open:       'live',
  preAuction: 'lastClose',
  preNxt:     'lastClose',     // #334: NXT 프리 실증 후 'delayed' 로 플립
  afterNxt:   'delayed',       // #334: 네이버 overMarketPriceInfo NXT 시간외 확인
  closed:     'lastClose',
};

export const US_SESSION_DATA_MODE = {
  open:      'delayed',
  pre:       'delayed',        // #334: 네이버 overMarketPriceInfo PRE_MARKET 확인
  after:     'delayed',        // #334: 네이버 overMarketPriceInfo AFTER_MARKET 확인
  dayMarket: 'lastClose',      // #334: 블루오션 야간 ET20~04 네이버 커버 미확인 — 실증 후 2차
  closed:    'lastClose',
};
