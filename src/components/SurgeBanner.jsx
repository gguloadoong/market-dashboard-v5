import { useMemo } from 'react';

export default function SurgeBanner({ stocks = [], coins = [] }) {
  const items = useMemo(() => {
    const all = [
      ...stocks.map(s => ({
        label: s.name || s.symbol,   // 한국어 이름 우선
        sub:   s.symbol,
        pct:   s.changePct ?? 0,
      })),
      ...coins.map(c => ({
        label: c.symbol,
        sub:   c.name,
        pct:   c.change24h ?? 0,
      })),
    ].filter(i => i.pct >= 3)  // PRD 스펙: +3% 이상 급상승 종목만 표시
     .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
     .slice(0, 20);
    return [...all, ...all]; // 루프용 복사
  }, [stocks, coins]);

  if (!items.length) return null;
  const dur = Math.max(25, items.length * 1.8);

  return (
    <div style={{ background: '#0D0D0D', height: '28px', overflow: 'hidden' }} className="flex items-center ticker-wrap">
      <div className="ticker-track" style={{ '--dur': `${dur}s` }}>
        {items.map((item, i) => {
          const isUp = item.pct > 0;
          return (
            <span key={i} className="inline-flex items-center gap-1.5 px-5 text-[11px] font-medium tracking-[0.2px]">
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{item.label}</span>
              <span style={{ color: isUp ? '#FF6B77' : item.pct < 0 ? '#5B9BF5' : 'rgba(255,255,255,0.3)' }}>
                {isUp ? '▲' : item.pct < 0 ? '▼' : '—'}{Math.abs(item.pct).toFixed(2)}%
              </span>
              <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', marginLeft: '2px' }}>|</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
