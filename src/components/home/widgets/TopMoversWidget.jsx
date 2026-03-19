// 주목할만한 움직임 — |changePct| 기준 혼합 TOP5 (마켓별 최대 3개)
import { useState } from 'react';
import { getPct, fmt, getAvatarBg } from '../utils';

const MKT_BADGE = {
  KR:   { label: '국내', bg: '#FFF0F0', color: '#F04452' },
  US:   { label: '미장', bg: '#EDF4FF', color: '#3182F6' },
  COIN: { label: '코인', bg: '#FFF4E6', color: '#FF9500' },
};

function MoverRow({ item, rank, krwRate, onClick }) {
  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const badge  = MKT_BADGE[item._market] || MKT_BADGE.KR;

  const logoUrls = item.image ? [item.image]
    : item._market === 'US'   ? [`https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`]
    : item._market === 'KR'   ? [`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`]
    : [];
  const [logoIdx, setLogoIdx] = useState(0);
  const bg = getAvatarBg(item.symbol);

  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
      ? `₩${fmt(item.price)}`
      : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-[#F7F8FA] active:scale-[0.99] transition-all rounded-xl"
    >
      <span className="w-4 text-[11px] text-[#C9CDD2] tabular-nums font-mono text-center flex-shrink-0">{rank}</span>

      {logoIdx < logoUrls.length ? (
        <img
          src={logoUrls[logoIdx]} alt={item.symbol}
          onError={() => setLogoIdx(i => i + 1)}
          className="w-7 h-7 rounded-full object-contain bg-white border border-[#F2F4F6] p-0.5 flex-shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ background: bg }}>
          {(item.symbol || '?').slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-[#191F28] truncate">{item.name}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        </div>
        <div className="text-[10px] text-[#8B95A1] font-mono">{item.symbol}</div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[13px] font-bold tabular-nums font-mono" style={{ color }}>
          {isUp ? '+' : ''}{pct.toFixed(2)}%
        </div>
        <div className="text-[10px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
      </div>
    </div>
  );
}

export default function TopMoversWidget({ movers = [], krwRate, onItemClick }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">주목할만한 움직임</span>
        <span className="text-[11px] text-[#B0B8C1]">변동폭 기준</span>
      </div>
      <div className="py-1">
        {movers.map((item, i) => (
          <MoverRow
            key={item.id || item.symbol}
            item={item}
            rank={i + 1}
            krwRate={krwRate}
            onClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}
