// 뉴스 소스:
// 코인: CryptoCompare News API (무료, CORS OK, 키 불필요)
// 미장: MarketWatch RSS via allorigins 프록시
// 국장: 한국경제 RSS via allorigins 프록시

function timeAgo(dateInput) {
  const ms   = typeof dateInput === 'number' ? dateInput * 1000 : new Date(dateInput).getTime();
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}초 전`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ─── CryptoCompare News API (코인 뉴스) ──────────────────────
export async function fetchCryptoCompareNews(feeds = '') {
  const qs = feeds ? `&feeds=${feeds}` : '';
  const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN${qs}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CryptoCompare ${res.status}`);
  const data = await res.json();
  if (data.Type !== 100) throw new Error('CryptoCompare error');
  return data.Data.slice(0, 20).map(a => ({
    id:          String(a.id),
    title:       a.title,
    description: (a.body || '').replace(/<[^>]+>/g, '').slice(0, 150),
    link:        a.url,
    pubDate:     new Date(a.published_on * 1000).toISOString(),
    timeAgo:     timeAgo(a.published_on),
    source:      a.source_info?.name || a.source,
    image:       a.imageurl || null,
    category:    'coin',
  }));
}

// ─── RSS via allorigins 프록시 + DOMParser ────────────────────
async function fetchRSS(rssUrl, category, sourceName) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
  const res   = await fetch(proxy, { signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`allorigins ${res.status}`);
  const json  = await res.json();
  const text  = json.contents;
  if (!text) throw new Error('empty');

  const doc   = new DOMParser().parseFromString(text, 'text/xml');
  const items = [...doc.querySelectorAll('item')];

  return items.slice(0, 15).map(el => {
    const raw = s => el.querySelector(s)?.textContent?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
    const pubDate = raw('pubDate') || new Date().toISOString();
    const desc    = raw('description').replace(/<[^>]+>/g, '').slice(0, 150);
    const link    = raw('link') || raw('guid');
    const title   = raw('title');
    if (!title || !link) return null;
    return {
      id:          raw('guid') || link,
      title,
      description: desc,
      link,
      pubDate:     new Date(pubDate).toISOString(),
      timeAgo:     timeAgo(pubDate),
      source:      sourceName,
      image:       el.querySelector('enclosure')?.getAttribute('url') || null,
      category,
    };
  }).filter(Boolean);
}

// ─── 전체 뉴스 ────────────────────────────────────────────────
export async function fetchAllNews() {
  const [coinRes, usRes, krRes] = await Promise.allSettled([
    fetchCryptoCompareNews('cointelegraph,coindesk,decrypt,cryptoslate'),
    fetchRSS('https://feeds.marketwatch.com/marketwatch/topstories/', 'us', 'MarketWatch'),
    fetchRSS('https://www.hankyung.com/feed/finance', 'kr', '한국경제'),
  ]);

  const all = [
    ...(coinRes.status === 'fulfilled' ? coinRes.value : []),
    ...(usRes.status   === 'fulfilled' ? usRes.value   : []),
    ...(krRes.status   === 'fulfilled' ? krRes.value   : []),
  ].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  if (!all.length) throw new Error('뉴스 없음');
  return all;
}

export async function fetchNewsByCategory(category) {
  if (category === 'coin') return fetchCryptoCompareNews();
  if (category === 'us')   return fetchRSS('https://feeds.marketwatch.com/marketwatch/topstories/', 'us', 'MarketWatch');
  if (category === 'kr')   return fetchRSS('https://www.hankyung.com/feed/finance', 'kr', '한국경제');
  return fetchAllNews();
}
