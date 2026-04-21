// api/ops/cron-status.js — 크론 실패 카운트 + 마지막 에러 조회 (#164 Phase A)
// 인증: x-ops-token 헤더 = OPS_SECRET (fallback: CRON_SECRET). 내부 관측 전용.
// 응답: { ts, crons: { coins: { failCount, lastError }, kr: {...}, ... } }
export const config = { runtime: 'edge' };

import { Redis } from '@upstash/redis';

const CRON_NAMES = ['coins', 'kr', 'us', 'signal-accuracy', 'briefing'];

export default async function handler(request) {
  const auth = (process.env.OPS_SECRET || process.env.CRON_SECRET || '').trim();
  const token = (request.headers.get('x-ops-token') || '').trim();

  if (!auth) {
    return new Response(JSON.stringify({ error: 'server misconfigured: OPS_SECRET/CRON_SECRET 미설정' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (token !== auth) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !kvToken) {
    return new Response(JSON.stringify({ error: 'redis 미구성' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const redis = new Redis({ url, token: kvToken });

  // 5개 크론 × 2 키(failCount + lastError) = 10 키 한 번에 조회
  const keys = CRON_NAMES.flatMap((c) => [`cron:fail:${c}`, `cron:lastError:${c}`]);
  let vals;
  try {
    vals = await redis.mget(...keys);
  } catch (e) {
    return new Response(JSON.stringify({ error: `redis mget 실패: ${String(e?.message || e)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = {};
  for (let i = 0; i < CRON_NAMES.length; i++) {
    const raw = vals[i * 2 + 1];
    let lastError = null;
    if (raw) {
      try {
        lastError = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch { lastError = { parseError: true, raw: String(raw).slice(0, 200) }; }
    }
    result[CRON_NAMES[i]] = {
      failCount: parseInt(vals[i * 2] || '0', 10),
      lastError,
    };
  }

  return new Response(JSON.stringify({ ts: new Date().toISOString(), crons: result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
