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
  // #185: hot tier 키 — marketCap/volume 상위 200개만 담은 작은 스냅샷.
  //       Edge `/api/snapshot?tier=hot` 이 mget 으로 한 번에 읽음.
  KR_HOT: 'snap:kr:hot',
  US_HOT: 'snap:us:hot',
  COINS_HOT: 'snap:coins:hot',
  // #334: 네이버 비공식 연장세션 ext dict (overMarketPriceInfo)
  //       update-naver-extended cron 이 hot tier 종목만 채움.
  US_EXT: 'snap:us:ext',
  KR_EXT: 'snap:kr:ext',
};

// TTL — 크론 주기(5분)의 2배로 통일. jitter/지연 흡수 버퍼 확보 (#165, #169 Codex P1)
export const SNAP_TTL = {
  KR: 600,
  US: 600,
  COINS: 600,
  ETF: 600,
  // #307: KR cron UTC 11 이후 중단 → hot snap 10분 후 만료 → 국장 탭 빈 화면.
  // 3일(259200)로 연장 — 주말 공백(금 마감→월 오픈 ~63h) 포함 커버.
  HOT: 259200,
};

// #176: 1h → 24h. 미장 quiet window(ET post 20 UTC ~ pre 08 UTC = 11h) 를 커버해
//       사용자가 자정~새벽에 앱 열 때 \"--\" 표시되는 치명적 UX 회피.
//       KR 주말은 24h 로 부분 커버 (토요일까지). 월요일 오전 누출은 별도 이슈.
const BACKUP_TTL = 86400;

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

// #128: :prev 백업 경량 재도입 — counter 기반 N회 중 1회, 메인 키만 백업.
// #125에서 subrequest 한계(50/invocation) 때문에 모든 백업을 제거했으나,
// getSnapWithFallback이 :prev를 참조하므로 fallback 무력화 → 주기적 백업 복원.
// 샤드 키는 getSnapWithFallback 대상이 아니므로 백업 스킵(죽은 subrequest 방지).
const BACKUP_INTERVAL = 5; // 크론 5분 × 5회 = 25분 주기 (BACKUP_TTL 3600s 대비 ~35분 마진)

export async function setSnap(key, data, ex) {
  if (!_redis) return false;
  try {
    // snap:* 전체 백업 — 메인 키(getSnapWithFallback) + 미국 샤드 키(api/_price-cache.js:getUsSnap)
    // 둘 다 :prev fallback을 실제 읽음. cron:fail:* 등 기타 키는 스킵.
    const isBackupKey = typeof key === 'string' && key.startsWith('snap:');

    if (isBackupKey) {
      try {
        // 총 subrequest: incr(1) + set 메인(1) + 20%[get+set:prev = 2] = 평균 2.4/호출
        const counterKey = `setSnap:counter:${key}`;
        const counter = await _redis.incr(counterKey);
        if (counter === 1) {
          // 최초 생성 시 TTL 부여 → 좀비 counter 키 누적 방지 (3시간)
          await _redis.expire(counterKey, BACKUP_TTL * 3);
        }
        if (counter % BACKUP_INTERVAL === 0) {
          // COPY는 서버 측 복제 — payload 네트워크 왕복 0
          // 원본 키가 없으면 NOT_COPIED 반환 (에러 아님)
          const copyResult = await _redis.copy(key, `${key}:prev`, { replace: true });
          if (copyResult === 'COPIED') {
            // :prev TTL 별도 부여 — COPY는 원본 TTL을 복사하므로 백업 전용 TTL 필요
            await _redis.expire(`${key}:prev`, BACKUP_TTL);
          }
        }
      } catch (e) { console.warn('[price-cache] :prev 백업 실패', key, e?.message); }
    }

    await _redis.set(key, data, { ex });
    return true;
  } catch (e) { console.error(`[price-cache] setSnap 실패 (${key}):`, e); return false; }
}

export async function recordCronFailure(cronName, errorMessage) {
  if (!_redis) return;
  try {
    const countKey = `cron:fail:${cronName}`;
    const errorKey = `cron:lastError:${cronName}`;
    // incr+expire를 트랜잭션으로 묶어 원자화 (incr 직후 중단 시 TTL 유실 → 카운터 영구 잔존 방지).
    // 매 실패마다 expire를 갱신해 슬라이딩 윈도우(1h) 유지. get+parse+set 3단계는 제거됨.
    const [newCount] = await _redis.multi().incr(countKey).expire(countKey, 3600).exec();
    await _redis.set(errorKey, JSON.stringify({
      error: String(errorMessage).slice(0, 200),
      ts: Date.now(),
      count: newCount,
    }), { ex: 3600 });
  } catch (e) { console.error(`[price-cache] recordCronFailure 실패:`, e); }
}

// 크론 정상 완료 시 호출 — lastOk 타임스탬프만 갱신.
// TTL 없음: 장기 장애 시에도 키 만료로 감지가 끊기지 않도록 영구 유지.
// cron:fail은 건드리지 않음 — 1h TTL 자연 만료. del 시 flapping 감지 불가.
export async function recordCronSuccess(cronName) {
  if (!_redis) return;
  try {
    await _redis.set(`cron:lastOk:${cronName}`, Date.now());
  } catch (e) { console.error(`[price-cache] recordCronSuccess 실패:`, e); }
}
