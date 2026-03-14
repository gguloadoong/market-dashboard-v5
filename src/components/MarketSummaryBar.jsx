// 시장 지수 서머리 바
import { useMemo } from 'react';
import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';

function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// 지수별 국가 플래그
const INDEX_FLAG = {
  KOSPI: '🇰🇷', KOSDAQ: '🇰🇷',
  SPX: '🇺🇸', NDX: '🇺🇸', DJI: '🇺🇸', DXY: '🇺🇸',
};

function IndexItem({ idx }) {
  const isUp   = (idx.changePct ?? 0) > 0;
  const isDown = (idx.changePct ?? 0) < 0;
  const flag   = INDEX_FLAG[idx.id] || '';

  return (
    <div className="flex-shrink-0 px-5 border-r border-[#F2F4F6] last:border-0">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[12px]">{flag}</span>
        <span className="text-[11px] text-[#8B95A1] font-medium">{idx.name}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[17px] font-bold text-[#191F28] tabular-nums font-mono">
          {fmt(idx.value, idx.id === 'DXY' ? 2 : 2)}
        </span>
        <span className={`text-[12px] font-bold tabular-nums font-mono ${
          isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#8B95A1]'
        }`}>
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(idx.changePct ?? 0).toFixed(2)}%
        </span>
      </div>
      {idx.change != null && (
        <div className={`text-[11px] tabular-nums font-mono ${isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#8B95A1]'}`}>
          {isUp ? '+' : ''}{fmt(idx.change, idx.id === 'DXY' ? 2 : 2)}
        </div>
      )}
    </div>
  );
}

export default function MarketSummaryBar({ indices = [], krwRate = 1466, loading = false }) {
  const displayIndices = useMemo(() => indices.slice(0, 6), [indices]);
  const kr = getKoreanMarketStatus();
  const us = getUsMarketStatus();

  if (loading && displayIndices.length === 0) {
    return (
      <div className="bg-white rounded-2xl px-5 py-3.5 flex items-center gap-0">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="flex-shrink-0 px-5 border-r border-[#F2F4F6] last:border-0 space-y-1.5">
            <div className="h-3 bg-[#F2F4F6] rounded w-14 animate-pulse" />
            <div className="h-5 bg-[#F2F4F6] rounded w-20 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl flex items-stretch overflow-x-auto no-scrollbar">
      {/* 장 상태 */}
      <div className="flex-shrink-0 flex flex-col justify-center gap-1.5 px-4 py-3 border-r border-[#F2F4F6]">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${kr.status === 'open' ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
          <span className="text-[10px] text-[#8B95A1]">국장</span>
          <span className={`text-[10px] font-bold ${kr.status === 'open' ? 'text-[#2AC769]' : 'text-[#B0B8C1]'}`}>{kr.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${us.status === 'open' ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
          <span className="text-[10px] text-[#8B95A1]">미장</span>
          <span className={`text-[10px] font-bold ${us.status === 'open' ? 'text-[#2AC769]' : 'text-[#B0B8C1]'}`}>{us.label}</span>
        </div>
      </div>

      {/* 지수들 */}
      <div className="flex items-center py-3">
        {displayIndices.map(idx => (
          <IndexItem key={idx.id} idx={idx} />
        ))}
      </div>

      {/* 환율 */}
      <div className="flex-shrink-0 flex flex-col justify-center px-5 py-3 border-l border-[#F2F4F6] ml-auto">
        <div className="text-[11px] text-[#8B95A1] font-medium mb-1">💱 USD/KRW</div>
        <div className="text-[17px] font-bold text-[#191F28] tabular-nums font-mono">
          ₩{krwRate.toLocaleString('ko-KR')}
        </div>
      </div>
    </div>
  );
}
