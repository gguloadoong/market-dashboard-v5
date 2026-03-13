import { useMemo } from 'react';
import { fmtPct, getPct } from '../utils/format';

export default function SurgeBanner({ stocks = [], coins = [] }) {
  const items = useMemo(() => {
    const all = [
      ...stocks.map(s => ({ symbol: s.symbol, name: s.name, pct: s.changePct ?? 0 })),
      ...coins.map(c => ({ symbol: c.symbol, name: c.name, pct: c.change24h ?? 0 })),
    ].filter(i => Math.abs(i.pct) >= 0.5)
     .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
     .slice(0, 24);
    return [...all, ...all]; // 무한 루프용 복제
  }, [stocks, coins]);

  if (!items.length) return null;
  const dur = Math.max(30, items.length * 2);

  return (
    <div className="bg-[#111] h-7 flex items-center ticker-wrap overflow-hidden">
      <div className="ticker-track" style={{ '--dur': `${dur}s` }}>
        {items.map((item, i) => {
          const isUp = item.pct > 0;
          const isDown = item.pct < 0;
          return (
            <span key={i} className="inline-flex items-center gap-1.5 px-4 text-[12px]">
              <span className="text-white/60">{item.symbol}</span>
              <span className={isUp ? 'text-[#FF6B6B]' : isDown ? 'text-[#5B9BF5]' : 'text-white/40'}>
                {isUp ? '▲' : isDown ? '▼' : '—'}{fmtPct(Math.abs(item.pct))}
              </span>
              <span className="text-white/20 text-[10px] ml-1">|</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
