// src/hooks/useServerSignals.js — 서버 사전 계산 시그널 구독 훅
// compute-signals 크론(10분)이 KV에 저장한 시그널을 1분 간격으로 폴링
// CDN s-maxage=60이라 실제 네트워크 호출은 부담 적음
import { useEffect, useState } from 'react';
import { loadSignals } from '../engine/signalEngine';

const POLL_INTERVAL = 60 * 1000; // 1분 (서버 cron 10분 대비 충분)
const API_URL = '/api/signals';

export function useServerSignals() {
  const [meta, setMeta] = useState({ loading: true, ts: 0, count: 0, stale: false });

  useEffect(() => {
    let cancelled = false;
    let lastTs = 0;

    async function tick() {
      if (document.hidden || cancelled) return;
      try {
        const res = await fetch(API_URL, { signal: AbortSignal.timeout(8000) });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.ts && data.ts === lastTs) {
          setMeta(m => ({ ...m, loading: false, stale: !!data.stale }));
          return;
        }
        const signals = data.signals || [];
        // stale + 0건 = KV miss/cron 장애 → 기존 시그널 유지
        if (!(data.stale && signals.length === 0)) {
          loadSignals(signals);
        }
        lastTs = data.ts || 0;
        setMeta({ loading: false, ts: data.ts, count: data.count || 0, stale: !!data.stale });
      } catch {
        if (!cancelled) setMeta(m => ({ ...m, loading: false }));
      }
    }

    tick();
    const id = setInterval(tick, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return meta;
}
