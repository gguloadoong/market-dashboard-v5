// 장 운영시간 유틸리티

// ─── KRX 휴장일 (완전 휴장) ────────────────────────────────────
// 출처: 한국법령정보센터 공공기관 법정 공휴일 + KRX 거래소 휴장일 기준
// 포맷: 'YYYY-M-D' (KST 기준, 월/일 앞에 0 없음)
// 평일만 등재. 주말 공휴일은 isWeekday()가 자동 차단하므로 대체공휴일(평일)만 기재
const KRX_HOLIDAYS = new Set([
  // 2025
  '2025-1-1',   // 신정 (수)
  '2025-1-28',  // 설날 연휴 (화)
  '2025-1-29',  // 설날 (수)
  '2025-1-30',  // 설날 연휴 (목)
  '2025-3-3',   // 삼일절 대체공휴일 (월, 3/1이 토요일)
  '2025-5-5',   // 어린이날 (월)
  '2025-5-6',   // 어린이날·부처님오신날 공동 대체공휴일 (화, 양일 5/5 겹침)
  '2025-6-6',   // 현충일 (금, 대체공휴일 없음)
  '2025-8-15',  // 광복절 (금)
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
  '2026-5-25',  // 부처님오신날 (월)
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
export function isKoreanMarketOpen() {
  const kst = nowKST();
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

export function getKoreanMarketStatus() {
  const kst = nowKST();
  if (!isWeekday(kst) || isKrxHoliday(kst)) return { status: 'closed', label: '휴장', color: 'neutral' };
  if (isKoreanMarketOpen()) return { status: 'open', label: '거래중', color: 'up' };
  const h = kst.getHours(), m = kst.getMinutes();
  const minutes = h * 60 + m;
  if (minutes >= 8 * 60 + 30 && minutes < 9 * 60) return { status: 'pre', label: '동시호가', color: 'neutral' };
  return { status: 'closed', label: '장마감', color: 'neutral' };
}

export function getUsMarketStatus() {
  // 단일 스냅샷으로 모든 판정 — 경계 시점 흔들림 방지
  const est = nowEST();
  if (!isWeekday(est) || isNyseHoliday(est)) return { status: 'closed', label: '휴장', color: 'neutral' };
  if (isUsMarketOpen(est)) {
    if (isNyseEarlyClose(est)) return { status: 'open', label: '거래중(조기종료)', color: 'up' };
    return { status: 'open', label: '거래중', color: 'up' };
  }
  if (isUsPreMarket(est)) return { status: 'pre', label: '프리마켓', color: 'neutral' };
  if (isUsAfterMarket(est)) return { status: 'after', label: '애프터', color: 'neutral' };
  return { status: 'closed', label: '장마감', color: 'neutral' };
}
