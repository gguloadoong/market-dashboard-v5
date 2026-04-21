// crons/watchdog.js — CF Workers 크론 실패 조기 경보 (#164 Phase C)
// 10분마다 fire. cron:fail:* >= 3 인 크론이 있으면 Discord webhook 으로 알림.
// 같은 크론에 대해 1시간 쿨다운 (중복 알림 방지).
//
// env.DISCORD_WEBHOOK 미설정 시 조용히 skip — 코드 배포는 URL 없이도 안전.

import { getRedis } from '../price-cache.js';

const CRON_NAMES = ['coins', 'kr', 'us', 'signal-accuracy', 'briefing'];
const FAIL_THRESHOLD = 3;         // 누적 실패 3회 이상
const COOLDOWN_SEC = 3600;        // 같은 크론 재알림 쿨다운 1h
const CF_ACCOUNT_ID = '43055b37765f34c1a1d7173a46ff5b92';

export async function watchdog(env) {
  const webhookUrl = env?.DISCORD_WEBHOOK;
  if (!webhookUrl) {
    console.log('[watchdog] DISCORD_WEBHOOK 미설정 — skip');
    return { ok: false, reason: 'no-webhook' };
  }

  const redis = getRedis();
  if (!redis) {
    console.warn('[watchdog] redis 미구성 — skip');
    return { ok: false, reason: 'no-redis' };
  }

  // 5 크론 × 3 키(failCount / lastError / alertCooldown) = 15 키 한 번에 조회
  const keys = CRON_NAMES.flatMap((c) => [
    `cron:fail:${c}`,
    `cron:lastError:${c}`,
    `cron:watchdog:alert:${c}`,
  ]);

  let vals;
  try {
    vals = await redis.mget(...keys);
  } catch (e) {
    console.error('[watchdog] redis mget 실패:', e?.message || e);
    return { ok: false, reason: 'mget-failed' };
  }

  const alerts = [];
  for (let i = 0; i < CRON_NAMES.length; i++) {
    const failCount = parseInt(vals[i * 3] || '0', 10);
    const lastErrRaw = vals[i * 3 + 1];
    const cooldownActive = !!vals[i * 3 + 2];

    if (failCount < FAIL_THRESHOLD) continue;
    if (cooldownActive) continue; // 1h 쿨다운 중 — 중복 알림 생략

    let lastErrorMsg = '(unknown)';
    if (lastErrRaw) {
      try {
        const parsed = typeof lastErrRaw === 'string' ? JSON.parse(lastErrRaw) : lastErrRaw;
        lastErrorMsg = String(parsed?.error || '(parse ok, no error field)').slice(0, 150);
      } catch {
        lastErrorMsg = String(lastErrRaw).slice(0, 150);
      }
    }

    alerts.push({
      cron: CRON_NAMES[i],
      failCount,
      lastErrorMsg,
    });
  }

  if (alerts.length === 0) {
    console.log('[watchdog] 정상 — 임계치 초과 없음');
    return { ok: true, alerts: 0 };
  }

  // Discord 메시지 포맷 — 간결한 bullet list
  const dashboardUrl = `https://dash.cloudflare.com/${CF_ACCOUNT_ID}/workers/services/view/mdv5-cron`;
  const content = [
    '🟡 **CF Workers 크론 실패 감지** (최근 1h)',
    '',
    ...alerts.map(
      (a) => `• \`${a.cron}\`: **${a.failCount}회** — ${a.lastErrorMsg}`,
    ),
    '',
    `조치: [Workers 대시보드](${dashboardUrl}) 에서 tail / 로그 확인`,
  ].join('\n');

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, username: 'mdv5 watchdog' }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`Discord HTTP ${res.status}`);
    }
  } catch (e) {
    console.error('[watchdog] Discord 발송 실패:', e?.message || e);
    return { ok: false, reason: 'discord-fail', error: e?.message };
  }

  // 쿨다운 키 설정 — 다음 1h 동안 같은 크론 재알림 차단
  try {
    await Promise.all(
      alerts.map((a) =>
        redis.set(`cron:watchdog:alert:${a.cron}`, Date.now(), { ex: COOLDOWN_SEC }),
      ),
    );
  } catch (e) {
    console.warn('[watchdog] 쿨다운 키 set 실패:', e?.message || e);
    // 치명적 아님 — 알림은 이미 전송됨. 다음 주기에 중복 가능하지만 심각한 문제 아님.
  }

  console.log(`[watchdog] Discord 알림 ${alerts.length}건 발송`);
  return { ok: true, alerts: alerts.length, cronsAlerted: alerts.map((a) => a.cron) };
}
