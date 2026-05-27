// 장 운영시간 유틸리티
import { KR_SESSION_DATA_MODE, US_SESSION_DATA_MODE } from '../constants/sessionDataMode';

// ─── KRX 휴장일 (완전 휴장) ────────────────────────────────────
// 출처: 한국법령정보센터 공공기관 법정 공휴일 + KRX 거래소 휴장일 기준
// 포맷: 'YYYY-M-D' (KST 기준, 월/일 앞에 0 없음)
// 평일만 등재. 주말 공휴일은 isWeekday()가 자동 차단하므로 대체공휴일(평일)만 기재
const KRX_HOLIDAYS = new Set([
  // 2025
  '2025-1-1',   // 신정 (수)
  '2025-1-27',  // 설날 연계 임시공휴일 (월, 정부 지정)
  '2025-1-28',  // 설날 연휴 (화)
  '2025-1-29',  // 설날 (수)
  '2025-1-30',  // 설날 연휴 (목)
  '2025-3-3',   // 삼일절 대체공휴일 (월, 3/1이 토요일)
  '2025-5-5',   // 어린이날 (월)
  '2025-5-6',   // 어린이날·부처님오신날 공동 대체공휴일 (화, 양일 5/5 겹침)
  '2025-6-6',   // 현충일 (금, 대체공휴일 없음)
  '2025-8-15',  // 광복절 (금)
  '2025-10-2',  // 추석 연계 임시공휴일 (목, 정부 지정)
  '2025-10-3',  // 개천절 (금)
  '2025-10-6',  // 추석 연휴 (월)
  '2025-10-7',  // 추석 (화)
  '2025-10-8',  // 추석 대체공휴일 (수, 10/5가 일요일)
  '2025-10-9',  // 한글날 (목)
  '2025-12-25', // 성탄절 (목)
  // 2026
  '2026-1-1',   // 신정 (목)
  '2026-2-16',  // 설날 연휴 (월)
  '2026-2-17',  // 설날 (화)
  '2026-2-18',  // 설날 연휴 (수)
  '2026-3-2',   // 삼일절 대체공휴일 (월, 3/1이 일요일)
  '2026-5-5',   // 어린이날 (화)
  '2026-5-25',  // 부처님오신날 대체공휴일 (월, 5/24이 일요일)
  '2026-8-17',  // 광복절 대체공휴일 (월, 8/15이 토요일)
  '2026-9-24',  // 추석 연휴 (목)
  '2026-9-25',  // 추석 (금)
  '2026-9-28',  // 추석 대체공휴일 (월, 9/26이 토요일)
  '2026-10-5',  // 개천절 대체공휴일 (월, 10/3이 토요일)
  '2026-10-9',  // 한글날 (금)
  '2026-12-25', // 성탄절 (금)
  // 2027
  '2027-1-1',   // 신정 (금)
  '2027-2-8',   // 설날 연휴 (월, 음력 1/2)
  '2027-2-9',   // 설날 대체공휴일 (화, 설날 2/7이 일요일+전날 2/6이 토요일)
  '2027-3-1',   // 삼일절 (월)
  '2027-5-5',   // 어린이날 (수)
  '2027-5-13',  // 부처님오신날 (목)
  '2027-8-16',  // 광복절 대체공휴일 (월, 8/15이 일요일)
  '2027-9-14',  // 추석 연휴 (월)
  '2027-9-15',  // 추석 (화)
  '2027-9-16',  // 추석 연휴 (수)
  '2027-10-4',  // 개천절 대체공휴일 (월, 10/3이 일요일)
  '2027-10-11', // 한글날 대체공휴일 (월, 10/9이 토요일)
  '2027-12-27', // 성탄절 대체공휴일 (월, 12/25이 토요일)
]);

// ─── NYSE 휴장일 (완전 휴장) ───────────────────────────────────
// 포맷: 'YYYY-M-D' (ET 기준, 월/일 앞에 0 없음)
const NYSE_HOLIDAYS = new Set([
  // 2025
  '2025-1-1',   // 신년
  '2025-1-20',  // MLK Day
  '2025-2-17',  // Presidents' Day
  '2025-4-18',  // Good Friday (Easter 4/20)
  '2025-5-26',  // Memorial Day
  '2025-6-19',  // Juneteenth
  '2025-7-4',   // Independence Day
  '2025-9-1',   // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  // 2026
  '2026-1-1',   // 신년
  '2026-1-19',  // MLK Day
  '2026-2-16',  // Presidents' Day
  '2026-4-3',   // Good Friday (Easter 4/5)
  '2026-5-25',  // Memorial Day
  '2026-6-19',  // Juneteenth
  '2026-7-3',   // Independence Day observed (7/4 토요일)
  '2026-9-7',   // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
]);

