// 가격 스냅샷 Redis 캐시 — CF Workers용 (Vercel _price-cache.js 이식)
import { Redis } from '@upstash/redis';

let _redis = null;

// CF Workers에서는 env 객체로 환경변수 접근 — init() 호출 필요
export function initRedis(env) {
  if (_redis) return _redis;
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export function getRedis() { return _redis; }

export const SNAP_KEYS = {
  KR: 'snap:kr',
  US: 'snap:us',
  COINS: 'snap:coins',
  ETF: 'snap:etf',
};

export const SNAP_TTL = {
  KR: 600,
  US: 300,
  COINS: 180,
  ETF: 600,
};

const BACKUP_TTL = 3600;

export async function getSnap(key) {
  if (!_redis) return null;
  try { return await _redis.get(key); }
  catch (e) { console.error(`[price-cache] getSnap 실패 (${key}):`, e); return null; }
}

export async function getSnapWithFallback(key) {
  const data = await getSnap(key);
  if (data !== null) return data;
  if (!_redis) return null;
  try {
    const backup = await _redis.get(`${key}:prev`);
    if (backup !== null) console.warn(`[price-cache] ${key} → 백업 복구`);
    return backup;
  } catch (e) { console.error(`[price-cache] 백업 조회 실패:`, e); return null; }
}

export async function setSnap(key, data, ex) {
  if (!_redis) return false;
  try {
    // #125: :prev 백업 쓰기 제거 — subrequest 한계(50/invocation) 회피
    // get+set 2회 → set 1회로 감소. 원본 snap:<key> TTL이 크론 주기의 2배이므로
    // 크론 1회 실패는 다음 주기에 자연 복구. 장시간 다운 대비는 Worker 전체 장애 상황.
    await _redis.set(key, data, { ex });
    return true;
  } catch (e) { console.error(`[price-cache] setSnap 실패 (${key}):`, e); return false; }
}

export async function recordCronFailure(cronName, errorMessage) {
  if (!_redis) return;
  try {
    const countKey = `cron:fail:${cronName}`;
    const errorKey = `cron:lastError:${cronName}`;
    const prev = parseInt(await _redis.get(countKey) || '0', 10);
    await Promise.all([
      _redis.set(countKey, prev + 1, { ex: 3600 }),
      _redis.set(errorKey, JSON.stringify({
        error: String(errorMessage).slice(0, 200),
        ts: Date.now(),
        count: prev + 1,
      }), { ex: 3600 }),
    ]);
  } catch (e) { console.error(`[price-cache] recordCronFailure 실패:`, e); }
}
