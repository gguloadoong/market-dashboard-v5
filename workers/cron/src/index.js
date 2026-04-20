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
    // #171: 미장 샤딩 복원 — v8 개별 호출 3 샤드 병렬 (offset 2,3,4 각각 900 종목)
    // */5 → offset 0: coins
    // 1-56/5 → offset 1: kr (UTC 평일 활성 시간)
    // 2-57/5 → offset 2: us shard 0
    // 3-58/5 → offset 3: us shard 1
    // 4-59/5 → offset 4: us shard 2
    // */30 → signal accuracy, 50 23 → briefing
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
      // 미장 샤드 0: UTC 0-1,8-23 / 월~토 (EDT/EST 프리~애프터)
      const now = new Date();
      const utcH = now.getUTCHours();
      const utcD = now.getUTCDay();
      const usActive = (utcD >= 1 && utcD <= 6) && (utcH <= 1 || utcH >= 8);
      if (usActive) ctx.waitUntil(updateUs(env, 0));
    } else if (cron === '3-58/5 * * * *') {
      // 미장 샤드 1
      const now = new Date();
      const utcH = now.getUTCHours();
      const utcD = now.getUTCDay();
      const usActive = (utcD >= 1 && utcD <= 6) && (utcH <= 1 || utcH >= 8);
      if (usActive) ctx.waitUntil(updateUs(env, 1));
    } else if (cron === '4-59/5 * * * *') {
      // 미장 샤드 2
      const now = new Date();
      const utcH = now.getUTCHours();
      const utcD = now.getUTCDay();
      const usActive = (utcD >= 1 && utcD <= 6) && (utcH <= 1 || utcH >= 8);
      if (usActive) ctx.waitUntil(updateUs(env, 2));
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
      if (path === '/update-us') {
        const shardId = parseInt(url.searchParams.get('shard') || '0', 10);
        return Response.json(await updateUs(env, shardId));
      }
      if (path === '/check-signal') return Response.json(await checkSignalAccuracy(env));
      if (path === '/briefing') return Response.json(await morningBriefing(env));
      return new Response('mdv5-cron worker', { status: 200 });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }
};
