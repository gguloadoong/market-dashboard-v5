// 토스증권 스타일 종목 행 컴포넌트
import { useRef, useEffect } from 'react';
import Sparkline from './Sparkline';
import { fmtPrice, fmtPct, getPct, arrow, fmtLarge, fmtChangeAmt } from '../utils/format';

export default function StockRow({ item, rank, coinUnit = 'usd', onClick, showVolume = false }) {
  const isCoin = !!item.id;
  const pct = getPct(item);
  const isUp = pct > 0;
  const isDown = pct < 0;

  const prevPct = useRef(pct);
  const rowRef = useRef(null);
  useEffect(() => {
    if (pct !== prevPct.current && rowRef.current) {
      const cls = pct > prevPct.current ? 'flash-up' : 'flash-down';
      rowRef.current.classList.add(cls);
      setTimeout(() => rowRef.current?.classList.remove(cls), 700);
    }
    prevPct.current = pct;
  }, [pct]);

  const pctCls = isUp ? 'text-up' : isDown ? 'text-down' : 'text-text2';
  const badgeCls = isUp ? 'bg-red-50 text-up' : isDown ? 'bg-blue-50 text-down' : 'bg-gray-100 text-text2';

  return (
    <div ref={rowRef} className="stock-row" onClick={() => onClick?.(item)}>
      {/* 순위 */}
      {rank != null && (
        <span className="text-[13px] text-text3 w-5 text-center flex-shrink-0">{rank}</span>
      )}

      {/* 종목 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[15px] text-text1 truncate">{item.name}</span>
          {isCoin && <span className="text-[10px] bg-purple-50 text-purple-400 px-1 rounded flex-shrink-0">COIN</span>}
          {item.market === 'us' && !isCoin && <span className="text-[10px] bg-blue-50 text-blue-400 px-1 rounded flex-shrink-0">US</span>}
        </div>
        <div className="text-[12px] text-text3 mt-0.5">
          {item.symbol}
          {showVolume && <span className="ml-2">거래량 {fmtLarge(isCoin ? item.volume24h : item.volume)}</span>}
        </div>
      </div>

      {/* 스파크라인 */}
      <Sparkline data={item.sparkline} width={56} height={24} positive={isUp ? true : isDown ? false : undefined} />

      {/* 가격 + 등락 */}
      <div className="text-right flex-shrink-0 min-w-[80px]">
        <div className="font-semibold text-[15px] text-text1 tabular-nums">
          {fmtPrice(item, coinUnit)}
        </div>
        <div className={`text-[12px] tabular-nums mt-0.5 ${pctCls}`}>
          {fmtChangeAmt(item) || (isCoin ? '' : '')}
        </div>
      </div>

      {/* 등락률 배지 */}
      <div className={`${badgeCls} rounded-lg px-2 py-1 text-[13px] font-semibold tabular-nums flex-shrink-0 min-w-[64px] text-right`}>
        {arrow(pct)} {Math.abs(pct).toFixed(2)}%
      </div>
    </div>
  );
}
