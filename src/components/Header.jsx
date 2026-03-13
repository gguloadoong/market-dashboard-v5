// 헤더 컴포넌트 - 장 상태, 환율, 업데이트 시각

import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';
import { fmt } from '../utils/format';

function MarketStatusBadge({ label, status, name }) {
  const colorMap = {
    open:    'bg-green-100 text-green-700',
    pre:     'bg-yellow-100 text-yellow-700',
    after:   'bg-orange-100 text-orange-700',
    closed:  'bg-gray-100 text-gray-500',
  };
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="font-medium text-text2">{name}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${colorMap[status] ?? colorMap.closed}`}>
        {label}
      </span>
    </span>
  );
}

export default function Header({ krwRate, lastUpdated, onRefresh, loading }) {
  const krStatus = getKoreanMarketStatus();
  const usStatus = getUsMarketStatus();

  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* 로고 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-bold text-text1 tracking-tight">📈 마켓</span>
          <span className="text-xs text-text3 font-medium hidden sm:block">Market Dashboard</span>
        </div>

        {/* 장 상태 + 환율 */}
        <div className="flex items-center gap-4 text-xs">
          <MarketStatusBadge name="국장" status={krStatus.status} label={krStatus.label} />
          <MarketStatusBadge name="미장" status={usStatus.status} label={usStatus.label} />
          {krwRate && (
            <span className="text-text2 hidden sm:block">
              <span className="font-medium text-text1">₩{fmt(krwRate)}</span>
              <span className="text-text3">/USD</span>
            </span>
          )}
        </div>

        {/* 업데이트 + 새로고침 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-text3 hidden sm:block">{updatedStr}</span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <span className={`text-sm ${loading ? 'animate-spin' : ''}`}>⟳</span>
          </button>
        </div>
      </div>
    </header>
  );
}
