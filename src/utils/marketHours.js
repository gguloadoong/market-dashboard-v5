// 장 운영시간 유틸리티

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

function isNyseHoliday(est) {
  return NYSE_HOLIDAYS.has(etDateKey(est));
}

function isNyseEarlyClose(est) {
  return NYSE_EARLY_CLOSE.has(etDateKey(est));
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
  const h = kst.getHours(), m = kst.getMinutes();
  const minutes = h * 60 + m;
  return minutes >= 9 * 60 && minutes < 15 * 60 + 30;
}

// 미국 주식 (ET 09:30~16:00, 조기종료일 09:30~13:00)
export function isUsMarketOpen() {
  const est = nowEST();
  if (!isWeekday(est) || isNyseHoliday(est)) return false;
  const h = est.getHours(), m = est.getMinutes();
  const minutes = h * 60 + m;
  const closeTime = isNyseEarlyClose(est) ? 13 * 60 : 16 * 60;
  return minutes >= 9 * 60 + 30 && minutes < closeTime;
}

// 프리마켓 (ET 04:00~09:30) — 휴장일 제외
export function isUsPreMarket() {
  const est = nowEST();
  if (!isWeekday(est) || isNyseHoliday(est)) return false;
  const h = est.getHours(), m = est.getMinutes();
  const minutes = h * 60 + m;
  return minutes >= 4 * 60 && minutes < 9 * 60 + 30;
}

// 애프터마켓 (ET 16:00~20:00) — 조기종료일은 13:00부터, 휴장일 제외
export function isUsAfterMarket() {
  const est = nowEST();
  if (!isWeekday(est) || isNyseHoliday(est)) return false;
  const h = est.getHours(), m = est.getMinutes();
  const minutes = h * 60 + m;
  const afterStart = isNyseEarlyClose(est) ? 13 * 60 : 16 * 60;
  return minutes >= afterStart && minutes < 20 * 60;
}

export function getKoreanMarketStatus() {
  const kst = nowKST();
  if (!isWeekday(kst)) return { status: 'closed', label: '휴장', color: 'neutral' };
  if (isKoreanMarketOpen()) return { status: 'open', label: '거래중', color: 'up' };
  const h = kst.getHours(), m = kst.getMinutes();
  const minutes = h * 60 + m;
  if (minutes >= 8 * 60 + 30 && minutes < 9 * 60) return { status: 'pre', label: '동시호가', color: 'neutral' };
  return { status: 'closed', label: '장마감', color: 'neutral' };
}

export function getUsMarketStatus() {
  const est = nowEST();
  if (!isWeekday(est) || isNyseHoliday(est)) return { status: 'closed', label: '휴장', color: 'neutral' };
  if (isUsMarketOpen()) {
    if (isNyseEarlyClose(est)) return { status: 'open', label: '거래중(조기종료)', color: 'up' };
    return { status: 'open', label: '거래중', color: 'up' };
  }
  if (isUsPreMarket()) return { status: 'pre', label: '프리마켓', color: 'neutral' };
  if (isUsAfterMarket()) return { status: 'after', label: '애프터', color: 'neutral' };
  return { status: 'closed', label: '장마감', color: 'neutral' };
}
