// AI 종목토론 — Gemini API (Edge, 무료 tier 활용)
// primary: gemini-2.5-flash-lite, fallback: gemini-2.5-flash
export const config = { runtime: 'edge' };

const GEMINI_MODELS = [
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
];

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_KEY not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const { s: symbol, ctx = {} } = body;
  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 });
  }

  const { name = symbol, price, changePct, market = 'us' } = ctx;
  const priceStr = price ? `현재가 ${market === 'kr' ? price.toLocaleString() + '원' : '$' + price}` : '';
  const changeStr = changePct != null ? ` (${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%)` : '';

  const prompt = `종목: ${name} (${symbol})${priceStr ? ', ' + priceStr : ''}${changeStr}

이 종목에 대해 강세론과 약세론을 각각 3줄로 제시하고, 종합 의견을 1줄로 작성해주세요.

JSON 형식으로만 응답:
{
  "bull": "강세 근거 (3줄, 각 근거를 • 로 구분)",
  "bear": "약세 근거 (3줄, 각 근거를 • 로 구분)",
  "verdict": "종합 의견 1줄",
  "confidence": 0.0~1.0 숫자 (강세 확신도)
}`;

  for (const modelUrl of GEMINI_MODELS) {
    try {
      const res = await fetch(`${modelUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(20000),
      });

      // rate limit → 다음 모델 시도
      if (res.status === 429) continue;

      if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ error: `gemini_api: ${res.status}`, detail: errText }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      // JSON 파싱 시도
      let parsed;
      try {
        const match = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(match?.[0] ?? text);
      } catch {
        parsed = { bull: text, bear: '', verdict: '', confidence: 0.5 };
      }

      return new Response(JSON.stringify({ symbol, ...parsed }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=1800',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      // 타임아웃 등 → 다음 모델 시도
      if (GEMINI_MODELS.indexOf(modelUrl) === GEMINI_MODELS.length - 1) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
  }

  return new Response(JSON.stringify({ error: 'all models failed' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' },
  });
}
