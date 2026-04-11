// api/signal-accuracy.js — 시그널 적중률 기록/조회 API
// POST: 시그널 발화 기록 (record_signal_batch RPC)
// GET:  적중률 조회 (signal_accuracy 뷰)
//
// 인증 모델: anon 키만 사용. 쓰기 경로는 SECURITY DEFINER RPC가
//           RLS를 우회하면서 페이로드를 검증한다 (#102).

export const config = { runtime: 'edge' };

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function callRpc(name, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return res;
}

async function fetchAccuracyView() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/signal_accuracy?select=*`, {
    headers: supabaseHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function handler(req) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(
      JSON.stringify({ error: 'supabase not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── POST: 시그널 발화 기록 ─────────────────────────────────
  if (req.method === 'POST') {
    // 허용 Origin:
    //   1) 프로덕션: https://market-dashboard-v5.vercel.app
    //   2) 프리뷰:   https://market-dashboard-v5-*.vercel.app (이 프로젝트의 preview 배포만)
    //   3) 로컬 개발: http://localhost:* / http://127.0.0.1:*
    //   4) x-cron-secret 일치 (서버 간 호출)
    // `includes('vercel.app')` 같은 substring 매칭은 evil.vercel.app.com 도 통과시키므로
    // 정규식 suffix 매칭으로 교체.
    const origin = req.headers.get('origin') || '';
    const cronSecret = req.headers.get('x-cron-secret') || '';
    const hasSecret = cronSecret && cronSecret === (process.env.CRON_SECRET || '');
    const originAllowed =
      origin === 'https://market-dashboard-v5.vercel.app' ||
      /^https:\/\/market-dashboard-v5(-[a-z0-9-]+)?\.vercel\.app$/.test(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (!originAllowed && !hasSecret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 403 });
    }

    let signals;
    try {
      signals = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
    }
    if (!Array.isArray(signals) || !signals.length) {
      return new Response(JSON.stringify({ error: 'signals array required' }), { status: 400 });
    }

    // 클라이언트 페이로드 → DB 컬럼명으로 정규화 (RPC 내부에서 다시 검증)
    const rows = signals.slice(0, 50).map((s) => ({
      signal_type: s.type,
      symbol: s.symbol,
      market: s.market || 'unknown',
      direction: s.direction || 'neutral',
      strength: s.strength || 1,
      title: s.title || '',
      price_at_fire: s.priceAtFire ?? null,
      meta: s.meta || {},
    }));

    try {
      const res = await callRpc('record_signal_batch', { signals: rows });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return new Response(
          JSON.stringify({ error: 'db write failed', status: res.status, detail: detail.slice(0, 200) }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
      // RPC는 {inserted, skipped} jsonb를 돌려준다.
      const payload = await res.json().catch(() => ({}));
      const inserted = Number(payload?.inserted ?? 0);
      const skipped = Number(payload?.skipped ?? 0);
      return new Response(
        JSON.stringify({ ok: true, inserted, skipped, requested: rows.length }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || 'rpc failed' }), { status: 500 });
    }
  }

  // ── GET: 적중률 조회 ──────────────────────────────────────
  try {
    const accuracy = await fetchAccuracyView();
    return new Response(JSON.stringify({ accuracy: accuracy || [], ts: Date.now() }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch {
    return new Response(JSON.stringify({ accuracy: [], ts: Date.now() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
