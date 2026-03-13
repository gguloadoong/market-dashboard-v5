// 종목 카드 컴포넌트

import Sparkline from './Sparkline';
import { fmtPrice, fmtPct, fmtChangeAmt, getPct, arrow, fmtLarge } from '../utils/format';

export default function StockCard({ item, coinUnit = 'usd', onClick }) {
  const isCoin = !!item.id;
  const pct = getPct(item);
  const isUp = pct > 0;
  const isDown = pct < 0;
  const isSurge = Math.abs(pct) >= 5;

  const dirColor = isUp ? 'c-up' : isDown ? 'c-down' : 'c-neutral';
  const badgeCls = isUp ? 'badge-up' : isDown ? 'badge-down' : 'badge-flat';

  const volume = isCoin ? item.volume24h : item.volume;
  const mcap = isCoin ? item.marketCap : item.marketCap;

  return (
    <div
      className={isSurge ? 'card-surge' : 'card'}
      onClick={() => onClick?.(item)}
    >
      <div className="p-3.5 flex flex-col gap-2">
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-text1 text-sm truncate">
                {item.symbol}
              </span>
              {item.market === 'kr' && (
                <span className="text-[10px] text-text3 bg-gray-100 px-1 rounded">KR</span>
              )}
              {isCoin && (
                <span className="text-[10px] text-text3 bg-purple-50 text-purple-500 px-1 rounded">COIN</span>
              )}
              {isSurge && (
                <span className="badge-vol">HOT</span>
              )}
            </div>
            <div className="text-[11px] text-text2 truncate mt-0.5">{item.name}</div>
          </div>

          {/* 스파크라인 */}
          <Sparkline
            data={item.sparkline}
            width={72}
            height={28}
            positive={isUp ? true : isDown ? false : undefined}
          />
        </div>

        {/* 가격 */}
        <div className="flex items-end justify-between">
          <div>
            <div className="font-bold text-text1 font-mono text-base leading-none">
              {fmtPrice(item, coinUnit)}
            </div>
            <div className={`text-xs font-mono mt-0.5 ${dirColor}`}>
              {fmtChangeAmt(item)}
            </div>
          </div>

          {/* 등락률 배지 */}
          <div className={`${badgeCls} px-2.5 py-1 rounded-lg text-sm font-bold font-mono`}>
            {arrow(pct)} {fmtPct(pct)}
          </div>
        </div>

        {/* 하단 메타 */}
        <div className="flex items-center justify-between text-[11px] text-text2 border-t border-border/50 pt-1.5">
          <span>
            <span className="text-text3">Vol </span>
            {fmtLarge(volume)}
          </span>
          {mcap && (
            <span>
              <span className="text-text3">MCap </span>
              {fmtLarge(mcap)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
