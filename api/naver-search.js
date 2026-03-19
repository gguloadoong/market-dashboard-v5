// api/naver-search.js — 네이버 주식 검색 프록시 (KRX 전 종목)
export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json({ items: [] });

  try {
    const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock,etf`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
        'Referer': 'https://finance.naver.com/',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`${r.status}`);
    const data = await r.json();
    // items: [{ code, name, typeCode (KOSPI|KOSDAQ), typeName, category }]
    const items = (data.items || [])
      .filter(item => item.nationCode === 'KOR')
      .map(item => ({
        code:     item.code,
        name:     item.name,
        market:   item.typeCode,   // 'KOSPI' | 'KOSDAQ'
        category: item.category,   // 'stock' | 'etf'
      }));
    res.setHeader('Cache-Control', 's-maxage=300');
    res.json({ items });
  } catch (e) {
    res.json({ items: [], error: e.message });
  }
}
