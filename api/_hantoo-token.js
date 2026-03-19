// 한투 Open API 토큰 관리 — Vercel serverless 내부 공유 모듈
// 파일명 _ prefix → Vercel이 HTTP 엔드포인트로 노출하지 않음
//
// 캐시 2단계:
//   1) 메모리 캐시 — 동일 함수 인스턴스 내 즉시 재사용
//   2) /tmp 파일 캐시 — 같은 컨테이너의 다른 함수 경로(hantoo-price, hantoo-market-investor 등)와 공유
// 두 캐시 모두 만료되었을 때만 한투 API 호출 → 24h 당 최대 1회 토큰 발급
// 동시 요청 중복 방지(request coalescing): 발급 중인 요청이 있으면 그 Promise를 공유

import { readFileSync, writeFileSync } from 'fs';

export const HANTOO_BASE = 'https://openapi.koreainvestment.com:9443';
const CACHE_FILE = '/tmp/hantoo-token-cache.json';

// 메모리 캐시 (동일 함수 인스턴스)
let memToken  = null;
let memExpiry = 0;

// 진행 중인 토큰 발급 요청 (중복 방지)
let pendingRequest = null;

function readFileCache() {
  try {
    const raw  = readFileSync(CACHE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return (data?.token && data?.expiry) ? data : null;
  } catch { return null; }
}

function writeFileCache(token, expiry) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ token, expiry }), 'utf8');
  } catch {} // /tmp 쓰기 실패는 치명적 아님 — 메모리 캐시로 동작
}

/**
 * 한투 OAuth 토큰 반환
 * - 메모리 캐시 유효 → 즉시 반환
 * - /tmp 파일 캐시 유효 → 메모리에 로드 후 반환
 * - 둘 다 만료 → POST /oauth2/tokenP 신규 발급 (동시 요청은 1회만 실행)
 */
export async function getHantooToken() {
  const now = Date.now();

  // 1) 메모리 캐시
  if (memToken && now < memExpiry - 60_000) return memToken;

  // 2) /tmp 파일 캐시 (다른 함수 경로가 이미 발급한 토큰 재사용)
  const file = readFileCache();
  if (file && now < file.expiry - 60_000) {
    memToken  = file.token;
    memExpiry = file.expiry;
    return memToken;
  }

  // 3) 신규 발급 — 동시 요청 중복 방지
  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    const res = await fetch(`${HANTOO_BASE}/oauth2/tokenP`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        grant_type: 'client_credentials',
        appkey:     process.env.HANTOO_APP_KEY,
        appsecret:  process.env.HANTOO_APP_SECRET,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`한투 토큰 발급 실패 ${res.status}: ${text.slice(0, 120)}`);
    }

    const data = await res.json();
    if (!data.access_token) {
      throw new Error(`한투 토큰 없음: ${JSON.stringify(data).slice(0, 200)}`);
    }

    memToken  = data.access_token;
    memExpiry = now + (data.expires_in ?? 86400) * 1000;
    writeFileCache(memToken, memExpiry);
    return memToken;
  })().finally(() => { pendingRequest = null; });

  return pendingRequest;
}
