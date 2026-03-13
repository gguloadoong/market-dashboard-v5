// 시장 지수 서머리 바
import { useMemo } from 'react';

function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function IndexItem({ idx, isLast }) {
  const isUp   = idx.changePct > 0;
  const isDown = idx.changePct < 0;

  return (
    <div className={`flex items-center gap-6 ${!isLast ? 'pr-6 border-r border-[#E5E8EB]' : ''}`}>
      <div>
        <div className="text-[11px] text-[#B0B8C1] font-medium mb-1">{idx.name}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-[18px] font-semibold text-[#191F28] tabular-nums font-mono">
            {fmt(idx.value, idx.id === 'DXY' ? 2 : 0)}
          </span>
          <span className={`text-[13px] font-semibold tabular-nums font-mono ${
            isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#6B7684]'
          }`}>
            {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(idx.changePct ?? 0).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MarketSummaryBar({ indices = [], krwRate = 1466, loading = false }) {
  // 표시할 지수 (최대 6개)
  const displayIndices = useMemo(() =>
    indices.slice(0, 6),
  [indices]);

  if (loading && displayIndices.length === 0) {
    return (
      <div className="bg-white rounded-2xl px-6 py-4 flex items-center gap-6">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-3 bg-[#F2F4F6] rounded w-16 animate-pulse" />
            <div className="h-5 bg-[#F2F4F6] rounded w-24 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl px-6 py-4 flex items-center gap-6 overflow-x-auto no-scrollbar">
      {displayIndices.map((idx, i) => (
        <IndexItem key={idx.id} idx={idx} isLast={i === displayIndices.length - 1} />
      ))}

      {/* 환율 */}
      <div className="ml-auto flex-shrink-0 pl-6 border-l border-[#E5E8EB]">
        <div className="text-[11px] text-[#B0B8C1] font-medium mb-1">USD/KRW</div>
        <div className="text-[18px] font-semibold text-[#191F28] tabular-nums font-mono">
          ₩{krwRate.toLocaleString('ko-KR')}
        </div>
      </div>
    </div>
  );
}
