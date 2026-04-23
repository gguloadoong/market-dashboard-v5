// crons/update-ai-debate.js — AI 종목토론 일일 pre-generation
// 매일 KST 06:00 (UTC 21:00 전날) — 국장 20 + 미장 20 + 코인 10 = 50종목
// Gemini 2.5 Flash Lite → Redis TTL 25h
// 유저 수 무관 — 하루 50회 고정 (무료 티어 1,500회/일의 3.3%)

import { getRedis, recordCronFailure } from '../price-cache.js';

const DEBATE_TTL = 90000; // 25시간

const TOP_SYMBOLS = [
  // 국장 상위 20
  { symbol: '005930', name: '삼성전자', market: 'kr' },
  { symbol: '000660', name: 'SK하이닉스', market: 'kr' },
  { symbol: '005380', name: '현대차', market: 'kr' },
  { symbol: '000270', name: '기아', market: 'kr' },
  { symbol: '373220', name: 'LG에너지솔루션', market: 'kr' },
  { symbol: '207940', name: '삼성바이오로직스', market: 'kr' },
  { symbol: '068270', name: '셀트리온', market: 'kr' },
  { symbol: '035720', name: '카카오', market: 'kr' },
  { symbol: '035420', name: 'NAVER', market: 'kr' },
  { symbol: '006400', name: '삼성SDI', market: 'kr' },
  { symbol: '051910', name: 'LG화학', market: 'kr' },
  { symbol: '105560', name: 'KB금융', market: 'kr' },
  { symbol: '055550', name: '신한지주', market: 'kr' },
  { symbol: '066570', name: 'LG전자', market: 'kr' },
  { symbol: '003550', name: 'LG', market: 'kr' },
  { symbol: '028260', name: '삼성물산', market: 'kr' },
  { symbol: '012330', name: '현대모비스', market: 'kr' },
  { symbol: '000810', name: '삼성화재', market: 'kr' },
  { symbol: '032830', name: '삼성생명', market: 'kr' },
  { symbol: '096770', name: 'SK이노베이션', market: 'kr' },
  // 미장 상위 20
  { symbol: 'AAPL', name: 'Apple', market: 'us' },
  { symbol: 'MSFT', name: 'Microsoft', market: 'us' },
  { symbol: 'NVDA', name: 'NVIDIA', market: 'us' },
  { symbol: 'GOOGL', name: 'Alphabet', market: 'us' },
  { symbol: 'AMZN', name: 'Amazon', market: 'us' },
  { symbol: 'META', name: 'Meta', market: 'us' },
  { symbol: 'TSLA', name: 'Tesla', market: 'us' },
  { symbol: 'JPM', name: 'JPMorgan', market: 'us' },
  { symbol: 'AVGO', name: 'Broadcom', market: 'us' },
  { symbol: 'TSM', name: 'TSMC', market: 'us' },
  { symbol: 'AMD', name: 'AMD', market: 'us' },
  { symbol: 'NFLX', name: 'Netflix', market: 'us' },
  { symbol: 'V', name: 'Visa', market: 'us' },
  { symbol: 'UNH', name: 'UnitedHealth', market: 'us' },
  { symbol: 'XOM', name: 'ExxonMobil', market: 'us' },
  { symbol: 'ORCL', name: 'Oracle', market: 'us' },
  { symbol: 'WMT', name: 'Walmart', market: 'us' },
  { symbol: 'PLTR', name: 'Palantir', market: 'us' },
  { symbol: 'ARM', name: 'ARM Holdings', market: 'us' },
  { symbol: 'CRM', name: 'Salesforce', market: 'us' },
  // 코인 상위 10
  { symbol: 'BTC', name: '비트코인', market: 'crypto' },
  { symbol: 'ETH', name: '이더리움', market: 'crypto' },
  { symbol: 'XRP', name: '리플', market: 'crypto' },
  { symbol: 'SOL', name: '솔라나', market: 'crypto' },
  { symbol: 'BNB', name: '바이낸스코인', market: 'crypto' },
  { symbol: 'DOGE', name: '도지코인', market: 'crypto' },
  { symbol: 'ADA', name: '에이다', market: 'crypto' },
  { symbol: 'AVAX', name: '아발란체', market: 'crypto' },
  { symbol: 'DOT', name: '폴카닷', market: 'crypto' },
  { symbol: 'LINK', name: '체인링크', market: 'crypto' },
];

const GEMINI_MODELS = [
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
];

async function generateOne(symbol, name, market, geminiKey) {
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
      const res = await fetch(`${modelUrl}?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      if (!res.ok) continue;

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) continue;

      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed?.messages) || parsed.messages.length < 2) continue;

      return {
        symbol, name,
        model: modelUrl.split('/models/')[1]?.split(':')[0] ?? 'gemini',
        ...parsed,
        _generatedAt: new Date().toISOString(),
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function updateAiDebate(env) {
  const geminiKey = env.GEMINI_API_KEY;
  if (!geminiKey) return { skipped: true, reason: 'GEMINI_API_KEY not set' };

  const redis = getRedis();
  if (!redis) return { skipped: true, reason: 'Redis not initialized' };

  let ok = 0, fail = 0;

  for (const { symbol, name, market } of TOP_SYMBOLS) {
    try {
      const result = await generateOne(symbol, name, market, geminiKey);
      if (result) {
        await redis.set(`ai:debate:${symbol}`, JSON.stringify(result), { ex: DEBATE_TTL });
        ok++;
      } else {
        fail++;
      }
    } catch (e) {
      console.warn(`[ai-debate-cron] ${symbol} 실패:`, e.message);
      fail++;
    }
    // 15 RPM 안전 — 4초 간격 (15회/분 = 4초/회)
    await new Promise(r => setTimeout(r, 4000));
  }

  if (fail > ok) {
    await recordCronFailure(env, 'update-ai-debate', `ok=${ok} fail=${fail}`);
  }

  return { ok, fail, total: TOP_SYMBOLS.length };
}
