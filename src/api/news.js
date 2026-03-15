// ─── 뉴스 API v2 ───────────────────────────────────────────────
// 설계 원칙:
//   1. rss2json 호출을 카테고리당 1회로 제한 (Google News 검색 통합 쿼리)
//   2. allorigins 의존 최소화 — 직접 CORS 허용 소스 우선
//   3. Finnhub (미장) + CryptoCompare (코인) → CORS-free 전용 API
//   4. localStorage 24시간 fallback — API 한도 초과 시 캐시 데이터 반환
//   5. 카테고리별 독립 캐시 (staleTime 5분)

// ─── localStorage 캐시 헬퍼 ────────────────────────────────────
const CACHE_TTL   = 5 * 60 * 1000;         // 5분 (신선 기간)
const CACHE_STALE = 24 * 60 * 60 * 1000;  // 24시간 (stale fallback 허용)

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(`news_${key}`);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    // 5분 이내면 신선 데이터
    if (Date.now() - ts < CACHE_TTL) return { data, fresh: true };
    // 24시간 이내면 stale — API 실패 시 fallback 용도
    if (Date.now() - ts < CACHE_STALE) return { data, fresh: false };
    return null;
  } catch { return null; }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(`news_${key}`, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// ─── 시간 포맷 ────────────────────────────────────────────────
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

// ─── RSS XML 파서 ─────────────────────────────────────────────
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

// ─── rss2json 파서 ────────────────────────────────────────────
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

// ─── rss2json 호출 (API 키 없이 60req/min) ────────────────────
// 주의: 이 함수는 카테고리당 최대 1회 호출하도록 설계됨
async function fetchViaRss2json(rssUrl, category, sourceName) {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=20`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`rss2json ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok' || !data.items?.length) throw new Error('rss2json empty');
  return parseRssItems(data.items, category, sourceName);
}

// ─── allorigins (직접 RSS XML 파싱) ──────────────────────────
// fallback 전용 — 가능하면 사용하지 않음
async function fetchViaAllorigins(rssUrl, category, sourceName) {
  const url  = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`allorigins ${res.status}`);
  const json = await res.json();
  const text = json.contents ?? '';
  if (!text) throw new Error('allorigins empty');
  const items = parseRssXml(text, category, sourceName);
  if (!items.length) throw new Error('allorigins no items');
  return items;
}

// ─── 단일 RSS 취득 (rss2json 우선, allorigins fallback) ───────
async function fetchRSS(rssUrl, category, sourceName) {
  try { return await fetchViaRss2json(rssUrl, category, sourceName); } catch {}
  try { return await fetchViaAllorigins(rssUrl, category, sourceName); } catch {}
  return [];
}

// ─── 금융 키워드 필터 ─────────────────────────────────────────
const FINANCE_KW = [
  '주식','증시','코스피','코스닥','코인','비트코인','이더리움','솔라나','리플','암호화폐',
  '가상화폐','나스닥','다우','s&p','금리','환율','달러','원화','기준금리',
  '주가','상장','ipo','공모','배당','실적','매출','영업이익','순이익','시가총액',
  '외국인','기관','etf','펀드','채권','선물','옵션','삼성전자','sk하이닉스',
  'naver','카카오','현대차','기아','nvidia','apple','tesla','microsoft',
  'bitcoin','ethereum','crypto','defi','blockchain','fed','fomc','연준',
  '금통위','한국은행','거래소','kospi','kosdaq','증권','투자','급등','급락',
  '어닝','분기','가이던스','인플레','경기','침체','경기부양','무역','관세',
  '수출','gdp','cpi','ppi','고용','실업','파산','인수합병','m&a',
  '항셍','닛케이','상해','원자재','금','원유','wti','stock','market','rally',
  'earnings','revenue','profit','shares','nasdaq','sp500','dow',
];

const BLOCK_KW = [
  // 스포츠
  '야구','축구','농구','배구','골프','올림픽','월드컵','스포츠','선수','경기장',
  '감독','코치','승리','패배','리그','챔피언십','우승','결승','시즌',
  // 연예/문화
  '드라마','영화','아이돌','가수','배우','연예','오락','예능','콘서트',
  '앨범','노래','뮤직비디오','시청률','촬영',
  // 날씨/재난
  '날씨','태풍','지진','홍수','재난','미세먼지','폭설','폭우','황사',
  // 음식/생활
  '요리','레시피','맛집','카페','식당','음식','배달앱',
  // 패션/뷰티
  '패션','뷰티','화장품','다이어트','스킨케어',
  // 교육
  '수능','대입','입시','학원','시험',
  // 정치 (투자 무관)
  '선거','대통령','국회','의원','정당','외교','재판',
];

