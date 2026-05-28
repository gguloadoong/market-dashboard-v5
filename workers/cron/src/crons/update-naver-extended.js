// crons/update-naver-extended.js — 네이버 비공식 API 프록시
// #334: 미장 프리/애프터 실시세 + 국장 NXT 참고가 (overMarketPriceInfo)
//
// 대표 승인 비공식 API. 정규장 시세는 한투/Yahoo 메인 의존, 네이버는 연장거래 보조만.
// 외부 Origin 403 (CORS) → 서버 프록시 필수. CF Workers cron 에서만 호출.
//
// 호출 대상: hot-tier(Top 200)만, 연장거래 구간에만 호출
//   - US: 프리(ET04~09:30) / 애프터(ET16~20)
//   - KR: NXT 프리(KST08:00~08:50) / NXT 시간외(KST15:30~20:00)
// 정규장·완전마감 시 호출 안 함 (Upstash 대역폭 #331 대응).
//
// 캐싱: snap:us:ext (60s TTL 활성 / 5m TTL 비활성), snap:kr:ext 동일.
// 마지막 유효 overPrice 는 stale 보관 (네이버 실패/null 시 폴백).

import { SNAP_KEYS, getSnap, setSnap, recordCronFailure, recordCronSuccess } from '../price-cache.js';

// ── Naver 모바일 공통 헤더 (update-kr.js NAVER_MOBILE_HEADERS 동일 패턴) ──
const NAVER_MOBILE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  'Referer': 'https://m.stock.naver.com/',
  'Accept': 'application/json',
};

// ── TTL ────────────────────────────────────────────────────────
// 키는 SNAP_KEYS.US_EXT / KR_EXT 사용 (price-cache.js 중앙 정의).
const EXT_TTL_ACTIVE = 120;     // 연장세션 구간 (60s 호출 + 60s 여유)
const EXT_TTL_STALE  = 3600;    // 연장 종료 후 fallback (1h, 현재 미사용)

// ── Yahoo dash → Naver 원본 변환 (BRK-B → BRK.B), AMEX/NYSE/NASDAQ 매핑 ──
// update-us.js는 NASDAQ API 응답의 exchange ('NASDAQ'|'NYSE'|'AMEX') 를 snap:us:N 의 각 종목에 저장하지 않는다.
// 따라서 여기서는 hot 스냅샷에 exchange 가 없을 수 있어 'O'(NASDAQ) 우선 시도 후 'N','A' fallback.
const SFX_PRIORITY = ['O', 'N', 'A'];

// Naver 미장은 dot 심볼 — Yahoo 는 dash. snap:us 의 symbol 은 yahooSymbol(dash) 로 저장됨.
// → 그대로 SFX 뒤에 붙이되, BRK-B 같은 dash 그대로 보존이 Naver에 통한다 (실증 결과 confirmed).
function buildUsUrl(symbol, sfx) {
  return `https://api.stock.naver.com/stock/${encodeURIComponent(symbol)}.${sfx}/basic`;
}

function buildKrUrl(symbol) {
  return `https://m.stock.naver.com/api/stock/${encodeURIComponent(symbol)}/basic`;
}

// ── 시간 판정 (CF Workers — Asia/Seoul/America/New_York 직접 변환) ─────
function nowKst() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}
function nowEt() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}
function isWeekday(d) {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}
// 미장 연장세션 — ET 평일 04:00~09:30(프리) 또는 16:00~20:00(애프터)
function isUsExtSession(et = nowEt()) {
  if (!isWeekday(et)) return false;
  const m = et.getHours() * 60 + et.getMinutes();
  if (m >= 4 * 60 && m < 9 * 60 + 30) return true;
  if (m >= 16 * 60 && m < 20 * 60) return true;
  return false;
}
// 국장 NXT — KST 평일 08:00~08:50(프리) 또는 15:30~20:00(애프터)
function isKrExtSession(kst = nowKst()) {
  if (!isWeekday(kst)) return false;
  const m = kst.getHours() * 60 + kst.getMinutes();
  if (m >= 8 * 60 && m < 8 * 60 + 50) return true;
  if (m >= 15 * 60 + 30 && m < 20 * 60) return true;
  return false;
}

// ── 응답 파싱 (US/KR 공통 overMarketPriceInfo) ─────────────────
// 국내가격은 쉼표포함 문자열 → 쉼표 제거. raw 필드 우선 (쉼표 없음 검증됨).
function parseExtended(json, isKr) {
  const info = json?.overMarketPriceInfo;
  if (!info) return null;
  const sessionType = info.tradingSessionType;     // 'PRE_MARKET' | 'AFTER_MARKET'
  const status      = info.overMarketStatus;       // 'OPEN' | 'CLOSE'
  if (sessionType !== 'PRE_MARKET' && sessionType !== 'AFTER_MARKET') return null;
  const rawPrice    = info.overPriceRaw ?? info.overPrice;
  const rawPct      = info.fluctuationsRatioRaw ?? info.fluctuationsRatio;
  if (rawPrice == null || rawPct == null) return null;
  const price = parseFloat(String(rawPrice).replace(/,/g, ''));
  const pct   = parseFloat(String(rawPct).replace(/,/g, ''));
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(pct)) return null;
  // 국장 NXT 라벨 매핑 (PRE_MARKET → NXT_PRE, AFTER_MARKET → NXT_AFTER)
  const labelSession = isKr
    ? (sessionType === 'PRE_MARKET' ? 'NXT_PRE' : 'NXT_AFTER')
    : sessionType;
  return {
    extendedPrice:        parseFloat(price.toFixed(4)),
    extendedChangePct:    parseFloat(pct.toFixed(2)),
    extendedSessionType:  labelSession,
    extendedStatus:       status === 'OPEN' ? 'OPEN' : 'CLOSE',
    extendedAt:           info.localTradedAt || new Date().toISOString(),
  };
}

