// 뉴스 API - rss2json.com (무료, CORS OK)

const R2J = 'https://api.rss2json.com/v1/api.json?count=15&rss_url=';

const FEEDS = {
  coin: 'https://cointelegraph.com/rss',
  us:   'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US',
  kr:   'https://www.hankyung.com/feed/economy',
  all:  'https://feeds.finance.yahoo.com/rss/2.0/headline',
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}

async function fetchFeed(url, category) {
  const res = await fetch(`${R2J}${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`RSS fetch failed ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error('RSS parse failed');
  return data.items.map(item => ({
    id:          item.guid || item.link,
    title:       stripHtml(item.title),
    description: stripHtml(item.description).slice(0, 120),
    link:        item.link,
    pubDate:     item.pubDate,
    timeAgo:     timeAgo(item.pubDate),
    source:      data.feed.title?.replace(' News', '').replace(' - All Articles', '') || category,
    category,
    image:       item.enclosure?.link || item.thumbnail || null,
  }));
}

export async function fetchAllNews() {
  const [coinNews, usNews, krNews] = await Promise.allSettled([
    fetchFeed(FEEDS.coin, 'coin'),
    fetchFeed(FEEDS.us,   'us'),
    fetchFeed(FEEDS.kr,   'kr'),
  ]);

  const all = [
    ...(coinNews.status === 'fulfilled' ? coinNews.value : []),
    ...(usNews.status   === 'fulfilled' ? usNews.value   : []),
    ...(krNews.status   === 'fulfilled' ? krNews.value   : []),
  ].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  return all;
}

export async function fetchNewsByCategory(category) {
  if (category === 'all') return fetchAllNews();
  return fetchFeed(FEEDS[category] ?? FEEDS.all, category);
}
