// 한투 Open API 토큰 관리 — CF Workers용 (_hantoo-token.js 이식)
// CF Workers에는 /tmp 파일시스템 없음 → 메모리 + Redis 2단계 캐시
import { getRedis } from './price-cache.js';

export const HANTOO_BASE = 'https://openapi.koreainvestment.com:9443';
const REDIS_KEY = 'hantoo:token';
const REDIS_TTL = 23 * 60 * 60;

let memToken = null;
let memExpiry = 0;
let pendingRequest = null;

async function readRedisCache() {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const data = await redis.get(REDIS_KEY);
    if (data?.token && data?.expiry && Date.now() < data.expiry - 60_000) return data;
    return null;
  } catch { return null; }
}

async function writeRedisCache(token, expiry) {
  const redis = getRedis();
  if (!redis) return;
  try { await redis.set(REDIS_KEY, { token, expiry }, { ex: REDIS_TTL }); } catch {}
}

export async function getHantooToken(env) {
  const now = Date.now();
  if (memToken && now < memExpiry - 60_000) return memToken;

  const redisData = await readRedisCache();
  if (redisData) {
    memToken = redisData.token;
    memExpiry = redisData.expiry;
    return memToken;
  }

  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    const res = await fetch(`${HANTOO_BASE}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: env.HANTOO_APP_KEY,
        appsecret: env.HANTOO_APP_SECRET,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`한투 토큰 발급 실패 ${res.status}: ${text.slice(0, 120)}`);
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('한투 토큰 없음');

    memToken = data.access_token;
    memExpiry = now + (data.expires_in ?? 86400) * 1000;
    await writeRedisCache(memToken, memExpiry);
    return memToken;
  })().finally(() => { pendingRequest = null; });

  return pendingRequest;
}
