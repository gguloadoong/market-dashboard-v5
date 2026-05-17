// api/cron-health.js — CF Workers 크론 상태 읽기 전용 엔드포인트 (#298)
// GET /api/cron-health → { ok, ts, crons: { <name>: { failCount, lastOk, lastError } } }
// ok=false 조건: 하나 이상의 크론이 failCount >= 3

import { Redis } from '@upstash/redis';

const CRON_NAMES = ['coins', 'kr', 'us', 'signal-accuracy', 'briefing', 'compute-signals'];
const FAIL_THRESHOLD = 3;

function getRedis() {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(503).json({ error: 'redis-unavailable' });
  }

  // 6크론 × 3키 = 18키 — mget으로 한 번에 조회
  const keys = CRON_NAMES.flatMap((c) => [
    `cron:fail:${c}`,
    `cron:lastOk:${c}`,
    `cron:lastError:${c}`,
  ]);

  let vals;
  try {
    vals = await redis.mget(...keys);
  } catch (e) {
    return res.status(503).json({ error: 'redis-mget-failed', detail: e?.message });
  }

  const crons = {};
  let anyFailing = false;

  for (let i = 0; i < CRON_NAMES.length; i++) {
    const name = CRON_NAMES[i];
    const failRaw    = vals[i * 3];
    const lastOkRaw  = vals[i * 3 + 1];
    const lastErrRaw = vals[i * 3 + 2];

    const failCount = parseInt(failRaw || '0', 10);
    const lastOk    = lastOkRaw !== null ? parseInt(lastOkRaw, 10) : null;

    let lastError = null;
    if (lastErrRaw !== null) {
      try {
        lastError = typeof lastErrRaw === 'string' ? JSON.parse(lastErrRaw) : lastErrRaw;
      } catch {
        lastError = { error: String(lastErrRaw).slice(0, 200) };
      }
    }

    if (failCount >= FAIL_THRESHOLD) anyFailing = true;

    crons[name] = { failCount, lastOk, lastError };
  }

  return res.status(anyFailing ? 200 : 200).json({
    ok: !anyFailing,
    ts: Date.now(),
    crons,
  });
}