// 금융 전문 소스 — 금융 키워드 없어도 통과
const FINANCE_SOURCES = new Set([
  '코인데스크코리아','블록미디어','한국경제','매일경제','조선비즈',
  'CoinTelegraph','CoinDesk','Decrypt','Finnhub',
]);

function isFinancialNews(item) {
  const text = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
  if (BLOCK_KW.some(k => text.includes(k))) return false;
  if (FINANCE_SOURCES.has(item.source)) return true;
  return FINANCE_KW.some(k => text.includes(k));
}

// ─── 중복 제거 ────────────────────────────────────────────────
function dedup(items) {
  const seen = new Set();
  return items.filter(i => {
    const key = (i.title || '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// 카테고리별 전용 API (CORS-free, rss2json 쿼터 절약)
// ─────────────────────────────────────────────────────────────

// [코인] CryptoCompare — 키 없이 사용 가능, CORS 허용
// feeds: cointelegraph, coindesk, decrypt 영문 + blockmedia 한글 RSS 병행
async function fetchCoinNews() {
  const cached = cacheGet('coin');
  if (cached?.fresh) return cached.data;

  // 1순위: CryptoCompare (키 없음, CORS OK, 안정적)
  const ccItems = await (async () => {
    try {
      const url  = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&feeds=cointelegraph,coindesk,decrypt&extraParams=MarketDashboard';
      const res  = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`CC ${res.status}`);
      const data = await res.json();
      if (data.Type !== 100) throw new Error('CC error');
      return data.Data.slice(0, 20).map(a => ({
        id:          String(a.id),
        title:       a.title,
        description: (a.body || '').replace(/<[^>]+>/g, '').slice(0, 200),
        link:        a.url,
        pubDate:     new Date(a.published_on * 1000).toISOString(),
        timeAgo:     timeAgo(a.published_on),
        source:      a.source_info?.name || 'CryptoCompare',
        image:       a.imageurl || null,
        category:    'coin',
      }));
    } catch { return []; }
  })();

  // 2순위: 한국 코인 RSS — Google News 단일 통합 쿼리로 rss2json 1회만 호출
  // (블록미디어 직접 RSS는 CORS 이슈로 rss2json을 통해야 함)
  const krCoinItems = await fetchRSS(
    'https://news.google.com/rss/search?q=%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8+%EC%9D%B4%EB%8D%94%EB%A6%AC%EC%9B%80+%EC%BD%94%EC%9D%B8+%EC%95%94%ED%98%B8%ED%99%94%ED%8F%90&hl=ko&gl=KR&ceid=KR:ko',
    'coin',
    '구글뉴스',
  );

  const items = dedup([...ccItems, ...krCoinItems.filter(isFinancialNews)])
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 30);

  if (items.length > 0) cacheSet('coin', items);
  else if (cached?.data) return cached.data;  // stale fallback
  return items;
}

// [미장] Finnhub (무료, CORS-free) + Google News 1회
// Finnhub 무료: 60req/min → 5분 캐시 활용 시 전혀 문제 없음
async function fetchUsNews() {
  const cached = cacheGet('us');
  if (cached?.fresh) return cached.data;

  const finnhubKey = import.meta.env.VITE_FINNHUB_API_KEY || '';

  // 1순위: Finnhub (키 있으면 사용, CORS OK)
  const finnhubItems = finnhubKey ? await (async () => {
    try {
      const url  = `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Finnhub ${res.status}`);
      const data = await res.json();
      return (Array.isArray(data) ? data : []).slice(0, 20).map(a => ({
        id:          String(a.id),
        title:       a.headline,
        description: (a.summary || '').slice(0, 200),
        link:        a.url,
        pubDate:     new Date(a.datetime * 1000).toISOString(),
        timeAgo:     timeAgo(a.datetime),
        source:      a.source || 'Finnhub',
        image:       a.image || null,
        category:    'us',
      })).filter(i => i.title && i.link);
    } catch { return []; }
  })() : [];

  // 2순위: Google News 통합 쿼리 1회 (rss2json 쿼터 1회 소비)
  const googleItems = await fetchRSS(
    'https://news.google.com/rss/search?q=%EB%AF%B8%EA%B5%AD%EC%A6%9D%EC%8B%9C+%EB%82%98%EC%8A%A4%EB%8B%A5+S%26P500+%EC%97%B0%EC%A4%80&hl=ko&gl=KR&ceid=KR:ko',
    'us',
    '구글뉴스',
  );

  const items = dedup([...finnhubItems, ...googleItems.filter(isFinancialNews)])
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 30);

  if (items.length > 0) cacheSet('us', items);
  else if (cached?.data) return cached.data;
  return items;
}

