// 데이터 소스 헬스 모니터 cron
// 매일 UTC 00:00 (KST 09:00) 실행 — Yahoo/Stooq/Alpaca/네이버/RSS 연결 상태 점검
import { timingSafeEqual } from 'crypto';

export const config = { runtime: 'nodejs', maxDuration: 60 };

// ─── 인증 ────────────────────────────────────────────────
function authorize(req) {
  if (req.headers['x-vercel-cron']) return true;
  const authHeader = req.headers['authorization'] || '';
  if (!process.env.CRON_SECRET) return false;
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const incoming = Buffer.from(authHeader);
  return incoming.length === expected.length && timingSafeEqual(incoming, expected);
}

// ─── 단일 소스 헬스 체크 ────────────────────────────────
async function checkSource(name, url, options = {}) {
  const { timeoutMs = 10000, allow401 = false } = options;
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const latencyMs = Date.now() - start;
    if (res.ok || (allow401 && res.status === 401)) {
      return { status: latencyMs < 5000 ? 'ok' : 'slow', latencyMs };
    }
    return { status: 'fail', error: `HTTP ${res.status}`, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err.name === 'AbortError' ? 'timeout' : (err.message || 'unknown');
    return { status: 'fail', error, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

// ─── 전체 헬스 체크 실행 ────────────────────────────────
async function runHealthChecks() {
  const sources = [
    // 미장 체인 (10초 타임아웃)
    { key: 'yahoo_v8',  url: 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d', opts: { timeoutMs: 10000 } },
    { key: 'stooq',     url: 'https://stooq.com/q/d/l/?s=aapl.us&i=d',                                     opts: { timeoutMs: 10000 } },
    { key: 'alpaca',    url: 'https://data.alpaca.markets/v2/stocks/AAPL/bars?timeframe=1Day&limit=1',      opts: { timeoutMs: 10000, allow401: true } },
    // 국내 소스
    { key: 'naver_world', url: 'https://finance.naver.com/world/sise.naver?symbol=NASDAQ%3AAAPL',           opts: { timeoutMs: 10000 } },
    // RSS (5초 타임아웃)
    { key: 'rss_hankyung', url: 'https://feeds.hankyung.com/economy',        opts: { timeoutMs: 5000 } },
    { key: 'rss_yonhap',   url: 'https://www.yna.co.kr/rss/economy.xml',    opts: { timeoutMs: 5000 } },
    { key: 'rss_mk',       url: 'https://www.mk.co.kr/rss/40300001/',        opts: { timeoutMs: 5000 } },
  ];

  // 병렬 실행
  const entries = await Promise.all(
    sources.map(({ key, url, opts }) =>
      checkSource(key, url, opts).then((result) => [key, result])
    )
  );
  return Object.fromEntries(entries);
}

// ─── 24h 이내 이미 알림된 소스 집합 반환 ────────────────
// since 파라미터는 updated_at 기준이라 created_at 필터는 클라이언트에서 처리
async function getRecentlyAlertedSources(failedSources, repo, token) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues?state=all&labels=bug%2Cai-generated&sort=created&direction=desc&per_page=50`,
      { headers: { Authorization: `token ${token}`, 'User-Agent': 'market-dashboard-health-cron' }, signal: controller.signal }
    );
    if (!res.ok) return new Set();
    const issues = await res.json();
    const alerted = new Set();
    const recent = issues.filter(i =>
      i.title.includes('[헬스체크]') && new Date(i.created_at).getTime() > cutoff
    );
    for (const issue of recent) {
      for (const s of failedSources) {
        if (issue.title.includes(s)) alerted.add(s);
      }
    }
    return alerted;
  } catch (err) {
    console.error('[health-cron] cooldown lookup 실패:', err.message);
    return new Set();
  } finally {
    clearTimeout(timer);
  }
}

// ─── GitHub Issue 자동 생성 ──────────────────────────────
async function createGithubIssue(failedSources, date) {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO;
  if (!token || !repo) return false;

  // 소스명 목록
  const nameList = failedSources.join(', ');
  const title = `[헬스체크] ${nameList} 연결 실패 — ${date}`;
  const body  = `## 데이터 소스 헬스체크 실패\n\n**날짜:** ${date}\n**실패 소스:** ${nameList}\n\n> 자동 생성된 이슈입니다.`;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'market-dashboard-health-cron',
    },
    body: JSON.stringify({ title, body, labels: ['bug', 'ai-generated'] }),
  });
  return res.ok;
}

// ─── 메인 핸들러 ────────────────────────────────────────
export default async function handler(req, res) {
  if (!authorize(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const results = await runHealthChecks();

  // fail 소스 목록 추출
  const failedSources = Object.entries(results)
    .filter(([, v]) => v.status === 'fail')
    .map(([k]) => k);
  const failCount = failedSources.length;

  // GitHub Issue 생성 — 신규 소스만 (24h 이내 이미 알림된 소스 제외)
  let issueCreated = false;
  let suppressedSources = [];
  if (failCount > 0) {
    const token = process.env.GITHUB_TOKEN;
    const repo  = process.env.GITHUB_REPO;
    const alerted = (token && repo)
      ? await getRecentlyAlertedSources(failedSources, repo, token)
      : new Set();
    const fresh = failedSources.filter(s => !alerted.has(s));
    suppressedSources = failedSources.filter(s => alerted.has(s));
    if (fresh.length > 0) {
      issueCreated = await createGithubIssue(fresh, date).catch(() => false);
    }
  }

  return res.status(200).json({ date, results, failCount, issueCreated, suppressedSources });
}
