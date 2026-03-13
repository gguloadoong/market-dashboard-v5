// 뉴스 소스 — 한국어 RSS via allorigins 프록시
// 코인: 코인데스크코리아, 블록미디어
// 미장: 한국경제 국제, 매일경제 국제
// 국장: 한국경제 증권, 매일경제 증권, 서울경제

function timeAgo(dateInput) {
  const ms   = typeof dateInput === 'number'
    ? dateInput * 1000
    : new Date(dateInput).getTime();
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}초 전`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

async function fetchRSS(rssUrl, category, sourceName) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
  const res   = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`allorigins ${res.status}`);
  const { contents } = await res.json();
  if (!contents) throw new Error('empty');

  const doc   = new DOMParser().parseFromString(contents, 'text/xml');
  const items = [...doc.querySelectorAll('item')];

  return items.slice(0, 15).map(el => {
    const text = s => (el.querySelector(s)?.textContent || '')
      .replace(/<!\[CDATA\[|\]\]>/g, '').trim();
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
                 || el.querySelector('thumbnail')?.textContent?.trim()
                 || null,
      category,
    };
  }).filter(Boolean);
}

// CryptoCompare 영문 뉴스 — 코인 RSS 실패 시 fallback
async function fetchCryptoCompareFallback() {
  const url = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&feeds=cointelegraph,coindesk,decrypt';
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CryptoCompare ${res.status}`);
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
}

const FEEDS = {
  coin: [
    { url: 'https://www.coindeskkorea.com/feed/',    source: '코인데스크코리아' },
    { url: 'https://www.blockmedia.co.kr/feed/',     source: '블록미디어'       },
  ],
  us: [
    { url: 'https://www.hankyung.com/feed/international', source: '한국경제'  },
    { url: 'https://www.mk.co.kr/rss/40300001/',          source: '매일경제'  },
  ],
  kr: [
    { url: 'https://www.hankyung.com/feed/stock',         source: '한국경제'  },
    { url: 'https://www.mk.co.kr/rss/30000001/',          source: '매일경제'  },
    { url: 'https://biz.chosun.com/sitemap/rss/stocks.xml', source: '조선비즈' },
  ],
};

async function fetchCategory(category) {
  const results = await Promise.allSettled(
    FEEDS[category].map(f => fetchRSS(f.url, category, f.source))
  );
  const items = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // 코인: 한국어 RSS 실패 시 영문 CryptoCompare로 대체
  if (category === 'coin' && items.length === 0) {
    return fetchCryptoCompareFallback();
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
