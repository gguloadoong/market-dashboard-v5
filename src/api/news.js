// 뉴스 API — rss2json(1순위) → corsproxy(2순위) → allorigins(3순위) 폴백

function timeAgo(dateInput) {
  const ms   = typeof dateInput === 'number' ? dateInput * 1000 : new Date(dateInput).getTime();
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}초 전`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ─── 1순위: rss2json.com (무료, 인증불필요, 안정적) ─────────────
async function fetchViaRss2json(rssUrl, category, sourceName) {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=20`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`rss2json ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`rss2json: ${data.message}`);
  return data.items.map(item => ({
    id:          item.guid || item.link,
    title:       (item.title || '').replace(/<[^>]+>/g, '').trim(),
    description: (item.description || item.content || '').replace(/<[^>]+>/g, '').slice(0, 200).trim(),
    link:        item.link,
    pubDate:     new Date(item.pubDate).toISOString(),
    timeAgo:     timeAgo(item.pubDate),
    source:      sourceName,
    image:       item.thumbnail || item.enclosure?.link || null,
    category,
  })).filter(i => i.title && i.link);
}

// ─── 2순위: corsproxy.io ────────────────────────────────────────
async function fetchViaCorsproxy(rssUrl, category, sourceName) {
  const proxy = `https://corsproxy.io/?url=${encodeURIComponent(rssUrl)}`;
  const res   = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`corsproxy ${res.status}`);
  const text = await res.text();
  return parseRssXml(text, category, sourceName);
}

// ─── 3순위: allorigins.win ───────────────────────────────────────
async function fetchViaAllorigins(rssUrl, category, sourceName) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
  const res   = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`allorigins ${res.status}`);
  const json  = await res.json();
  const text  = json.contents ?? '';
  if (!text) throw new Error('allorigins empty');
  return parseRssXml(text, category, sourceName);
}

// ─── RSS XML 파서 ──────────────────────────────────────────────
function parseRssXml(xmlText, category, sourceName) {
  const doc   = new DOMParser().parseFromString(xmlText, 'text/xml');
  const items = [...doc.querySelectorAll('item')];
  return items.slice(0, 20).map(el => {
    const text = s => (el.querySelector(s)?.textContent || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const pubDate = text('pubDate') || new Date().toISOString();
    const link    = text('link') || text('guid');
    const title   = text('title');
    const desc    = text('description').replace(/<[^>]+>/g, '').slice(0, 200);
    if (!title || !link) return null;
    return {
      id:          text('guid') || link,
      title,
      description: desc,
      link,
      pubDate:     new Date(pubDate).toISOString(),
      timeAgo:     timeAgo(pubDate),
      source:      sourceName,
      image:       el.querySelector('enclosure')?.getAttribute('url')
                || el.querySelector('thumbnail')?.textContent?.trim() || null,
      category,
    };
  }).filter(Boolean);
}

// ─── 3단계 폴백으로 RSS 가져오기 ─────────────────────────────
async function fetchRSS(rssUrl, category, sourceName) {
  const fetchers = [
    () => fetchViaRss2json(rssUrl, category, sourceName),
    () => fetchViaCorsproxy(rssUrl, category, sourceName),
    () => fetchViaAllorigins(rssUrl, category, sourceName),
  ];
  for (const fn of fetchers) {
    try {
      const items = await fn();
      if (items.length > 0) return items;
    } catch {}
  }
  return [];
}

// ─── CryptoCompare fallback (코인 뉴스용) ─────────────────────
async function fetchCryptoCompareFallback() {
  const url = 'https://min-api.cryptocompare.com/data/v2/news/?lang=KO&feeds=cointelegraph,coindesk,decrypt';
  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`CC ${res.status}`);
    const data = await res.json();
    if (data.Type !== 100) throw new Error('CC error');
    return data.Data.slice(0, 15).map(a => ({
      id:          String(a.id),
      title:       a.title,
      description: (a.body || '').replace(/<[^>]+>/g, '').slice(0, 200),
      link:        a.url,
      pubDate:     new Date(a.published_on * 1000).toISOString(),
      timeAgo:     timeAgo(a.published_on),
      source:      a.source_info?.name || a.source,
      image:       a.imageurl || null,
      category:    'coin',
    }));
  } catch { return []; }
}

// ─── 뉴스 소스 목록 ───────────────────────────────────────────
const FEEDS = {
  coin: [
    { url: 'https://www.coindeskkorea.com/feed/',      source: '코인데스크코리아' },
    { url: 'https://www.blockmedia.co.kr/feed/',       source: '블록미디어' },
    { url: 'https://coinreaders.com/feed',             source: '코인리더스' },
  ],
  us: [
    { url: 'https://www.hankyung.com/feed/international', source: '한국경제' },
    { url: 'https://www.mk.co.kr/rss/40300001/',          source: '매일경제' },
    { url: 'https://biz.chosun.com/sitemap/rss/international.xml', source: '조선비즈' },
  ],
  kr: [
    { url: 'https://www.hankyung.com/feed/stock',             source: '한국경제' },
    { url: 'https://www.mk.co.kr/rss/30000001/',              source: '매일경제' },
    { url: 'https://biz.chosun.com/sitemap/rss/stocks.xml',   source: '조선비즈' },
    { url: 'https://www.sedaily.com/RSS/S0601',               source: '서울경제' },
  ],
};

async function fetchCategory(category) {
  const results = await Promise.allSettled(
    FEEDS[category].map(f => fetchRSS(f.url, category, f.source))
  );
  const items = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  if (category === 'coin' && items.length < 3) {
    const fallback = await fetchCryptoCompareFallback();
    return [...items, ...fallback].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }
  return items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
}

export async function fetchAllNews() {
  const [coinRes, usRes, krRes] = await Promise.allSettled([
    fetchCategory('coin'),
    fetchCategory('us'),
    fetchCategory('kr'),
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
  if (FEEDS[category]) return fetchCategory(category);
  return fetchAllNews();
}
