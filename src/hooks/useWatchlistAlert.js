// 관심종목 이상 신호 훅 — watchedItems × topSignals 교차해 이상 이벤트 추출
// 반환: [{ symbol, name, type: 'signal'|'mover', pct, signalTitle, direction, item }]
//   - type='signal': 관심종목 중 시그널 발화된 종목 (우선)
//   - type='mover':  ±3% 이상 변동 종목 (시그널 없는 것만, 보완)
// 최대 3건 반환. 이상 없으면 빈 배열.
import { useMemo } from 'react';
import { useSignals } from './useSignals';

const MOVER_THRESHOLD = 3; // ±3% 이상 변동 임계치
const MAX_ALERTS = 3;

// 종목 변동률 추출 — coin은 change24h, 그 외는 changePct
function getPct(w) {
  const raw = w?.changePct ?? w?.change24h ?? 0;
  return Number.isFinite(raw) ? raw : 0;
}

// symbol + market 일치 여부 — 동명이종 시장 혼돈 방지
function matchesMarket(watchItem, signal) {
  const wm = watchItem?._market ?? watchItem?.market;
  const sm = signal?.market;
  if (!wm || !sm) return true; // 한쪽이 없으면 symbol만으로 허용
  return wm === sm;
}

export function useWatchlistAlert(watchedItems = []) {
  const allSignals = useSignals(); // 전체 활성 시그널 (cap 없음, market 매칭 위해)

  return useMemo(() => {
    if (!Array.isArray(watchedItems) || watchedItems.length === 0) return [];

    // 1) signal 알림 — 관심종목 중 시그널 발화된 종목
    const signalSymbols = new Set();
    const signalAlerts = [];
    for (const sig of allSignals || []) {
      if (!sig?.symbol) continue;
      const matched = watchedItems.find(w => w.symbol === sig.symbol && matchesMarket(w, sig));
      if (!matched) continue;
      if (signalSymbols.has(sig.symbol)) continue; // 중복 방지
      signalSymbols.add(sig.symbol);
      signalAlerts.push({
        symbol: sig.symbol,
        name: matched.name || sig.name || sig.symbol,
        type: 'signal',
        pct: getPct(matched),
        signalTitle: sig.title || '',
        direction: sig.direction || 'bullish',
        item: matched,
      });
    }

    // 2) mover 알림 — ±3% 이상 변동, 시그널 없는 종목만
    const moverAlerts = [];
    for (const w of watchedItems) {
      if (!w?.symbol) continue;
      if (signalSymbols.has(w.symbol)) continue; // 시그널 종목 제외
      const pct = getPct(w);
      if (Math.abs(pct) < MOVER_THRESHOLD) continue;
      moverAlerts.push({
        symbol: w.symbol,
        name: w.name || w.symbol,
        type: 'mover',
        pct,
        signalTitle: '',
        direction: pct >= 0 ? 'bullish' : 'bearish',
        item: w,
      });
    }

    // 3) signal 우선 + mover 보완, 최대 3건
    return [...signalAlerts, ...moverAlerts].slice(0, MAX_ALERTS);
  }, [watchedItems, allSignals]);
}
