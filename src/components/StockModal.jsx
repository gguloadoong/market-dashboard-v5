// 종목 상세 모달 컴포넌트

import { useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fmtPrice, fmtPct, fmt, fmtLarge, getPct, arrow, barPos } from '../utils/format';

function PriceBar({ cur, low, high }) {
  if (!low || !high) return null;
  const pos = barPos(cur, low, high);
  return (
    <div className="relative h-1.5 bg-gray-100 rounded-full mt-1 mb-0.5">
      <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-down to-up rounded-full" style={{ width: '100%', opacity: 0.25 }} />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white shadow-sm"
        style={{ left: `calc(${pos}% - 5px)` }}
      />
    </div>
  );
}

function SparkChart({ sparkline, pct }) {
  if (!sparkline || sparkline.length < 2) return null;
  const color = pct > 0 ? '#FF4136' : pct < 0 ? '#1A73E8' : '#8B95A1';
  const data = sparkline.map((v, i) => ({ i, v }));

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="modalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="i" hide />
          <YAxis domain={['auto', 'auto']} hide />
          <Tooltip
            contentStyle={{ fontSize: 11, border: 'none', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: 6 }}
            formatter={(val) => [val?.toFixed?.(4) ?? val, '가격']}
            labelFormatter={() => ''}
          />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill="url(#modalGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function StockModal({ item, coinUnit = 'usd', onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!item) return null;
  const isCoin = !!item.id;
  const pct = getPct(item);
  const isUp = pct > 0;
  const isDown = pct < 0;
  const dirColor = isUp ? 'c-up' : isDown ? 'c-down' : 'c-neutral';

  const high = isCoin ? item.high24h : item.high52w;
  const low = isCoin ? item.low24h : item.low52w;
  const highLabel = isCoin ? '24h 고가' : '52주 최고';
  const lowLabel = isCoin ? '24h 저가' : '52주 최저';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-text1">{item.symbol}</span>
              {item.market === 'kr' && <span className="text-[10px] bg-gray-100 text-text3 px-1.5 py-0.5 rounded">KRX</span>}
              {isCoin && <span className="text-[10px] bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded">CRYPTO</span>}
              {item.market === 'us' && !isCoin && <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">NASDAQ</span>}
            </div>
            <div className="text-sm text-text2 mt-0.5">{item.name}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-text2 text-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* 가격 + 등락 */}
          <div className="flex items-end gap-3">
            <div className="font-bold text-2xl text-text1 font-mono">
              {fmtPrice(item, coinUnit)}
            </div>
            <div className={`font-bold text-base font-mono ${dirColor}`}>
              {arrow(pct)} {fmtPct(pct)}
            </div>
          </div>

          {/* 차트 */}
          <SparkChart sparkline={item.sparkline} pct={pct} />

          {/* 가격 범위 */}
          {high && low && (
            <div>
              <div className="flex justify-between text-[11px] text-text2 mb-1">
                <span>{lowLabel}: <span className="text-down font-mono">{isCoin ? `$${low?.toFixed?.(4)}` : fmtPrice({ ...item, price: low }, coinUnit)}</span></span>
                <span>{highLabel}: <span className="text-up font-mono">{isCoin ? `$${high?.toFixed?.(4)}` : fmtPrice({ ...item, price: high }, coinUnit)}</span></span>
              </div>
              <PriceBar cur={isCoin ? item.priceUsd : item.price} low={low} high={high} />
            </div>
          )}

          {/* 상세 정보 그리드 */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '거래량', value: fmtLarge(isCoin ? item.volume24h : item.volume) },
              { label: '시가총액', value: fmtLarge(item.marketCap) },
              item.sector && { label: '섹터', value: item.sector },
              item.change && { label: '전일 대비', value: `${item.change >= 0 ? '+' : ''}${item.market === 'kr' ? fmt(item.change) + '원' : '$' + item.change?.toFixed?.(2)}` },
            ].filter(Boolean).map(row => (
              <div key={row.label} className="bg-bg rounded-lg px-3 py-2">
                <div className="text-[11px] text-text2 mb-0.5">{row.label}</div>
                <div className="text-sm font-medium text-text1 font-mono">{row.value || '—'}</div>
              </div>
            ))}
          </div>

          {isCoin && item.priceKrw && (
            <div className="text-center text-xs text-text3 border-t border-border pt-3">
              KRW 환산: <span className="font-semibold text-text2">₩{fmt(Math.round(item.priceKrw))}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
