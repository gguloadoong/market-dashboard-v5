// api/ops/pattern-cron-status.js — Vercel 패턴 크론 공개 진단 (#390)
// 대상: api/cron/compute-signals.js (schedule '20 * * * *' hourly #398, SR/DB+composite → signal_history).
// 목적: 시크릿 없이 다음 발화의 "발화여부 / 패턴탐지수 / 기록수 / 실패사유"를 검증.
//   - CF Worker 'compute-signals'(composite, 10분)와 키 분리된 'pattern-cron' 네임스페이스를 읽는다.
//   - 공개 응답엔 통제된 진단 필드(summary)만 노출. raw lastError(자유 메시지)는 비노출 — 토큰 유출/내부구조 노출 회피.
// _price-cache import 회피(Edge 런타임 추론 안정) — cron-status.js처럼 @upstash/redis 직접 사용.
export const config = { runtime: 'edge' };

import { Redis } from '@upstash/redis';

export default async function handler() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: 'redis 미구성' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const redis = new Redis({ url, token });

  let lastOk, summary, failCount;
  try {
    [lastOk, summary, failCount] = await redis.mget(
      'cron:lastOk:pattern-cron',
      'cron:summary:pattern-cron',
      'cron:fail:pattern-cron',
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: `redis mget 실패: ${String(e?.message || e)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lastOkMs = Number(lastOk) || null;
  const ageMinutes = lastOkMs ? Math.round((Date.now() - lastOkMs) / 60000) : null;

  return new Response(JSON.stringify({
    ts: new Date().toISOString(),
    cron: 'pattern-cron (api/cron/compute-signals.js, schedule 20 * * * *)',
    fired: lastOkMs != null,                                  // 하트비트 존재 → 발화 확정
    lastOk: lastOkMs ? new Date(lastOkMs).toISOString() : null,
    ageMinutes,                                               // null/과도하게 큼 → 미발화 의심
    failCount: parseInt(failCount || '0', 10),                // >0 → recordPatternSignals 실패(사유는 summary.postError)
    summary: summary ?? null,                                 // fetchedCount/patternCandidates/recorded/postError/failedSample
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, s-maxage=30',
    },
  });
}
