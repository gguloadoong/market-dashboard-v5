// KIS WebSocket Approval Key 발급 엔드포인트
// POST https://openapi.koreainvestment.com:9443/oauth2/Approval
// approval_key는 access_token과 별개로 발급 (WebSocket 전용)
//
// 3-tier 캐시 (cold start 재호출 방지 — #258 후속):
//   1. 메모리 5분 (hot path, 동일 인스턴스 재사용)
//   2. Redis 23h (cold start 회복, KIS 공식 만료 24h - 1h 안전 마진)
//   3. KIS API 신규 발급

import { Redis } from '@upstash/redis';
import { HANTOO_BASE } from './_hantoo-token.js';

const REDIS_KEY = 'kis:ws_approval_key';
const REDIS_TTL_SEC = 23 * 60 * 60; // 23h
const MEM_TTL_MS = 5 * 60 * 1000;   // 5분

// 메모리 캐시 (모듈 변수 — 동일 인스턴스 내 재사용)
let memCachedKey = null;
let memCacheExpiry = 0;

// Redis 클라이언트 (lazy init — 환경변수 없거나 init 실패 시 null)
let redis = null;
function getRedis() {
  if (redis) return redis;
  // ADR-015: Vercel KV(KV_REST_API_*) 또는 Upstash 직접(UPSTASH_REDIS_REST_*) 둘 다 지원
  const kvUrl   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return null;
  // URL/token 형식 오류 등 init 단계 throw도 graceful degradation으로 처리
  try {
    redis = new Redis({ url: kvUrl, token: kvToken });
    return redis;
  } catch (e) {
    console.error('[KIS WS Approval] Redis init 실패:', e.message);
    return null;
  }
}

// 진행 중인 신규 발급 요청 (request coalescing — 동시 요청 KIS 중복 호출 방지)
let pendingFetch = null;

async function readRedis() {
  const r = getRedis();
  if (!r) return null;
  try {
    const cached = await r.get(REDIS_KEY);
    return typeof cached === 'string' && cached ? cached : null;
  } catch (e) {
    console.error('[KIS WS Approval] Redis read 실패:', e.message);
    return null;
  }
}

async function writeRedis(approvalKey) {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(REDIS_KEY, approvalKey, { ex: REDIS_TTL_SEC });
  } catch (e) {
    console.error('[KIS WS Approval] Redis write 실패:', e.message);
  }
}

export default async function handler(req, res) {
  const appKey    = process.env.HANTOO_APP_KEY;
  const appSecret = process.env.HANTOO_APP_SECRET;

  if (!appKey || !appSecret) {
    return res.status(503).json({ error: 'KIS API 키 미설정' });
  }

  const now = Date.now();

  // Tier 1: 메모리 캐시 (5분)
  if (memCachedKey && now < memCacheExpiry) {
    return res.status(200).json({ approval_key: memCachedKey });
  }

  // Tier 2: Redis 캐시 (23h) — cold start 시에도 유효
  const redisCached = await readRedis();
  if (redisCached) {
    memCachedKey = redisCached;
    memCacheExpiry = now + MEM_TTL_MS;
    return res.status(200).json({ approval_key: redisCached });
  }

  // Tier 3: KIS API 신규 발급 (request coalescing — 동시 요청은 같은 in-flight 공유)
  try {
    if (!pendingFetch) {
      pendingFetch = (async () => {
        const response = await fetch(`${HANTOO_BASE}/oauth2/Approval`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body:    JSON.stringify({
            grant_type: 'client_credentials',
            appkey:     appKey,
            appsecret:  appSecret,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`KIS Approval ${response.status}: ${text.slice(0, 120)}`);
        }

        const data = await response.json();
        if (!data.approval_key) {
          throw new Error('approval_key 없음');
        }

        // 캐시 갱신: 메모리 즉시 + Redis fire-and-forget (응답 블로킹 방지)
        memCachedKey = data.approval_key;
        memCacheExpiry = Date.now() + MEM_TTL_MS;
        void writeRedis(data.approval_key);

        return data.approval_key;
      })().finally(() => { pendingFetch = null; });
    }

    const approvalKey = await pendingFetch;
    return res.status(200).json({ approval_key: approvalKey });
  } catch (e) {
    console.error('[KIS WS Approval]', e.message);
    return res.status(502).json({ error: e.message });
  }
}
