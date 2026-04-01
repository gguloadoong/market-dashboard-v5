// AI 종목토론 — Claude API 직접 호출 (Edge, 30s 타임아웃)
export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `claude_api: ${res.status}`, detail: errText }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';

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
    return new Response(JSON.stringify({ error: e.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
