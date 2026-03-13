// 장 운영시간 유틸리티

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

// 미국 주식 (EST 09:30~16:00, 즉 KST 23:30~05:00 다음날)
export function isUsMarketOpen() {
  const est = nowEST();
  if (!isWeekday(est)) return false;
  const h = est.getHours(), m = est.getMinutes();
  const minutes = h * 60 + m;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

// 프리마켓 (EST 04:00~09:30)
export function isUsPreMarket() {
  const est = nowEST();
  if (!isWeekday(est)) return false;
  const h = est.getHours(), m = est.getMinutes();
  const minutes = h * 60 + m;
  return minutes >= 4 * 60 && minutes < 9 * 60 + 30;
}

// 애프터마켓 (EST 16:00~20:00)
export function isUsAfterMarket() {
  const est = nowEST();
  if (!isWeekday(est)) return false;
  const h = est.getHours(), m = est.getMinutes();
  const minutes = h * 60 + m;
  return minutes >= 16 * 60 && minutes < 20 * 60;
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
  if (!isWeekday(est)) return { status: 'closed', label: '휴장', color: 'neutral' };
  if (isUsMarketOpen()) return { status: 'open', label: '거래중', color: 'up' };
  if (isUsPreMarket()) return { status: 'pre', label: '프리마켓', color: 'neutral' };
  if (isUsAfterMarket()) return { status: 'after', label: '애프터', color: 'neutral' };
  return { status: 'closed', label: '장마감', color: 'neutral' };
}
