// 뉴스 API — Google News RSS(1순위, 안정적) + 국내 RSS(2순위) + CryptoCompare(코인 fallback)

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

// ─── 1순위: rss2json.com ─────────────────────────────────────
async function fetchViaRss2json(rssUrl, category, sourceName) {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=20`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
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

// ─── 2순위: corsproxy.io ────────────────────────────────────
async function fetchViaCorsproxy(rssUrl, category, sourceName) {
  const proxy = `https://corsproxy.io/?url=${encodeURIComponent(rssUrl)}`;
  const res   = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`corsproxy ${res.status}`);
  const text = await res.text();
  return parseRssXml(text, category, sourceName);
}

// ─── 3순위: allorigins.win ───────────────────────────────────
async function fetchViaAllorigins(rssUrl, category, sourceName) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
  const res   = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`allorigins ${res.status}`);
  const json  = await res.json();
  const text  = json.contents ?? '';
  if (!text) throw new Error('allorigins empty');
  return parseRssXml(text, category, sourceName);
}

// ─── RSS XML 파서 ─────────────────────────────────────────────
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

// ─── 3단계 폴백 ──────────────────────────────────────────────
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
  const url = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&feeds=cointelegraph,coindesk,decrypt&extraParams=market_dashboard';
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

// ─── 뉴스 소스 목록 ──────────────────────────────────────────
// Google News RSS를 1순위 (안정적, 한국어 지원, 프록시 통과율 높음)
const FEEDS = {
  coin: [
    {
      url: 'https://news.google.com/rss/search?q=%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8+%EC%BD%94%EC%9D%B8+%EA%B0%80%EC%83%81%ED%99%94%ED%8F%90&hl=ko&gl=KR&ceid=KR:ko',
      source: '구글뉴스',
    },
    { url: 'https://www.coindeskkorea.com/feed/',      source: '코인데스크코리아' },
    { url: 'https://www.blockmedia.co.kr/feed/',       source: '블록미디어' },
    { url: 'https://coinreaders.com/feed',             source: '코인리더스' },
  ],
  us: [
    {
      url: 'https://news.google.com/rss/search?q=%EB%AF%B8%EA%B5%AD%EC%A6%9D%EC%8B%9C+%EB%82%98%EC%8A%A4%EB%8B%A5+S%26P500&hl=ko&gl=KR&ceid=KR:ko',
      source: '구글뉴스',
    },
    { url: 'https://www.hankyung.com/feed/international', source: '한국경제' },
    { url: 'https://www.mk.co.kr/rss/40300001/',          source: '매일경제' },
    { url: 'https://biz.chosun.com/sitemap/rss/international.xml', source: '조선비즈' },
  ],
  kr: [
    {
      url: 'https://news.google.com/rss/search?q=%EC%BD%94%EC%8A%A4%ED%94%BC+%EC%BD%94%EC%8A%A4%EB%8B%A5+%EC%A6%9D%EC%8B%9C+%EC%A3%BC%EC%8B%9D&hl=ko&gl=KR&ceid=KR:ko',
      source: '구글뉴스',
    },
    { url: 'https://www.hankyung.com/feed/stock',             source: '한국경제' },
    { url: 'https://www.mk.co.kr/rss/30000001/',              source: '매일경제' },
    { url: 'https://biz.chosun.com/sitemap/rss/stocks.xml',   source: '조선비즈' },
    { url: 'https://www.sedaily.com/RSS/S0601',               source: '서울경제' },
  ],
};

// ─── 금융 뉴스 필터 (비금융 기사 차단) ──────────────────────
// 허용 키워드: 주식·코인·금융 관련 단어를 하나라도 포함해야 통과
const FINANCE_KW = [
  '주식','증시','코스피','코스닥','코인','비트코인','이더리움','솔라나','리플','암호화폐',
  '가상화폐','나스닥','다우','s&p','s&p500','금리','환율','달러','원화','기준금리',
  '주가','상장','ipo','공모','배당','실적','매출','영업이익','순이익','시가총액',
  '외국인','기관','개인','etf','펀드','채권','파생','선물','옵션',
  '삼성전자','sk하이닉스','naver','카카오','현대차','기아','lg',
  'nvidia','apple','tesla','microsoft','google','amazon','meta',
  'bitcoin','ethereum','crypto','defi','nft','blockchain','altcoin','web3',
  'fed','fomc','연준','금통위','기재부','한국은행','거래소','kospi','kosdaq',
  '증권','투자','자산','포트폴리오','수익률','변동성','급등','급락','랠리',
];
// 차단 키워드: 이 단어가 제목에 있으면 무조건 제거
const BLOCK_KW = [
  '야구','축구','농구','배구','골프','테니스','올림픽','월드컵','스포츠','선수','경기장',
  '드라마','영화','아이돌','가수','배우','연예','오락','예능','뮤지컬','콘서트',
  '날씨','태풍','지진','홍수','재난','미세먼지',
  '요리','레시피','맛집','카페','식당','음식',
  '패션','뷰티','화장품','다이어트','운동법',
  '게임','만화','웹툰','소설','취미','여행','관광',
  '수능','대입','교육','학교','대학','입시',
  '정치','대통령','국회','의원','선거','정당',
];

function isFinancialNews(item, isGoogleNews = false) {
  const text = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
  // 차단 키워드가 있으면 무조건 제거
  if (BLOCK_KW.some(k => text.includes(k))) return false;
  // 구글뉴스는 포괄적이므로 금융 키워드 반드시 포함 요구
  if (isGoogleNews) return FINANCE_KW.some(k => text.includes(k));
  // 전문 금융 매체는 신뢰 (한경·매경·조선비즈·서울경제·코인데스크·블록미디어)
  return true;
}

// 중복 제목 제거
function dedup(items) {
  const seen = new Set();
  return items.filter(i => {
    const key = i.title.slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const GOOGLE_NEWS_SOURCES = new Set(['구글뉴스']);

async function fetchCategory(category) {
  const results = await Promise.allSettled(
    FEEDS[category].map(f => fetchRSS(f.url, category, f.source))
  );
  // 소스별로 필터 적용: 구글뉴스는 금융 키워드 검증 필수
  const items = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(item => isFinancialNews(item, GOOGLE_NEWS_SOURCES.has(item.source)));

  if (category === 'coin' && items.length < 3) {
    const fallback = await fetchCryptoCompareFallback();
    return dedup([...items, ...fallback]).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  }
  return dedup(items).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
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