// ─── NYSE 조기종료일 (1:00 PM ET 마감) ───────────────────────
const NYSE_EARLY_CLOSE = new Set([
  // 2025
  '2025-7-3',   // 독립기념일 전날
  '2025-11-28', // 블랙프라이데이
  '2025-12-24', // 크리스마스이브
  // 2026
  '2026-11-27', // 블랙프라이데이
  '2026-12-24', // 크리스마스이브
]);

function etDateKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function kstDateKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isNyseHoliday(est) {
  return NYSE_HOLIDAYS.has(etDateKey(est));
}

function isNyseEarlyClose(est) {
  return NYSE_EARLY_CLOSE.has(etDateKey(est));
}

function isKrxHoliday(kst) {
  return KRX_HOLIDAYS.has(kstDateKey(kst));
}

// 한국 기준 현재 시간
function nowKST() {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return kst;
}

// 뉴욕 기준 현재 시간
function nowEST() {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return est;
}

function isWeekday(d) {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

// 국내 주식 (KST 09:00~15:30)
export function isKoreanMarketOpen(kst = nowKST()) {
  if (!isWeekday(kst)) return false;
  if (isKrxHoliday(kst)) return false;
  const h = kst.getHours(), m = kst.getMinutes();
  const minutes = h * 60 + m;
  return minutes >= 9 * 60 && minutes < 15 * 60 + 30;
}

// 미국 주식 (ET 09:30~16:00, 조기종료일 09:30~13:00)
// est 파라미터: getUsMarketStatus에서 단일 스냅샷 전달 시 경계 흔들림 방지
export function isUsMarketOpen(est = nowEST()) {
  if (!isWeekday(est) || isNyseHoliday(est)) return false;
  const h = est.getHours(), m = est.getMinutes();
  const minutes = h * 60 + m;
  const closeTime = isNyseEarlyClose(est) ? 13 * 60 : 16 * 60;
  return minutes >= 9 * 60 + 30 && minutes < closeTime;
}

// 프리마켓 (ET 04:00~09:30) — 휴장일 제외
export function isUsPreMarket(est = nowEST()) {
  if (!isWeekday(est) || isNyseHoliday(est)) return false;
  const h = est.getHours(), m = est.getMinutes();
  const minutes = h * 60 + m;
  return minutes >= 4 * 60 && minutes < 9 * 60 + 30;
}

// 애프터마켓 (ET 16:00~20:00) — 조기종료일은 13:00부터, 휴장일 제외
export function isUsAfterMarket(est = nowEST()) {
  if (!isWeekday(est) || isNyseHoliday(est)) return false;
  const h = est.getHours(), m = est.getMinutes();
  const minutes = h * 60 + m;
  const afterStart = isNyseEarlyClose(est) ? 13 * 60 : 16 * 60;
  return minutes >= afterStart && minutes < 20 * 60;
}

// ─── 신규 세션 판정 함수 (NXT·동시호가·미장 데이마켓) ───────────
// 모두 단일 스냅샷 주입 가능 (getXxxMarketStatus에서 동일 시각 재사용 → 경계 흔들림 방지)

// 국장 NXT 프리마켓 (KST 08:00~08:50) — 평일·휴장일 가드
export function isKrPreNxt(kst = nowKST()) {
  if (!isWeekday(kst) || isKrxHoliday(kst)) return false;
  const minutes = kst.getHours() * 60 + kst.getMinutes();
  return minutes >= 8 * 60 && minutes < 8 * 60 + 50;
}

// 국장 동시호가 (KST 08:30~09:00) — 기존 getKoreanMarketStatus 인라인 로직을 함수로 추출
export function isKrPreAuction(kst = nowKST()) {
  if (!isWeekday(kst) || isKrxHoliday(kst)) return false;
  const minutes = kst.getHours() * 60 + kst.getMinutes();
  return minutes >= 8 * 60 + 30 && minutes < 9 * 60;
}

// 국장 NXT 시간외 (KST 15:30~20:00) — 평일·휴장일 가드
export function isKrAfterNxt(kst = nowKST()) {
  if (!isWeekday(kst) || isKrxHoliday(kst)) return false;
  const minutes = kst.getHours() * 60 + kst.getMinutes();
  return minutes >= 15 * 60 + 30 && minutes < 20 * 60;
}

// 미장 데이마켓 (ET 20:00~익일 04:00) — 자정 넘김 + 요일 경계 처리
// 블루오션 거래 시간: 일요일 저녁 ~ 금요일 저녁(금 밤 제외).
// 주말 차단은 isWeekday가 아니라 아래 요일 로직이 담당 (일요일 저녁 통과 필요).
export function isUsDayMarket(est = nowEST()) {
  if (isNyseHoliday(est)) return false;
  const day = est.getDay();                 // 0=일 … 6=토
  const minutes = est.getHours() * 60 + est.getMinutes();
  const isEvening = minutes >= 20 * 60;      // 20:00~23:59
  const isDawn    = minutes < 4 * 60;        // 00:00~03:59
  // 저녁(20~24시): 일~목만 (금·토 밤은 주말 진입이므로 제외)
  if (isEvening) return day >= 0 && day <= 4;
  // 새벽(0~4시): 월~금 (일요일밤→월새벽 시작 ~ 목요일밤→금새벽 마지막. 토·일 새벽만 주말이므로 제외)
  // 저녁 일~목(0~4)과 짝: 일저녁→월새벽, 목저녁→금새벽으로 자정 연속성 유지
  if (isDawn)    return day >= 1 && day <= 5;
  return false;
}

// ─── phase → 하위호환 status 다운캐스트 ─────────────────────────
// 기존 소비처(status==='open' 단일 기준)가 신규 phase에서도 안전 폴백되도록 버킷화.
// ⚠️ dataMode가 lastClose인 세션(데이마켓·프리·애프터·NXT 등)은 절대 'open'으로 올리지 않는다(거짓 라이브 방지).
function bucketize(phase) {
  if (phase === 'open') return 'open';
  if (phase === 'pre' || phase === 'preNxt' || phase === 'preAuction') return 'pre';
  if (phase === 'after' || phase === 'afterNxt' || phase === 'dayMarket') return 'after';
  return 'closed';
}

// ─── phase → 한국어 라벨 ────────────────────────────────────────
function buildLabel(phase, opts = {}) {
  switch (phase) {
    case 'open':       return opts.earlyClose ? '거래중(조기종료)' : '거래중';
    case 'dayMarket':  return '데이마켓';
    case 'pre':        return '프리마켓';
    case 'after':      return '애프터';
    case 'preNxt':     return 'NXT 프리';
    case 'afterNxt':   return 'NXT 시간외';
    case 'preAuction': return '동시호가';
    case 'closed':     return opts.isHolidayOrWeekend ? '휴장' : '장마감';
    default:           return '장마감';
  }
}

// ─── 통합 상태 빌더 — 3축 분리(phase / isLive / dataMode) + 하위호환 status ─────
function buildStatus(market, phase, opts = {}) {
  const dataMode = (market === 'kr' ? KR_SESSION_DATA_MODE : US_SESSION_DATA_MODE)[phase];
  const status   = bucketize(phase);                 // 하위호환 다운캐스트
  const isLive   = dataMode === 'live' || dataMode === 'delayed'; // 녹색 펄스 단일 트리거 (allowlist — 미지/누락 phase는 안전측 false)
  const label    = buildLabel(phase, opts);
  const color    = isLive ? 'up' : 'neutral';        // 死필드(기존 color) 호환 유지
  return { status, phase, label, color, isLive, dataMode };
}

export function getKoreanMarketStatus() {
  const kst = nowKST();                               // 단일 스냅샷 — 모든 판정에 주입
  const isHolidayOrWeekend = !isWeekday(kst) || isKrxHoliday(kst);
  let phase;
  if (isHolidayOrWeekend)         phase = 'closed';
  else if (isKoreanMarketOpen(kst)) phase = 'open';   // 단일 스냅샷 kst 주입(경계 흔들림 방지)
  else if (isKrPreAuction(kst))   phase = 'preAuction'; // 08:30~09:00 우선
  else if (isKrPreNxt(kst))       phase = 'preNxt';     // 08:00~08:30 단독
  else if (isKrAfterNxt(kst))     phase = 'afterNxt';
  else                            phase = 'closed';
  return buildStatus('kr', phase, { isHolidayOrWeekend });
}

export function getUsMarketStatus() {
  const est = nowEST();                               // 단일 스냅샷 — 모든 판정에 주입
  // 정규/프리/애프터는 평일에만 판정(주말 거짓 라이브 방지 — 명시적 이중 가드).
  // 데이마켓은 자체 요일 로직(isUsDayMarket)이 일요일밤·평일새벽 경계를 담당하므로 주말 가드 제외.
  const weekday = isWeekday(est);
  let phase;
  if (isNyseHoliday(est))                    phase = 'closed';
  else if (weekday && isUsMarketOpen(est))   phase = 'open';
  else if (weekday && isUsPreMarket(est))    phase = 'pre';
  else if (weekday && isUsAfterMarket(est))  phase = 'after';
  else if (isUsDayMarket(est))               phase = 'dayMarket';
  else                                       phase = 'closed';
  const earlyClose = phase === 'open' && isNyseEarlyClose(est);
  const isHolidayOrWeekend = phase === 'closed' && (isNyseHoliday(est) || !isWeekday(est));
  return buildStatus('us', phase, { earlyClose, isHolidayOrWeekend });
}
