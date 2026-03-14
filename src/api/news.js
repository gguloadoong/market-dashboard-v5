// 뉴스 API — 병렬 레이스 방식 (최대 5초 내 반환)
// 전략: rss2json + corsproxy 동시 실행 → 먼저 성공한 쪽 사용

function timeAgo(dateInput) {
  if (!dateInput) return '';
  const ms   = typeof dateInput === 'number' ? dateInput * 1000 : new Date(dateInput).getTime();
  if (isNaN(ms)) return '';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}초 전`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function parseRssItems(items, category, sourceName) {
  return items.map(item => ({
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

function parseRssXml(xmlText, category, sourceName) {
  const doc   = new DOMParser().parseFromString(xmlText, 'text/xml');
  const items = [...doc.querySelectorAll('item')];
  return items.slice(0, 20).map(el => {
    const get = s => (el.querySelector(s)?.textContent || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const link  = get('link') || get('guid');
    const title = get('title');
    if (!title || !link) return null;
    const pubDate = get('pubDate') || new Date().toISOString();
    return {
      id:          get('guid') || link,
      title,
      description: get('description').replace(/<[^>]+>/g, '').slice(0, 200),
      link,
      pubDate:     new Date(pubDate).toISOString(),
      timeAgo:     timeAgo(pubDate),
      source:      sourceName,
      image:       el.querySelector('enclosure')?.getAttribute('url') || null,
      category,
    };
  }).filter(Boolean);
}

// ─── 핵심 fetch — 3개 프록시 동시 실행, 첫 성공 반환 (최대 5초) ──
async function fetchRSS(rssUrl, category, sourceName) {
  const TIMEOUT = 5000;

  // 1) rss2json — JSON으로 바로 파싱, 가장 빠름
  const rss2jsonFn = async () => {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=20`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`rss2json ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok' || !data.items?.length) throw new Error('rss2json empty');
    return parseRssItems(data.items, category, sourceName);
  };

  // 2) corsproxy — XML 파싱 필요
  const corsFn = async () => {
    const url = `https://corsproxy.io/?url=${encodeURIComponent(rssUrl)}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`corsproxy ${res.status}`);
    const text = await res.text();
    const items = parseRssXml(text, category, sourceName);
    if (!items.length) throw new Error('corsproxy empty');
    return items;
  };

  // 3) allorigins — 마지막 수단
  const alloriginsFn = async () => {
    const url  = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`allorigins ${res.status}`);
    const json = await res.json();
    const text = json.contents ?? '';
    if (!text) throw new Error('allorigins empty');
    const items = parseRssXml(text, category, sourceName);
    if (!items.length) throw new Error('allorigins no items');
    return items;
  };

  // rss2json + corsproxy 동시 실행 → 먼저 성공한 것 반환
  return new Promise(resolve => {
    let done = false;
    let pending = 2;

    const tryFallback = () => {
      // 두 개 모두 실패하면 allorigins 시도
      alloriginsFn().then(items => {
        if (!done) { done = true; resolve(items); }
      }).catch(() => {
        if (!done) { done = true; resolve([]); }
      });
    };

    [rss2jsonFn, corsFn].forEach(fn => {
      fn().then(items => {
        if (!done && items.length > 0) { done = true; resolve(items); }
        else { pending--; if (pending === 0 && !done) tryFallback(); }
      }).catch(() => {
        pending--;
        if (pending === 0 && !done) tryFallback();
      });
    });
  });
}

