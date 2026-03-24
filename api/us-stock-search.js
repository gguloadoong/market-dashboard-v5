// api/us-stock-search.js — 미국 주식 종목 검색 (NASDAQ 공개 API)
// 쿼리 파라미터: ?q=검색어
// 캐시: 1시간 CDN 캐시
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q || q.length < 1) {
    return new Response(JSON.stringify({ items: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    // NASDAQ 자동완성 API — 실시간 미장 종목 검색
    const url = `https://api.nasdaq.com/api/autocomplete/slookup/10?search=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
        'Accept': 'application/json',
        'Origin': 'https://www.nasdaq.com',
        'Referer': 'https://www.nasdaq.com/',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`NASDAQ ${res.status}`);
    const data = await res.json();

    // NASDAQ 응답 정규화
    const items = (data?.data || [])
      .filter(item => item.symbol && item.name)
      .map(item => ({
        symbol: item.symbol.toUpperCase(),
        name: item.name,
        market: 'us',
        exchange: item.exchange || '',
      }))
      .slice(0, 10);

    return new Response(JSON.stringify({ items }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    // NASDAQ 실패 시 Yahoo Finance 자동완성 fallback
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Yahoo ${res.status}`);
      const data = await res.json();
      const items = (data?.quotes || [])
        .filter(q => q.symbol && q.shortname && q.quoteType === 'EQUITY')
        .map(q => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          market: 'us',
          exchange: q.exchange || '',
        }))
        .slice(0, 10);

      return new Response(JSON.stringify({ items }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }
}
