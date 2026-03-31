// 브리핑 알림 — Notification API 사용 (앱이 열려있을 때)
// 백그라운드 Push는 서버 인프라 필요 — 추후 확장

export async function showBriefingNotification(briefing) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return; // 이미 허용된 경우만

  const title = '☀️ 오늘의 마켓 브리핑';
  const body = briefing.summary || '시그널과 시장 현황을 확인하세요.';

  new Notification(title, {
    body,
    icon: '/icon-192.png',
    tag: 'morning-briefing',
  });
}

// 별도 export: 사용자 제스처 기반 권한 요청
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