// ─── 금융 뉴스 필터 ───────────────────────────────────────────
const FINANCE_KW = [
  '주식','증시','코스피','코스닥','코인','비트코인','이더리움','솔라나','리플','암호화폐',
  '가상화폐','나스닥','다우','s&p','금리','환율','달러','원화','기준금리',
  '주가','상장','ipo','공모','배당','실적','매출','영업이익','순이익','시가총액',
  '외국인','기관','etf','펀드','채권','선물','옵션','삼성전자','sk하이닉스',
  'naver','카카오','현대차','기아','nvidia','apple','tesla','microsoft',
  'bitcoin','ethereum','crypto','defi','blockchain','fed','fomc','연준',
  '금통위','한국은행','거래소','kospi','kosdaq','증권','투자','급등','급락',
];
const BLOCK_KW = [
  '야구','축구','농구','배구','골프','올림픽','월드컵','스포츠','선수','경기장',
  '드라마','영화','아이돌','가수','배우','연예','오락','예능','콘서트',
  '날씨','태풍','지진','홍수','재난','미세먼지',
  '요리','레시피','맛집','카페','식당',
  '패션','뷰티','화장품','다이어트',
  '게임','만화','웹툰','소설','여행','관광',
  '수능','대입','교육','입시',
];

const GOOGLE_SOURCES = new Set(['구글뉴스']);

function isFinancialNews(item) {
  const text = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
  if (BLOCK_KW.some(k => text.includes(k))) return false;
  if (GOOGLE_SOURCES.has(item.source)) return FINANCE_KW.some(k => text.includes(k));
  return true;
}

// ─── CryptoCompare fallback ───────────────────────────────────
async function fetchCryptoCompareFallback() {
  const url = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&feeds=cointelegraph,coindesk,decrypt';
  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
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

// ─── 중복 제거 ────────────────────────────────────────────────
function dedup(items) {
  const seen = new Set();
  return items.filter(i => {
    const key = (i.title || '').slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── 뉴스 소스 — Google News RSS 중심 (안정적, 빠름) ──────────
const FEEDS = {
  coin: [
    // 코인 전용 검색
    { url: 'https://news.google.com/rss/search?q=%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8+%EC%BD%94%EC%9D%B8+%EA%B0%80%EC%83%81%ED%99%94%ED%8F%90&hl=ko&gl=KR&ceid=KR:ko', source: '구글뉴스' },
    { url: 'https://www.coindeskkorea.com/feed/', source: '코인데스크코리아' },
    { url: 'https://www.blockmedia.co.kr/feed/',  source: '블록미디어' },
  ],
  us: [
    // 미국증시 전용 검색
    { url: 'https://news.google.com/rss/search?q=%EB%AF%B8%EA%B5%AD%EC%A6%9D%EC%8B%9C+%EB%82%98%EC%8A%A4%EB%8B%A5+S%26P500&hl=ko&gl=KR&ceid=KR:ko', source: '구글뉴스' },
    { url: 'https://www.hankyung.com/feed/international', source: '한국경제' },
    { url: 'https://www.mk.co.kr/rss/40300001/', source: '매일경제' },
  ],
  kr: [
    // 코스피·증시 전용 검색
    { url: 'https://news.google.com/rss/search?q=%EC%BD%94%EC%8A%A4%ED%94%BC+%EC%BD%94%EC%8A%A4%EB%8B%A5+%EC%A6%9D%EC%8B%9C+%EC%A3%BC%EC%8B%9D&hl=ko&gl=KR&ceid=KR:ko', source: '구글뉴스' },
    { url: 'https://www.hankyung.com/feed/stock',           source: '한국경제' },
    { url: 'https://www.mk.co.kr/rss/30000001/',            source: '매일경제' },
    { url: 'https://biz.chosun.com/sitemap/rss/stocks.xml', source: '조선비즈' },
  ],
};

async function fetchCategory(category) {
  // 모든 피드 병렬 실행 — 개별 피드마다 최대 5초
  const results = await Promise.allSettled(
    FEEDS[category].map(f => fetchRSS(f.url, category, f.source))
  );
  const items = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(isFinancialNews);

  if (category === 'coin' && items.length < 3) {
    const fallback = await fetchCryptoCompareFallback();
    return dedup([...items, ...fallback]).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }
  return dedup(items).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
}

export async function fetchAllNews() {
  // 3개 카테고리 동시 실행
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
