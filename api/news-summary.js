// api/news-summary.js — Gemini 기반 뉴스 요약 Vercel Edge Function
// GET /api/news-summary?url=<기사URL>&fallback=<RSS_description>
export const config = { runtime: 'edge' };

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

// 기사 HTML 크롤 후 텍스트 추출
async function fetchArticleText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const html = await res.text();
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);
}

// Gemini로 요약
async function summarize(text) {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `다음 뉴스 기사를 투자자 관점에서 핵심만 3문장 이내 한국어로 요약해주세요. 숫자와 주요 종목명을 유지해주세요:\n\n${text}`,
        }],
      }],
      generationConfig: { maxOutputTokens: 250, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const url      = searchParams.get('url');
  const fallback = searchParams.get('fallback') || '';

  if (!url) {
    return new Response(JSON.stringify({ error: 'url required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ summary: null, error: 'no gemini key' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 기사 크롤 시도 → 실패 시 RSS fallback 텍스트 사용
    let text = fallback;
    try {
      text = await fetchArticleText(url);
    } catch { /* 크롤 실패 — fallback 유지 */ }

    if (!text || text.length < 30) {
      return new Response(JSON.stringify({ summary: null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const summary = await summarize(text);
    return new Response(JSON.stringify({ summary }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    // 에러 시에도 200 반환 — 클라이언트는 summary:null 처리
    return new Response(JSON.stringify({ summary: null, error: e.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
