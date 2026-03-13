// 급상승/급하락 티커 배너

import { useMemo } from 'react';
import { fmtPct, getPct } from '../utils/format';

function TickerItem({ item }) {
  const pct = getPct(item);
  const isUp = pct > 0;
  const isDown = pct < 0;

  return (
    <span className="inline-flex items-center gap-1.5 px-3 mx-2 whitespace-nowrap">
      <span className="font-semibold text-text1 text-xs">{item.symbol || item.name}</span>
      <span className={`text-xs font-mono ${isUp ? 'c-up' : isDown ? 'c-down' : 'c-neutral'}`}>
        {isUp ? '▲' : isDown ? '▼' : '—'} {fmtPct(pct)}
      </span>
    </span>
  );
}

export default function SurgeBanner({ stocks = [], coins = [] }) {
  const surging = useMemo(() => {
    const allItems = [
      ...stocks.map(s => ({ ...s, _pctAbs: Math.abs(s.changePct ?? 0) })),
      ...coins.map(c => ({ ...c, _pctAbs: Math.abs(c.change24h ?? 0) })),
    ];
    return allItems
      .filter(item => item._pctAbs >= 1.5)
      .sort((a, b) => b._pctAbs - a._pctAbs)
      .slice(0, 20);
  }, [stocks, coins]);

  if (surging.length === 0) return null;

  // 듀플리케이트로 무한 루프 효과
  const items = [...surging, ...surging];
  const dur = Math.max(30, surging.length * 3);

  return (
    <div className="bg-gray-900 text-white overflow-hidden h-8 flex items-center border-b border-gray-800">
      <div
        className="ticker-track"
        style={{ '--dur': `${dur}s` }}
      >
        {items.map((item, i) => (
          <TickerItem key={`${item.id || item.symbol}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
