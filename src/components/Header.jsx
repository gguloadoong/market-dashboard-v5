import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';
import { fmt } from '../utils/format';

function StatusDot({ status }) {
  const color = status === 'open' ? 'bg-green-400' : status === 'pre' || status === 'after' ? 'bg-yellow-400' : 'bg-gray-300';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

export default function Header({ krwRate, lastUpdated, onRefresh, loading }) {
  const kr = getKoreanMarketStatus();
  const us = getUsMarketStatus();
  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <header className="bg-surface border-b border-[#F2F4F6] sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
        <span className="font-bold text-[17px] tracking-tight text-text1">마켓</span>

        <div className="flex items-center gap-4 text-[12px] text-text2">
          <span className="flex items-center gap-1">
            <StatusDot status={kr.status} />
            국장 <span className={kr.status === 'open' ? 'text-green-600' : 'text-text3'}>{kr.label}</span>
          </span>
          <span className="flex items-center gap-1">
            <StatusDot status={us.status} />
            미장 <span className={us.status === 'open' ? 'text-green-600' : 'text-text3'}>{us.label}</span>
          </span>
          {krwRate && (
            <span className="hidden sm:block">
              <span className="font-semibold text-text1">₩{fmt(krwRate)}</span>
            </span>
          )}
          {timeStr && <span className="text-text3 hidden sm:block">{timeStr}</span>}
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-text2 hover:text-text1 transition-colors disabled:opacity-40 text-base"
        >
          <span className={loading ? 'inline-block animate-spin' : ''}>↺</span>
        </button>
      </div>
    </header>
  );
}
