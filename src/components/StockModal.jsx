import { useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fmtPrice, fmtPct, fmt, fmtLarge, getPct, arrow, barPos } from '../utils/format';

export default function StockModal({ item, coinUnit = 'usd', onClose }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  if (!item) return null;
  const isCoin = !!item.id;
  const pct = getPct(item);
  const isUp = pct > 0;
  const isDown = pct < 0;
  const color = isUp ? '#FF4136' : isDown ? '#1A73E8' : '#8B95A1';
  const high = isCoin ? item.high24h : item.high52w;
  const low  = isCoin ? item.low24h  : item.low52w;
  const chartData = (item.sparkline ?? []).map((v, i) => ({ i, v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[20px] text-text1">{item.name}</span>
              <span className="text-[12px] text-text3 bg-[#F2F4F6] px-2 py-0.5 rounded-full">{item.symbol}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-bold text-[26px] text-text1 tabular-nums">{fmtPrice(item, coinUnit)}</span>
              <span className={`font-semibold text-[15px] tabular-nums ${isUp ? 'text-up' : isDown ? 'text-down' : 'text-text2'}`}>
                {arrow(pct)} {fmtPct(pct)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-text3 hover:text-text1 text-xl mt-1">✕</button>
        </div>

        {/* 차트 */}
        {chartData.length > 1 && (
          <div className="h-36 px-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="i" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: 'none', background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', borderRadius: 8 }}
                  formatter={v => [typeof v === 'number' ? v.toFixed(4) : v, '가격']}
                  labelFormatter={() => ''}
                />
                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill="url(#mg)" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 가격 범위 바 */}
        {high && low && (
          <div className="px-5 py-3">
            <div className="flex justify-between text-[12px] text-text2 mb-1.5">
              <span className="text-down tabular-nums">{isCoin ? `$${Number(low).toFixed(4)}` : fmtPrice({ ...item, price: low }, coinUnit)}</span>
              <span className="text-text3 text-[11px]">{isCoin ? '24h 범위' : '52주 범위'}</span>
              <span className="text-up tabular-nums">{isCoin ? `$${Number(high).toFixed(4)}` : fmtPrice({ ...item, price: high }, coinUnit)}</span>
            </div>
            <div className="relative h-1.5 bg-gray-100 rounded-full">
              <div className="absolute inset-0 bg-gradient-to-r from-down via-gray-200 to-up rounded-full opacity-30" />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full shadow"
                style={{ borderColor: color, left: `calc(${barPos(isCoin ? item.priceUsd : item.price, low, high)}% - 6px)` }}
              />
            </div>
          </div>
        )}

        {/* 상세 정보 */}
        <div className="grid grid-cols-2 gap-2 px-5 pb-5">
          {[
            { label: '거래량',   value: fmtLarge(isCoin ? item.volume24h : item.volume) },
            { label: '시가총액', value: fmtLarge(item.marketCap) },
            item.sector && { label: '섹터', value: item.sector },
            isCoin && item.priceKrw && { label: 'KRW 환산', value: `₩${fmt(Math.round(item.priceKrw))}` },
          ].filter(Boolean).map(row => (
            <div key={row.label} className="bg-[#F7F8FA] rounded-xl px-3 py-2.5">
              <div className="text-[11px] text-text3 mb-0.5">{row.label}</div>
              <div className="text-[14px] font-semibold text-text1 tabular-nums">{row.value || '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
