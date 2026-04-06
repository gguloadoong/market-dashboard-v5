// api/whale-telegram.js — 텔레그램 고래 알림 데이터 반환 (Serverless)
// Redis에서 snap:whale:telegram 읽어서 반환
export default async function handler(req, res) {
  try {
    // 동적 import — Serverless 환경에서 _price-cache 사용
    const { getSnap } = await import('./_price-cache.js');
    const data = await getSnap('snap:whale:telegram');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ events: Array.isArray(data) ? data : [], ts: Date.now() });
  } catch (e) {
    res.status(500).json({ error: e.message, events: [] });
  }
}
