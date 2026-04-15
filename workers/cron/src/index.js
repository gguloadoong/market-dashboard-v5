import { initRedis } from './price-cache.js';
import { updateCoins } from './crons/update-coins.js';
import { updateKr } from './crons/update-kr.js';
import { updateUs } from './crons/update-us.js';
import { checkSignalAccuracy } from './crons/check-signal-accuracy.js';
import { morningBriefing } from './crons/morning-briefing.js';

export default {
  async scheduled(event, env, ctx) {
    initRedis(env);
    const cron = event.cron;

    // #125: 크론 분리 — invocation당 단일 task만 실행 (subrequest 50 한계 회피)
    // */5 offset 0 → coins / offset 1 → kr / offset 2 → us
    // */30 → 시그널 적중 검증, 50 23 → 모닝 브리핑
    if (cron === '*/5 * * * *') {
      ctx.waitUntil(updateCoins(env));
    } else if (cron === '1-56/5 * * * *') {
      // 국장: UTC 0-11,23 / 일~금 (KST 08:00~20:00 평일)
      const now = new Date();
      const utcH = now.getUTCHours();
      const utcD = now.getUTCDay();
      const krActive = (utcD >= 0 && utcD <= 5) && (utcH <= 11 || utcH === 23);
      if (krActive) ctx.waitUntil(updateKr(env));
    } else if (cron === '2-57/5 * * * *') {
      // 미장: UTC 0-1,8-23 / 월~토 (EDT/EST 프리~애프터)
      const now = new Date();
      const utcH = now.getUTCHours();
      const utcD = now.getUTCDay();
      const usActive = (utcD >= 1 && utcD <= 6) && (utcH <= 1 || utcH >= 8);
      if (usActive) ctx.waitUntil(updateUs(env));
    } else if (cron === '*/30 * * * *') {
      ctx.waitUntil(checkSignalAccuracy(env));
    } else if (cron === '50 23 * * *') {
      ctx.waitUntil(morningBriefing(env));
    }
  },

  // HTTP handler for manual testing
  async fetch(request, env) {
    initRedis(env);
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/update-coins') return Response.json(await updateCoins(env));
      if (path === '/update-kr') return Response.json(await updateKr(env));
      if (path === '/update-us') return Response.json(await updateUs(env));
      if (path === '/check-signal') return Response.json(await checkSignalAccuracy(env));
      if (path === '/briefing') return Response.json(await morningBriefing(env));
      return new Response('mdv5-cron worker', { status: 200 });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }
};
