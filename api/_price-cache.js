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

// 백업 키 TTL (초) — 1시간
const BACKUP_TTL = 3600;

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

// 단일 키 조회 + 실패 시 백업 키에서 복구
export async function getSnapWithFallback(key) {
  const data = await getSnap(key);
  if (data !== null) return data;
  // 원본 키 실패/만료 → 백업 키에서 복구 시도
  if (!redis) return null;
  try {
    const backup = await redis.get(`${key}:prev`);
    if (backup !== null) {
      console.warn(`[price-cache] ${key} 캐시 미스 → 백업(${key}:prev)에서 복구`);
    }
    return backup;
  } catch (e) {
    console.error(`[price-cache] 백업 조회 실패 (${key}:prev):`, e);
    return null;
  }
}

// 단일 키 저장 (TTL 포함) — 기존 데이터를 :prev 백업 키에 보존
export async function setSnap(key, data, ex) {
  if (!redis) return false;
  try {
    // 백업은 best-effort — 실패해도 본 데이터 저장은 진행
    try {
      const existing = await redis.get(key);
      if (existing !== null) {
        await redis.set(`${key}:prev`, existing, { ex: BACKUP_TTL });
      }
    } catch (backupErr) {
      console.warn(`[price-cache] 백업 저장 실패 (${key}:prev):`, backupErr.message);
    }
    await redis.set(key, data, { ex });
    // ETag용 타임스탬프 갱신 — snapshot API가 304 판별에 사용 (단일 키)
    await redis.set('snap:ts', Date.now(), { ex }).catch(() => {});
    return true;
  } catch (e) {
    console.error(`[price-cache] setSnap 실패 (${key}):`, e);
    return false;
  }
}

// US 샤드 병합 조회 — snap:us:0~N 샤드 + snap:us 레거시 fallback
export async function getUsSnap() {
  if (!redis) return null;
  try {
    // 샤드 수 동적 조회 (크론이 저장)
    const shardCount = parseInt(await redis.get('us:cron:shardCount') || '0', 10);
    if (shardCount > 0) {
      // mget으로 한 번에 조회
      const shardKeys = Array.from({ length: shardCount }, (_, i) => `snap:us:${i}`);
      const shards = await redis.mget(...shardKeys);
      const merged = new Map();
      // 만료된 샤드 인덱스를 모아서 backup 일괄 조회 (N+1 방지)
      const missIdx = [];
      for (let i = 0; i < shards.length; i++) {
        if (Array.isArray(shards[i])) {
          for (const item of shards[i]) merged.set(item.symbol, item);
        } else {
          missIdx.push(i);
        }
      }
      if (missIdx.length > 0) {
        try {
          const prevKeys = missIdx.map(i => `${shardKeys[i]}:prev`);
          const backups = await redis.mget(...prevKeys);
          for (const backup of backups) {
            if (!Array.isArray(backup)) continue;
            for (const item of backup) merged.set(item.symbol, item);
          }
        } catch (_) { /* 백업 일괄 조회 실패 무시 */ }
      }
      if (merged.size > 0) return [...merged.values()];
    }
    // 샤드 없으면 레거시 fallback
    return getSnapWithFallback(SNAP_KEYS.US);
  } catch (e) {
    console.error('[price-cache] getUsSnap 실패:', e);
    return getSnapWithFallback(SNAP_KEYS.US);
  }
}

// 전체 마켓 스냅샷 일괄 조회 (백업 fallback 포함)
// ETF는 cron 없음 — 클라이언트 직접 폴링
export async function getAllSnaps() {
  if (!redis) return null;
  try {
    const [kr, us, coins] = await Promise.all([
      getSnapWithFallback(SNAP_KEYS.KR),
      getUsSnap(),
      getSnapWithFallback(SNAP_KEYS.COINS),
    ]);
    return { kr, us, coins };
  } catch (e) {
    console.error('[price-cache] getAllSnaps 실패:', e);
    return null;
  }
}

// ─── Cron 실패 모니터링 ───

// Cron 실패 기록 — 실패 카운터 incr + 마지막 에러 JSON 저장
export async function recordCronFailure(cronName, errorMessage) {
  if (!redis) return;
  try {
    const countKey = `cron:fail:${cronName}`;
    const errorKey = `cron:lastError:${cronName}`;
    // 카운터: get→+1→set — TTL이 set에 포함되어 누락 불가 (동시 실패 시 카운터 부정확 가능, 모니터링 용도 허용)
    const prev = parseInt(await redis.get(countKey) || '0', 10);
    await Promise.all([
      redis.set(countKey, prev + 1, { ex: 3600 }),
      redis.set(errorKey, JSON.stringify({
        error: String(errorMessage).slice(0, 200),
        ts: Date.now(),
        count: prev + 1,
      }), { ex: 3600 }),
    ]);
  } catch (e) {
    console.error(`[price-cache] recordCronFailure 실패 (${cronName}):`, e);
  }
}

// Cron 헬스 체크 — 3개 마켓의 실패 카운터 + 마지막 에러 반환
export async function getCronHealth() {
  if (!redis) return null;
  const markets = ['kr', 'us', 'coins'];
  try {
    const results = await Promise.all(
      markets.map(async (m) => {
        const [failCount, lastError] = await Promise.all([
          redis.get(`cron:fail:${m}`),
          redis.get(`cron:lastError:${m}`),
        ]);
        return {
          market: m,
          failCount: parseInt(failCount || '0', 10),
          lastError: lastError ? (typeof lastError === 'string' ? JSON.parse(lastError) : lastError) : null,
        };
      }),
    );
    return results;
  } catch (e) {
    console.error('[price-cache] getCronHealth 실패:', e);
    return null;
  }
}

export { redis };
