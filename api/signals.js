// api/signals.js — 사전 계산된 시그널 조회 (KV 읽기)
// #398: CF Worker의 'signals:latest'(composite)와 패턴 크론의 'signals:patterns'
// (double_bottom/SRB)를 머지해 단일 피드로 노출. 클라 loadSignals는 이미 패턴 타입 수용.
export const config = { runtime: 'edge' };
import { getSnapWithFallback } from './_price-cache.js';

export default async function handler() {
  const [latest, patterns] = await Promise.all([
    getSnapWithFallback('signals:latest'),
    getSnapWithFallback('signals:patterns'),
  ]);

  const now = Date.now();

  // [review HIGH] CF 피드(latest) 미스 시 기존과 동일하게 빈 stale 응답 —
  // 패턴만 length>0으로 내려보내면 클라 `stale && 0건` 가드를 통과해 loadSignals가
  // 서버 관할 전 타입을 replace → 일시 장애 동안 composite 카드 전멸(가드 회귀).
  if (!latest) {
    return new Response(JSON.stringify({
      ts: 0,
      generatedAt: null,
      count: 0,
      signals: [],
      stale: true,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }

  const latestSignals = Array.isArray(latest.signals) ? latest.signals : [];
  // 패턴은 형성 시에만 존재 + expiresAt 지난 항목 제외.
  // 타입 화이트리스트(심층 방어) — patterns 키에 composite가 섞여도 중복 카드 차단 (review HIGH)
  // 문자열 하드코딩 사유: api/(Edge)는 src/engine 미import — 번들 분리 유지 (review STYLE)
  const PATTERN_FEED_TYPES = new Set(['double_bottom', 'support_resistance_break']);
  const patternSignals = (Array.isArray(patterns?.signals) ? patterns.signals : [])
    .filter(s => s && PATTERN_FEED_TYPES.has(s.type) && (!s.expiresAt || s.expiresAt > now));
  const signals = [...latestSignals, ...patternSignals];

  // stale 판정은 composite 피드(10분 주기) 기준 유지 — 패턴(시간 단위)은 판정에서 제외
  const ageMs = now - (latest.ts || 0);
  const stale = ageMs > 25 * 60 * 1000;

  return new Response(JSON.stringify({
    ts: latest?.ts ?? patterns?.ts ?? 0,
    generatedAt: latest?.generatedAt ?? patterns?.generatedAt ?? null,
    count: signals.length,
    signals,
    stale,
    patternTs: patterns?.ts ?? null,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
    },
  });
}
