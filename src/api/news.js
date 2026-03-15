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

// ─── 핵심 fetch — rss2json(1순위) + allorigins(2순위) 동시 레이스 ──
// corsproxy.io 서비스 종료로 제거됨
async function fetchRSS(rssUrl, category, sourceName) {
  const TIMEOUT = 5000;

  // 1) rss2json.com — CORS-free JSON 변환, 가장 빠름
  const rss2jsonFn = async () => {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=20`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`rss2json ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok' || !data.items?.length) throw new Error('rss2json empty');
    return parseRssItems(data.items, category, sourceName);
  };

  // 2) allorigins — XML 원문 → 파싱
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

  // 두 방식 동시 실행 — 먼저 성공한 것 반환
  return new Promise(resolve => {
    let done = false;
    let failed = 0;

    [rss2jsonFn, alloriginsFn].forEach(fn => {
      fn().then(items => {
        if (!done && items.length > 0) { done = true; resolve(items); }
        else { failed++; if (failed === 2 && !done) { done = true; resolve([]); } }
      }).catch(() => {
        failed++;
        if (failed === 2 && !done) { done = true; resolve([]); }
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
  '어닝','분기','가이던스','인플레','경기','침체','경기부양','무역','관세',
  '수출','gdp','cpi','ppi','고용','실업','파산','인수합병','m&a','ipo',
  '코스닥150','코스피200','항셍','닛케이','상해','홍콩','원자재','금','원유','wti',
];
const BLOCK_KW = [
  // 스포츠
  '야구','축구','농구','배구','골프','올림픽','월드컵','스포츠','선수','경기장',
  '감독','코치','승리','패배','리그','챔피언십','우승','결승','시즌','트레이드',
  // 연예/문화
  '드라마','영화','아이돌','가수','배우','연예','오락','예능','콘서트','팬미팅',
  '앨범','노래','뮤직비디오','시청률','ost','배역','촬영','시즌',
  // 날씨/재난
  '날씨','태풍','지진','홍수','재난','미세먼지','폭설','폭우','황사',
  // 음식/생활
  '요리','레시피','맛집','카페','식당','음식','요식업','배달앱',
  // 패션/뷰티
  '패션','뷰티','화장품','다이어트','스킨케어','헤어','성형',
  // 게임/엔터
  '게임','만화','웹툰','소설','여행','관광','호텔','리조트',
  // 교육
  '수능','대입','교육','입시','학원','대학','시험',
  // 정치 (투자 무관)
  '선거','대통령','국회','의원','정당','외교','정치','법원','재판',
];

// 투자와 무관한 비금융 출처 소스
const FINANCE_SOURCES = new Set(['구글뉴스','코인데스크코리아','블록미디어','한국경제','매일경제','조선비즈','코인텔레그래프','코인데스크']);

function isFinancialNews(item) {
  const text = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();

  // 명백한 비금융 키워드 차단
  if (BLOCK_KW.some(k => text.includes(k))) return false;

  // 금융 전문 소스이면 블록 안 걸리면 통과
  if (FINANCE_SOURCES.has(item.source)) return true;

  // 일반 소스(구글뉴스 등): 금융 키워드 1개 이상 필요
  return FINANCE_KW.some(k => text.includes(k));
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
