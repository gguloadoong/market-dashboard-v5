// api/ops/cron-status.js — 크론 실패 카운트 조회 (#164 Phase A + B)
// 두 가지 모드:
//   (1) 공개 모드 (토큰 없음): 각 크론의 failCount + healthy 불린만 반환. UI 뱃지용.
//   (2) 토큰 모드 (x-ops-token=OPS_SECRET/CRON_SECRET): lastError 상세 포함. CLI 디버깅용.
//
// 공개 모드는 에러 메시지 등 내부 구조 노출 가능한 정보 미포함 —
// 클라이언트 번들에 토큰 심지 않아도 안전.
export const config = { runtime: 'edge' };

import { Redis } from '@upstash/redis';

const CRON_NAMES = ['coins', 'kr', 'us', 'signal-accuracy', 'briefing'];
const HEALTHY_THRESHOLD = 3; // failCount >= 3 이면 unhealthy

export default async function handler(request) {
  const auth = (process.env.OPS_SECRET || process.env.CRON_SECRET || '').trim();
  const token = (request.headers.get('x-ops-token') || '').trim();
  const hasDetailAccess = !!auth && token === auth;

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !kvToken) {
    return new Response(JSON.stringify({ error: 'redis 미구성' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const redis = new Redis({ url, token: kvToken });

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
    const failCount = parseInt(vals[i * 2] || '0', 10);
    const entry = {
      failCount,
      healthy: failCount < HEALTHY_THRESHOLD,
    };
    if (hasDetailAccess) {
      const raw = vals[i * 2 + 1];
      let lastError = null;
      if (raw) {
        try {
          lastError = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch { lastError = { parseError: true, raw: String(raw).slice(0, 200) }; }
      }
      entry.lastError = lastError;
    }
    result[CRON_NAMES[i]] = entry;
  }

  return new Response(JSON.stringify({
    ts: new Date().toISOString(),
    mode: hasDetailAccess ? 'detail' : 'public',
    crons: result,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // 공개 응답 30초 CDN 캐시 — 같은 상태 브라우저 탭 다수 호출 부하 감소
      'Cache-Control': 'public, max-age=0, s-maxage=30',
    },
  });
}
