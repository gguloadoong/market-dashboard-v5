// api/cron/whale-telegram.js — 텔레그램 고래 알림 폴링 Edge Cron (2분 간격)
// Telegram Bot API getUpdates로 Whale Alert 채널 메시지 수집 → Redis 저장
export const config = { runtime: 'edge' };

import { setSnap, getSnap, recordCronFailure } from '../_price-cache.js';

const SNAP_KEY = 'snap:whale:telegram';
const SNAP_TTL = 600; // 10분 (크론 2분 × 5)
const OFFSET_KEY = 'whale:telegram:offset'; // 마지막 처리된 update_id

// 알려진 거래소 이름 목록 — movementType 결정에 사용
const KNOWN_EXCHANGES = new Set([
  'binance', 'coinbase', 'kraken', 'bitfinex', 'huobi', 'okex', 'okx',
  'kucoin', 'bybit', 'gemini', 'bitstamp', 'bittrex', 'upbit', 'bithumb',
  'gate.io', 'crypto.com', 'ftx', 'poloniex', 'mexc', 'bitget',
]);

/**
 * 텔레그램 메시지 파싱
 * 포맷: "🚨 1,000 #BTC (64,532,000 USD) transferred from #Binance to unknown wallet"
 */
function parseWhaleMessage(text) {
  if (!text) return null;

  // 정규식: 수량, 심볼, USD 금액, from, to 추출
  const re = /(\d[\d,]*(?:\.\d+)?)\s+#(\w+)\s+\((\d[\d,]*(?:\.\d+)?)\s+USD\)\s+transferred\s+from\s+(.+?)\s+to\s+(.+?)$/i;
  const match = text.match(re);
  if (!match) return null;

  const amount = parseFloat(match[1].replace(/,/g, ''));
  const symbol = match[2].toUpperCase();
  const usdAmount = parseFloat(match[3].replace(/,/g, ''));
  const fromRaw = match[4].trim();
  const toRaw = match[5].trim();

  // 거래소 판별 — #이름 또는 알려진 거래소명
  const from = fromRaw.replace(/^#/, '');
  const to = toRaw.replace(/^#/, '');
  const fromIsExchange = KNOWN_EXCHANGES.has(from.toLowerCase());
  const toIsExchange = KNOWN_EXCHANGES.has(to.toLowerCase());

  // movementType 결정
  let movementType = 'transfer';
  if (fromIsExchange && !toIsExchange) {
    movementType = 'exchange_withdrawal';
  } else if (!fromIsExchange && toIsExchange) {
    movementType = 'exchange_deposit';
  }

  return {
    symbol,
    amount,
    tradeUsd: usdAmount,
    from,
    to,
    movementType,
    ts: Date.now(),
  };
}

export default async function handler(request) {
  // Vercel Cron Bearer 인증
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_token' }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    // Redis에서 마지막 offset 조회
    const lastOffset = await getSnap(OFFSET_KEY);
    const offsetParam = lastOffset ? `&offset=${Number(lastOffset) + 1}` : '';

    // Telegram Bot API getUpdates
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=100&timeout=0${offsetParam}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) throw new Error(`Telegram API HTTP ${res.status}`);
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.result)) {
      throw new Error(`Telegram API error: ${data.description || 'unknown'}`);
    }

    // 기존 이벤트 로드 (누적)
    const existing = (await getSnap(SNAP_KEY)) || [];
    const events = Array.isArray(existing) ? [...existing] : [];

    let maxUpdateId = lastOffset ? Number(lastOffset) : 0;

    for (const update of data.result) {
      if (update.update_id > maxUpdateId) {
        maxUpdateId = update.update_id;
      }

      // channel_post 또는 message에서 텍스트 추출
      const msg = update.channel_post || update.message;
      if (!msg?.text) continue;

      const parsed = parseWhaleMessage(msg.text);
      if (!parsed) continue;

      events.push(parsed);
    }

    // 최근 50개만 유지 (오래된 이벤트 제거)
    const trimmed = events.slice(-50);

    // Redis 저장
    await setSnap(SNAP_KEY, trimmed, SNAP_TTL);

    // offset 저장 (TTL 없음 — 영구 보관하되 Redis 메모리 부담 미미)
    if (maxUpdateId > 0) {
      await setSnap(OFFSET_KEY, maxUpdateId, 86400); // 24시간 TTL
    }

    return new Response(JSON.stringify({ ok: true, newUpdates: data.result.length, totalEvents: trimmed.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    try { await recordCronFailure('whale-telegram', String(err?.message || err)); } catch (_) { /* 무시 */ }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
