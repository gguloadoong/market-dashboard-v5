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

// TTL (초) — 크론 5분 주기 × 2 로 통일. jitter/지연 흡수 (#165, #169 Codex P1)
export const SNAP_TTL = {
  KR: 600,
  US: 600,
  COINS: 600,
  ETF: 600,
};

// 백업 키 TTL (초) — #176: 1h → 24h. 미장/국장 장 마감 quiet window 커버.
const BACKUP_TTL = 86400;

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
    // ETag는 snapshot API가 실제 데이터 내용에서 직접 계산 — 별도 ts 키 불필요
    return true;
  } catch (e) {
    console.error(`[price-cache] setSnap 실패 (${key}):`, e);
    return false;
  }
}

// US 스냅샷 조회 — #171 이후 샤딩 복원 (sharded-read 패턴).
// worker 가 snap:us:0, snap:us:1, snap:us:2 에 각 샤드를 독립적으로 씀 (race 방지).
// reader 는 mget 으로 3개 키 한 번에 가져와 Map 으로 symbol-merge.
// 샤드 하나 expire/실패 시 :prev 백업 fallback, 그마저 없으면 나머지 샤드만 반환.
// 과거 단일 snap:us 도 backward-compat 용으로 마지막 fallback 유지.
const US_SHARD_COUNT = 3;
export async function getUsSnap() {
  if (!redis) return getSnapWithFallback(SNAP_KEYS.US);
  try {
    const shardKeys = Array.from({ length: US_SHARD_COUNT }, (_, i) => `${SNAP_KEYS.US}:${i}`);
    const shards = await redis.mget(...shardKeys);
    const merged = new Map();
    const missIdx = [];
    for (let i = 0; i < shards.length; i++) {
      if (Array.isArray(shards[i])) {
        for (const item of shards[i]) merged.set(item.symbol, item);
      } else {
        missIdx.push(i);
      }
    }
    // 누락 샤드 :prev 백업 mget — N+1 쿼리 방지
    if (missIdx.length > 0) {
      try {
        const prevKeys = missIdx.map((i) => `${shardKeys[i]}:prev`);
        const backups = await redis.mget(...prevKeys);
        for (const backup of backups) {
          if (!Array.isArray(backup)) continue;
          for (const item of backup) {
            if (!merged.has(item.symbol)) merged.set(item.symbol, item);
          }
        }
      } catch { /* 백업 조회 실패 무시 */ }
    }
    if (merged.size > 0) return [...merged.values()];
    // 샤드 + 백업 전부 비어있음 → 레거시 단일 snap:us fallback (쓰기 없음, 읽기만)
    return getSnapWithFallback(SNAP_KEYS.US);
  } catch (e) {
    console.error('[price-cache] getUsSnap 샤드 읽기 실패:', e);
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
