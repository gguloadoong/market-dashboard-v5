import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';
import { fmt } from '../utils/format';

export default function Header({ krwRate, lastUpdated, onRefresh, loading }) {
  const kr = getKoreanMarketStatus();
  const us = getUsMarketStatus();
  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="bg-white sticky top-0 z-40" style={{ borderBottom: '1px solid #F2F4F6' }}>
      <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
        {/* 로고 */}
        <span className="text-[18px] font-bold text-text1 tracking-[-0.5px]">마켓</span>

        {/* 중앙: 장 상태 */}
        <div className="flex items-center gap-3 text-[12px] text-text2">
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${kr.status === 'open' ? 'bg-[#2AC769]' : 'bg-[#E5E8EB]'}`} />
            국장
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${us.status === 'open' ? 'bg-[#2AC769]' : 'bg-[#E5E8EB]'}`} />
            미장
          </span>
          {krwRate && (
            <span className="font-semibold text-text1">₩{fmt(krwRate)}</span>
          )}
        </div>

        {/* 우측: 시간 + 새로고침 */}
        <div className="flex items-center gap-1.5">
          {timeStr && <span className="text-[11px] text-text3">{timeStr}</span>}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-full text-text2 hover:bg-[#F2F4F6] transition-colors disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