// ── 미장 단일 종목 호출 — SFX 3종 fallback (O→N→A) ────────────────
async function fetchNaverUsSingle(symbol, timeoutMs = 5000) {
  for (const sfx of SFX_PRIORITY) {
    try {
      const res = await fetch(buildUsUrl(symbol, sfx), {
        headers: NAVER_MOBILE_HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const parsed = parseExtended(data, false);
      if (parsed) return parsed;
    } catch (_) { /* 다음 SFX 시도 */ }
  }
  return null;
}

// ── 국장 단일 종목 호출 ─────────────────────────────────────────
async function fetchNaverKrSingle(symbol, timeoutMs = 5000) {
  try {
    const res = await fetch(buildKrUrl(symbol), {
      headers: NAVER_MOBILE_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseExtended(data, true);
  } catch (_) {
    return null;
  }
}

// ── 배치 호출 — 동시성 제한 + stale 폴백 머지 ────────────────────
const CONCURRENCY = 10;     // 200종목 × 3 SFX 최악 = 600 subreq → 20병렬 안전

async function fetchBatch(symbols, fetcher) {
  const out = {};
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const chunk = symbols.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((s) => fetcher(s)));
    for (let j = 0; j < settled.length; j++) {
      if (settled[j].status === 'fulfilled' && settled[j].value) {
        out[chunk[j]] = settled[j].value;
      }
    }
  }
  return out;
}

// ── 메인: 시장(US/KR) 갱신 ─────────────────────────────────────
async function updateMarket(market) {
  const isKr = market === 'kr';
  const inSession = isKr ? isKrExtSession() : isUsExtSession();
  const hotKey   = isKr ? SNAP_KEYS.KR_HOT : SNAP_KEYS.US_HOT;
  const extKey   = isKr ? SNAP_KEYS.KR_EXT : SNAP_KEYS.US_EXT;
  const fetcher  = isKr ? fetchNaverKrSingle : fetchNaverUsSingle;

  // 연장세션 밖이면 호출 안 함 (대역폭 #331 보호). 기존 stale extKey 는 TTL 까지 유지.
  if (!inSession) {
    return { market, skipped: true, reason: 'not-in-extended-session' };
  }

  // hot tier 로드 (Top 200 마켓캡)
  const hot = await getSnap(hotKey);
  if (!Array.isArray(hot) || hot.length === 0) {
    return { market, skipped: true, reason: 'no-hot-snap' };
  }
  const symbols = hot.map((s) => s.symbol).filter(Boolean);
  const fresh = await fetchBatch(symbols, fetcher);

  // 기존 ext 와 머지 (네이버 실패/null 종목은 stale 유지)
  const prev = (await getSnap(extKey)) || {};
  const merged = { ...prev, ...fresh };

  await setSnap(extKey, merged, EXT_TTL_ACTIVE);
  return {
    market,
    fetched: Object.keys(fresh).length,
    merged:  Object.keys(merged).length,
    target:  symbols.length,
  };
}

// ── 외부 진입점 — index.js 에서 cron 분기로 호출 ────────────────
export async function updateNaverExtended(env) {
  void env; // initRedis 는 호출측에서 처리
  const results = { ts: Date.now() };
  try {
    // US/KR 동시 처리 — 서로 다른 hot key 라서 race 없음
    const [us, kr] = await Promise.all([
      updateMarket('us').catch((e) => ({ market: 'us', error: e?.message || String(e) })),
      updateMarket('kr').catch((e) => ({ market: 'kr', error: e?.message || String(e) })),
    ]);
    results.us = us;
    results.kr = kr;
    const anyOk = (us && !us.error && !us.skipped) || (kr && !kr.error && !kr.skipped);
    if (anyOk) {
      try { await recordCronSuccess('naver-extended'); } catch (_) {}
    }
    return { ok: true, ...results };
  } catch (err) {
    try { await recordCronFailure('naver-extended', String(err?.message || err)); } catch (_) {}
    return { ok: false, error: String(err?.message || err), ...results };
  }
}

// 외부 노출 — 테스트/모듈 재사용용
export { EXT_TTL_ACTIVE, EXT_TTL_STALE, parseExtended, isUsExtSession, isKrExtSession };
