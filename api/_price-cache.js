// api/_price-cache.js — 가격 스냅샷 Redis 캐시 (Edge/Serverless 공용)
// Vercel '_' prefix → HTTP 엔드포인트로 노출되지 않음
import { Redis } from '@upstash/redis';

let redis = null;
try {
  // Vercel KV 통합(KV_REST_API_*) 또는 Upstash 직접 통합(UPSTASH_REDIS_REST_*) 둘 다 지원
  const kvUrl   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (kvUrl && kvToken) {
    redis = new Redis({ url: kvUrl, token: kvToken });
  }
} catch (e) {
  console.error('[price-cache] Redis 연결 실패:', e);
  // graceful degradation — redis = null 유지
}

// Redis 키 — 마켓별 스냅샷
export const SNAP_KEYS = {
  KR: 'snap:kr',
  US: 'snap:us',
  COINS: 'snap:coins',
  ETF: 'snap:etf',
};

// TTL (초) — 크론 주기의 2배 (크론 지연/실패 시 데이터 유지 보장)
export const SNAP_TTL = {
  KR: 600,    // 10분 (크론 5분 × 2)
  US: 300,    // 5분 (크론 2분 × 2.5)
  COINS: 180, // 3분 (크론 1분 × 3)
  ETF: 600,   // 10분
};

// 단일 키 조회
export async function getSnap(key) {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (e) {
    console.error(`[price-cache] getSnap 실패 (${key}):`, e);
    return null;
  }
}

// 단일 키 저장 (TTL 포함)
export async function setSnap(key, data, ex) {
  if (!redis) return false;
  try {
    await redis.set(key, data, { ex });
    return true;
  } catch (e) {
    console.error(`[price-cache] setSnap 실패 (${key}):`, e);
    return false;
  }
}

// 전체 마켓 스냅샷 일괄 조회 (ETF는 cron 없음 — 클라이언트 직접 폴링)
export async function getAllSnaps() {
  if (!redis) return null;
  try {
    const [kr, us, coins] = await Promise.all([
      redis.get(SNAP_KEYS.KR),
      redis.get(SNAP_KEYS.US),
      redis.get(SNAP_KEYS.COINS),
    ]);
    return { kr, us, coins };
  } catch (e) {
    console.error('[price-cache] getAllSnaps 실패:', e);
    return null;
  }
}

export { redis };
