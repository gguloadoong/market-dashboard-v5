// Vercel 크론 브릿지 (#406) — Vercel 스케줄러가 Deployment Protection 401에 막혀
// 개설 이래 한 번도 자동 실행되지 않은 크론을, 검증된 CF 스케줄러가 공개 도메인으로 대신 호출한다.
// (공개 도메인은 보호 대상 아님 — 실측 200. x-vercel-cron 헤더는 수동발화 검증에 쓰인 경로 그대로.)
// 발화 검증: GET /api/ops/pattern-cron-status → lastOk 갱신.

const ORIGIN = 'https://market-dashboard-v5.vercel.app';
const TIMEOUT_MS = 50_000; // health-check가 RSS 다수 점검 — 여유 타임아웃

export async function bridgeVercelCron(path) {
  const url = `${ORIGIN}${path}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-vercel-cron': '1' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`[vercel-bridge] ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
      return { ok: false, status: res.status };
    }
    console.log(`[vercel-bridge] ${path} ok: ${body.slice(0, 200)}`);
    return { ok: true, status: res.status };
  } catch (e) {
    console.error(`[vercel-bridge] ${path} 실패:`, e?.message || e);
    return { ok: false, error: e?.message };
  }
}
