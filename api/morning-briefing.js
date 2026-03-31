// api/morning-briefing.js — 모닝 브리핑 API (Vercel Edge Function)
// 매일 KST 08:50 (UTC 23:50) cron 호출 또는 클라이언트 직접 호출
// 시장 지수 + F&G 지수 + 시그널 요약을 JSON으로 반환
export const config = { runtime: 'edge' };

// ─── 시장 지수 조회 (market-indices.js 패턴) ────────────────────
async function fetchIndex(_id, symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result?.meta?.regularMarketPrice) return null;
  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close?.filter(Boolean) ?? [];
  const price = meta.regularMarketPrice;
  const almostEqual = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) < 0.0001;
  let prev = meta.previousClose;
  if (!prev || almostEqual(prev, price)) {
    for (let i = closes.length - 2; i >= 0; i--) {
      if (closes[i] && !almostEqual(closes[i], price)) { prev = closes[i]; break; }
    }
  }
  if (!prev) prev = price;
  const change = parseFloat(((price - prev) / prev * 100).toFixed(2));
  return { close: parseFloat(price.toFixed(2)), change };
}

// ─── CNN F&G 지수 조회 (fear-greed.js 패턴) ─────────────────────
async function fetchCnnFearGreed() {
  try {
    const res = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json', 'Referer': 'https://edition.cnn.com/' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const fg = data?.fear_and_greed;
    if (fg?.score == null) return null;
    const score = Math.round(fg.score);
    return { value: score, label: labelFromScore(score) };
  } catch {
    return null;
  }
}

// ─── 크립토 F&G (alternative.me) ─────────────────────────────────
async function fetchCryptoFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.data?.[0];
    if (!item) return null;
    const value = parseInt(item.value, 10);
    return { value, label: item.value_classification || labelFromScore(value) };
  } catch {
    return null;
  }
}

// ─── BTC 가격 (Binance) ──────────────────────────────────────────
async function fetchBtcPrice() {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const price = parseFloat(data.lastPrice);
    const change = parseFloat(data.priceChangePercent);
    return { price: Math.round(price), change: parseFloat(change.toFixed(2)) };
  } catch {
    return null;
  }
}

// ─── 점수 → 라벨 ────────────────────────────────────────────────
function labelFromScore(score) {
  if (score <= 20) return '극도의 공포';
  if (score <= 40) return '공포';
  if (score <= 60) return '중립';
  if (score <= 80) return '탐욕';
  return '극도의 탐욕';
}

// ─── 변동 방향 텍스트 ────────────────────────────────────────────
function changeText(change) {
  if (change > 0) return `+${change}%`;
  if (change < 0) return `${change}%`;
  return '보합';
}

// ─── Handler ─────────────────────────────────────────────────────
export default async function handler(req) {
  try {
    // 병렬 호출
    const [kospiRes, nasdaqRes, btcRes, usFgRes, cryptoFgRes] = await Promise.allSettled([
      fetchIndex('KOSPI', '^KS11'),
      fetchIndex('NASDAQ', '^IXIC'),
      fetchBtcPrice(),
      fetchCnnFearGreed(),
      fetchCryptoFearGreed(),
    ]);

    const kospi = kospiRes.status === 'fulfilled' ? kospiRes.value : null;
    const nasdaq = nasdaqRes.status === 'fulfilled' ? nasdaqRes.value : null;
    const btc = btcRes.status === 'fulfilled' ? btcRes.value : null;
    const usFg = usFgRes.status === 'fulfilled' ? usFgRes.value : null;
    const cryptoFg = cryptoFgRes.status === 'fulfilled' ? cryptoFgRes.value : null;

    // KST 날짜
    const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // 요약 문장 생성
    const parts = [];
    if (kospi) parts.push(`코스피 ${changeText(kospi.change)}`);
    if (nasdaq) parts.push(`나스닥 ${changeText(nasdaq.change)}`);
    if (btc) parts.push(`BTC ${changeText(btc.change)}`);
    const summary = parts.length > 0 ? parts.join(', ') + '.' : '시장 데이터를 가져오는 중입니다.';

    const payload = {
      date: kstDate,
      markets: {
        kospi: kospi ? { close: kospi.close, change: kospi.change } : null,
        nasdaq: nasdaq ? { close: nasdaq.close, change: nasdaq.change } : null,
        btc: btc ? { price: btc.price, change: btc.change } : null,
      },
      fearGreed: {
        us: usFg,
        crypto: cryptoFg,
      },
      summary,
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch market data' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
