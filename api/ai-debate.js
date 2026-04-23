// AI 종목토론 — Gemini API (Edge)
// primary: gemini-2.5-flash-lite, fallback: gemini-1.5-flash
// GET /api/ai-debate?s=AAPL
// Redis TTL 25h — 크론 pre-gen으로 대부분 cache hit
export const config = { runtime: 'edge' };

import { redis } from './_price-cache.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = [
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
];

const DEBATE_TTL = 90000; // 25시간 — 크론 daily 주기 커버

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
    });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get('s');
  const name = url.searchParams.get('n') || symbol;
  const market = url.searchParams.get('m') || 'us';

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 });
  }

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Redis 캐시 조회 — 크론 pre-gen 결과 또는 이전 실시간 생성 결과
  const cacheKey = `ai:debate:${symbol}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'HIT',
          },
        });
      }
    } catch (e) {
      console.warn('[ai-debate] Redis 조회 실패:', e.message);
    }
  }

  // 롱테일 종목 실시간 생성 — 크론이 커버 안 한 종목의 첫 클릭
  const marketLabel = market === 'kr' ? '한국 주식' : market === 'us' ? '미국 주식' : '암호화폐';
  const prompt = `${marketLabel} 종목: ${name} (${symbol})

이 종목에 대해 "살 이유"(bull) 1~2문장, "조심할 이유"(bear) 1~2문장, 종합 의견 1줄을 작성하세요.
구체적 수치, 이유, 리스크를 포함하세요. 쉬운 한국어로 작성하세요.

반드시 아래 JSON만 반환하세요 (다른 텍스트 절대 없이):
{
  "messages": [
    {"side": "bull", "text": "살 이유 1~2문장"},
    {"side": "bear", "text": "조심할 이유 1~2문장"}
  ],
  "verdict": "한국어 종합 의견 1줄",
  "confidence": 0.65
}`;

  for (const modelUrl of GEMINI_MODELS) {
    try {
      const res = await fetch(`${modelUrl}?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) continue;

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      let parsed;
      try {
        const match = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(match?.[0] ?? text);
      } catch {
        continue;
      }

      if (!parsed?.messages) continue;

      const result = {
        symbol,
        model: modelUrl.split('/models/')[1]?.split(':')[0] ?? 'gemini',
        ...parsed,
      };

      if (redis) {
        try {
          await redis.set(cacheKey, JSON.stringify(result), { ex: DEBATE_TTL });
        } catch (e) {
          console.warn('[ai-debate] Redis 저장 실패:', e.message);
        }
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'MISS',
        },
      });
    } catch (e) {
      if (e.name !== 'TimeoutError') console.warn('[ai-debate] 모델 실패:', e.message);
    }
  }

  return new Response(JSON.stringify({ error: 'all models failed' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}
