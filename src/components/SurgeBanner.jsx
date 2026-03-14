import { useMemo } from 'react';

export default function SurgeBanner({ stocks = [], coins = [] }) {
  const items = useMemo(() => {
    const all = [
      ...stocks.map(s => ({
        name:   s.name || s.symbol,
        symbol: s.symbol,
        pct:    s.changePct ?? 0,
        image:  null,
        market: s.market,
      })),
      ...coins.map(c => ({
        name:   c.name,
        symbol: c.symbol,
        pct:    c.change24h ?? 0,
        image:  c.image || null,
        market: 'coin',
      })),
    ].filter(i => i.pct >= 3)
     .sort((a, b) => b.pct - a.pct)
     .slice(0, 20);
    return [...all, ...all];
  }, [stocks, coins]);

  if (!items.length) return null;
  const dur = Math.max(28, items.length * 2);

  return (
    <div style={{ background: '#0D0D0D', height: '32px', overflow: 'hidden' }} className="flex items-center ticker-wrap">
      {/* 라벨 */}
      <div className="flex-shrink-0 px-3 border-r border-white/10 flex items-center gap-1.5 h-full">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B77] animate-pulse" />
        <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">급등</span>
      </div>
      <div className="ticker-track" style={{ '--dur': `${dur}s` }}>
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-4 text-[11px] font-medium">
            <span className="font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{item.symbol}</span>
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>{item.name}</span>
            <span className="font-bold tabular-nums" style={{ color: '#FF6B77' }}>
              ▲{item.pct.toFixed(2)}%
            </span>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
