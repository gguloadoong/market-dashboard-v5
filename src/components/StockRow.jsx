import { useRef, useEffect } from 'react';
import Sparkline from './Sparkline';
import { fmtPrice, getPct, fmtLarge } from '../utils/format';

export default function StockRow({ item, rank, coinUnit = 'usd', onClick }) {
  const isCoin = !!item.id;
  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;

  const rowRef  = useRef(null);
  const prevPct = useRef(pct);
  useEffect(() => {
    if (pct !== prevPct.current && rowRef.current) {
      const cls = pct > prevPct.current ? 'flash-up' : 'flash-down';
      rowRef.current.classList.add(cls);
      const t = setTimeout(() => rowRef.current?.classList.remove(cls), 600);
      return () => clearTimeout(t);
    }
    prevPct.current = pct;
  }, [pct]);

  return (
    <div ref={rowRef} className="stock-row" onClick={() => onClick?.(item)}>
      {/* 순위 */}
      {rank != null && (
        <span className="text-[13px] text-text3 w-4 text-center flex-shrink-0 font-medium">{rank}</span>
      )}

      {/* 이름 */}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-text1 truncate leading-tight">{item.name}</div>
        <div className="text-[12px] text-text3 mt-0.5 truncate">
          {item.symbol}
          {item.sector && <span className="ml-1.5 text-[11px] text-text3/70">{item.sector}</span>}
        </div>
      </div>

      {/* 스파크라인 */}
      <Sparkline data={item.sparkline} width={52} height={22} positive={isUp ? true : isDown ? false : undefined} />

      {/* 현재가 */}
      <div className="flex-shrink-0 w-[88px] text-right">
        <div className="text-[14px] font-semibold text-text1 tabular-nums leading-tight truncate">
          {fmtPrice(item, coinUnit)}
        </div>
      </div>

      {/* 등락률 */}
      <div className="flex-shrink-0 w-[60px] text-right">
        <div className={`text-[13px] tabular-nums font-semibold ${isUp ? 'text-up' : isDown ? 'text-down' : 'text-text2'}`}>
          {isUp ? '+' : ''}{pct?.toFixed(2)}%
        </div>
      </div>

      {/* 거래량 */}
      <div className="flex-shrink-0 w-[64px] text-right">
        <div className="text-[11px] text-text3 tabular-nums">
          {fmtLarge(isCoin ? item.volume24h : item.volume) || '—'}
        </div>
      </div>
    </div>
  );
}