// [국장] Google News 통합 쿼리 1회 — allorigins 의존 제거로 속도 개선
// 한경/매경 allorigins는 4-7초 소요라 제거, Google News로 통합
async function fetchKrNews() {
  const cached = cacheGet('kr');
  if (cached?.fresh) return cached.data;

  // Google News 통합 쿼리 — rss2json 1회 (가장 빠름)
  const googleItems = await fetchRSS(
    'https://news.google.com/rss/search?q=%EC%BD%94%EC%8A%A4%ED%94%BC+%EC%BD%94%EC%8A%A4%EB%8B%A5+%EC%A6%9D%EC%8B%9C+%EC%A3%BC%EC%8B%9D+%EC%97%85%EC%A2%85+%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90&hl=ko&gl=KR&ceid=KR:ko',
    'kr',
    '구글뉴스',
  );

  const items = dedup(googleItems.filter(isFinancialNews))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 30);

  if (items.length > 0) cacheSet('kr', items);
  else if (cached?.data) return cached.data;
  return items;
}

// ─── Promise 디덥 — 중복 호출 완전 차단 ─────────────────────
// 핵심 P0 수정: 5개 컴포넌트가 동시에 fetchAllNews()를 호출해도
// 실제 API 요청은 단 1번만 나가고, 나머지는 같은 Promise를 공유함
const _pending = { all: null, coin: null, us: null, kr: null };

function withDedup(key, fetchFn) {
  const cached = cacheGet(key);
  if (cached?.fresh) return Promise.resolve(cached.data);
  if (_pending[key]) return _pending[key];
  _pending[key] = fetchFn()
    .finally(() => { _pending[key] = null; });
  return _pending[key];
}

// ─── public API ───────────────────────────────────────────────

export function fetchNewsByCategory(category) {
  switch (category) {
    case 'coin': return withDedup('coin', fetchCoinNews);
    case 'us':   return withDedup('us',   fetchUsNews);
    case 'kr':   return withDedup('kr',   fetchKrNews);
    default:     return fetchAllNews();
  }
}

export function fetchAllNews() {
  return withDedup('all', async () => {
    const cachedAll = cacheGet('all');

    // 3개 카테고리 병렬 실행 (각각 내부 캐시 활용)
    const [coinRes, usRes, krRes] = await Promise.allSettled([
      fetchCoinNews(),
      fetchUsNews(),
      fetchKrNews(),
    ]);

    const all = [
      ...(coinRes.status === 'fulfilled' ? coinRes.value : []),
      ...(usRes.status   === 'fulfilled' ? usRes.value   : []),
      ...(krRes.status   === 'fulfilled' ? krRes.value   : []),
    ].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    if (!all.length) {
      if (cachedAll?.data) return cachedAll.data;
      throw new Error('뉴스 없음');
    }

    cacheSet('all', all);
    return all;
  });
}

// 수동 새로고침 시 캐시 무효화
export function invalidateNewsCache() {
  ['all','coin','us','kr'].forEach(k => {
    try { localStorage.removeItem(`news_${k}`); } catch {}
  });
}

// React Query initialData용 — 동기 로컬스토리지 즉시 반환 (stale 포함)
// 앱 첫 로드 시 캐시 데이터를 즉각 표시하고 백그라운드 갱신
export function getInitialNewsData(key = 'all') {
  return cacheGet(key)?.data ?? undefined;
}

export function getInitialNewsTimestamp(key = 'all') {
  try {
    const raw = localStorage.getItem(`news_${key}`);
    if (!raw) return 0;
    return JSON.parse(raw).ts ?? 0;
  } catch { return 0; }
}
