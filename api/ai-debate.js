// AI 종목토론 — Groq API (Edge, 무료 tier, 초고속)
// primary: llama-3.3-70b-versatile, fallback: llama-3.1-8b-instant
// Redis 서버 캐시: 동일 종목 토론은 1회만 생성, 전체 사용자 공유 (TTL 30분)
export const config = { runtime: 'edge' };

import { redis } from './_price-cache.js';

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

const DEBATE_TTL = 1800; // 30분 — 종목별 캐시

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

  // ── Redis 캐시 조회 — 동일 종목은 서버에서 1회만 생성, 전체 사용자 공유 ──
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
            'Cache-Control': 'public, max-age=1800',
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'HIT',
          },
        });
      }
    } catch (e) {
      console.warn('[ai-debate] Redis 조회 실패, Groq 직접 호출:', e.message);
    }
  }

  const { name = symbol, price, changePct, market = 'us' } = ctx;
  const priceStr = price ? `현재가 ${market === 'kr' ? price.toLocaleString() + '원' : '$' + price}` : '';
  const changeStr = changePct != null ? ` (${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%)` : '';

  // ADR-016: 3라운드 채팅 → "살 이유 vs 조심할 이유" 2줄 요약 (토큰 60% 절감)
  const prompt = `종목: ${name} (${symbol})${priceStr ? ', ' + priceStr : ''}${changeStr}

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
          max_tokens: 256,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(15000),
      });

      // 429(레이트 리밋)·5xx(서버 일시 오류) → 다음 모델 fallback
      if (res.status === 429 || res.status >= 500) continue;

      // 4xx(인증·요청 오류) → 재시도 무의미, 에러 컨텍스트 보존 후 즉시 반환
      if (!res.ok) {
        const errText = await res.text();
        return new Response(
          JSON.stringify({ error: `groq_api: ${res.status}`, detail: errText }),
          { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' } }
        );
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
        // LLM이 메시지 text 안에 전체 JSON을 삽입한 경우 감지 → 재파싱 (단일 depth)
        // inner JSON이 실제 응답이므로 messages/verdict/confidence 모두 복구
        let innerResult = null;
        for (const msg of (parsed.messages ?? [])) {
          const innerText = (msg?.text ?? '').trim();
          if (!innerText.startsWith('{')) continue;
          try {
            let inner;
            try {
              inner = JSON.parse(innerText);
            } catch {
              const m = innerText.match(/\{[\s\S]*\}/);
              if (!m) continue;
              inner = JSON.parse(m[0]);
            }
            if (Array.isArray(inner?.messages) && inner.messages.length >= 2) {
              innerResult = inner;
              break;
            }
          } catch (e) {
            console.warn('[ai-debate] inner JSON reparse failed:', e?.message);
          }
        }
        if (innerResult) {
          // 화이트리스트 필드만 병합 — prototype 오염 방지
          parsed = {
            ...parsed,
            messages: innerResult.messages,
            ...(innerResult.verdict  != null && { verdict:    innerResult.verdict }),
            ...(innerResult.confidence != null && { confidence: innerResult.confidence }),
          };
        }
      } catch {
        parsed = { messages: [{ side: 'bull', text }], verdict: '', confidence: 0.5 };
      }

      const result = { symbol, model, ...parsed };

      // ── Redis 캐시 저장 — 다음 요청부터 Groq 호출 없이 즉시 반환 ──
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
          'Cache-Control': 'public, max-age=1800',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'MISS',
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
