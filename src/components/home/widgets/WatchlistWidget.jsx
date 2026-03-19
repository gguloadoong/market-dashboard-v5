// 관심종목 위젯
import { getPct, fmt } from '../utils';

function WatchRow({ item, krwRate, onItemClick }) {
  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const isCoin = !!item.id;

  const price = isCoin
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item.market === 'kr' || item._market === 'KR'
      ? `₩${fmt(item.price)}`
      : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  const mktBadge = isCoin
    ? { label: 'COIN', bg: '#FFF4E6', color: '#FF9500' }
    : item._market === 'KR' || item.market === 'kr'
      ? { label: 'KR', bg: '#FFF0F0', color: '#F04452' }
      : { label: 'US', bg: '#EDF4FF', color: '#3182F6' };

  return (
    <div
      onClick={() => onItemClick?.(item)}
      className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F7F8FA] cursor-pointer transition-colors rounded-xl"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: mktBadge.bg, color: mktBadge.color }}>
          {mktBadge.label}
        </span>
        <span className="text-[13px] font-semibold text-[#191F28] truncate">{item.name}</span>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <div className="text-[12px] font-bold tabular-nums font-mono" style={{ color }}>
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
        </div>
        <div className="text-[10px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
      </div>
    </div>
  );
}

export default function WatchlistWidget({ watchedItems, toggle, onItemClick }) {
  if (!watchedItems.length) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-[#F2F4F6] shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[13px] font-bold text-[#191F28]">관심종목</span>
        </div>
        <div className="py-6 text-center">
          <p className="text-[13px] text-[#8B95A1]">종목을 검색해서 관심목록에 추가하세요</p>
          <p className="text-[11px] text-[#C9CDD2] mt-1">/ 키를 눌러 검색</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">관심종목</span>
        <span className="text-[11px] text-[#B0B8C1]">{watchedItems.length}개</span>
      </div>
      <div className="py-1 max-h-[280px] overflow-y-auto">
        {watchedItems.map(item => (
          <WatchRow key={item.id || item.symbol} item={item} onItemClick={onItemClick} />
        ))}
      </div>
    </div>
  );
}
