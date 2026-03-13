// 뉴스: Reddit JSON API (CORS 지원, 무료)

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}초 전`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

async function fetchReddit(subreddit, category, limit = 12) {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}&raw_json=1`,
    { signal: AbortSignal.timeout(7000) }
  );
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  const data = await res.json();
  return data.data.children
    .filter(p => !p.data.stickied && p.data.score > 5)
    .map(p => ({
      id:          p.data.id,
      title:       p.data.title,
      description: (p.data.selftext || '').slice(0, 140),
      link:        `https://www.reddit.com${p.data.permalink}`,
      pubDate:     new Date(p.data.created_utc * 1000).toISOString(),
      timeAgo:     timeAgo(new Date(p.data.created_utc * 1000)),
      source:      `r/${subreddit}`,
      score:       p.data.score,
      category,
    }));
}

export async function fetchAllNews() {
  const [usNews, coinNews, stocksNews] = await Promise.allSettled([
    fetchReddit('investing', 'us', 10),
    fetchReddit('CryptoCurrency', 'coin', 10),
    fetchReddit('stocks', 'us', 8),
  ]);

  const all = [
    ...(coinNews.status   === 'fulfilled' ? coinNews.value   : []),
    ...(usNews.status     === 'fulfilled' ? usNews.value     : []),
    ...(stocksNews.status === 'fulfilled' ? stocksNews.value : []),
  ].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  if (!all.length) throw new Error('뉴스 로드 실패');
  return all;
}

export async function fetchNewsByCategory(category) {
  if (category === 'coin') return fetchReddit('CryptoCurrency', 'coin', 20);
  if (category === 'us')   return fetchReddit('investing', 'us', 20);
  if (category === 'kr')   return fetchReddit('stocks', 'us', 20);
  return fetchAllNews();
}
