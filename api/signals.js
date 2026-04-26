// api/signals.js — 사전 계산된 시그널 조회 (KV 읽기)
// compute-signals 크론이 'signals:latest' 키에 사전 저장한 페이로드를 그대로 노출
export const config = { runtime: 'edge' };
import { getSnapWithFallback } from './_price-cache.js';

export default async function handler() {
  const data = await getSnapWithFallback('signals:latest');
  if (!data) {
    return new Response(JSON.stringify({
      ts: 0,
      generatedAt: null,
      count: 0,
      signals: [],
      stale: true,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }
  const ageMs = Date.now() - (data.ts || 0);
  // 25분 초과 시 stale (cron 10분 주기 + 여유)
  const stale = ageMs > 25 * 60 * 1000;
  return new Response(JSON.stringify({ ...data, stale }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
    },
  });
}
