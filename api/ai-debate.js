// AI 종목토론 — Groq API (Edge, 무료 tier, 초고속)
// primary: llama-3.3-70b-versatile, fallback: llama-3.1-8b-instant
export const config = { runtime: 'edge' };

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
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

이 종목에 대해 강세파와 약세파가 실제 토론처럼 3라운드 주고받으세요.
강세파가 먼저 1~2문장 주장 → 약세파가 반론. 총 6개 메시지.

반드시 아래 JSON만 반환하세요 (다른 텍스트 절대 없이):
{
  "messages": [
    {"side": "bull", "text": "강세 주장 (1~2문장, 구체적 수치나 이유 포함)"},
    {"side": "bear", "text": "약세 반론 (1~2문장, 구체적 반론)"},
    {"side": "bull", "text": "강세 재반론"},
    {"side": "bear", "text": "약세 재반론"},
    {"side": "bull", "text": "강세 마지막 주장"},
    {"side": "bear", "text": "약세 마지막 반론"}
  ],
  "verdict": "한국어 종합 의견 1줄",
  "confidence": 0.65
}`;

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(15000),
      });

      // rate limit → 다음 모델 시도
      if (res.status === 429) continue;

      if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ error: `groq_api: ${res.status}`, detail: errText }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? '';

      let parsed;
      try {
        const match = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(match?.[0] ?? text);
        // 구 형식(bull/bear 문자열) → messages 배열로 변환
        if (!parsed.messages && (parsed.bull || parsed.bear)) {
          parsed.messages = [
            ...(parsed.bull ? [{ side: 'bull', text: parsed.bull }] : []),
            ...(parsed.bear ? [{ side: 'bear', text: parsed.bear }] : []),
          ];
        }
      } catch {
        parsed = { messages: [{ side: 'bull', text }], verdict: '', confidence: 0.5 };
      }

      return new Response(JSON.stringify({ symbol, model, ...parsed }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=1800',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      if (model === GROQ_MODELS[GROQ_MODELS.length - 1]) {
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
