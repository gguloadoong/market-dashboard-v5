// 데스크탑 헤더 — CDS 스타일 탭 + 장 상태 + 환율 + 다크모드
import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';
import { fmt } from '../utils/format';
import OpsStatusBadge from './OpsStatusBadge';

function DarkToggleIcon({ dark }) {
  return dark ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

// CDS TabNavigation용 탭 정의
const TABS = [
  { id: 'home', label: '홈' },
  { id: 'kr',   label: '국내' },
  { id: 'us',   label: '미국' },
  { id: 'coin', label: '코인' },
  { id: 'etf',  label: 'ETF' },
  { id: 'sector', label: '섹터' },
];

export default function Header({
  krwRate, lastUpdated, onRefresh, loading, activeTab, onTabChange,
  dark = false, onDarkToggle,
}) {
  const kr = getKoreanMarketStatus();
  const us = getUsMarketStatus();
  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <header className="bg-white sticky top-0 z-20 border-b border-[#E5E8EB]">
      <div className="max-w-[1440px] mx-auto px-6 h-12 flex items-center justify-between">

        {/* 좌: 로고 + CDS TabNavigation */}
        <div className="flex items-center gap-6">
          {/* 브랜드 로고 — 레이더 심볼 + 워드마크 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <rect width="32" height="32" rx="8" fill="#3182F6"/>
              <path d="M6 24C6 14.059 14.059 6 24 6" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.35"/>
              <path d="M10 24C10 16.268 16.268 10 24 10" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.6"/>
              <path d="M14 24C14 18.477 18.477 14 24 14" stroke="white" strokeWidth="2.8" strokeLinecap="round"/>
              <circle cx="24" cy="24" r="3.2" fill="white"/>
            </svg>
            <span className="text-[17px] font-bold text-[#191F28] tracking-tight">
              마켓레이더
            </span>
          </div>

          {/* 탭 — CDS 스타일 언더라인 (데스크탑만 표시) */}
          <nav className="hidden lg:flex items-center h-12">
            {TABS.map(tab => {
              const isActive = (activeTab === 'news' ? 'home' : activeTab) === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative h-full flex items-center px-4 text-[14px] transition-colors ${
                    isActive
                      ? 'text-[#191F28] font-semibold'
                      : 'text-[#8B95A1] hover:text-[#4E5968]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#191F28]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 우: 장 상태 + 환율 + 시각 + 새로고침 — 모바일에서 숨김 */}
        <div className="hidden md:flex items-center gap-4">
          {/* 장 운영 상태 */}
          <div className="flex items-center gap-3 text-[13px]">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${kr.status === 'open' ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
              <span className="text-[#6B7684]">국장</span>
              <span className={`font-semibold text-[12px] ${kr.status === 'open' ? 'text-[#2AC769]' : 'text-[#B0B8C1]'}`}>{kr.label}</span>
            </span>
            <span className="text-[#E5E8EB]">|</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${us.status === 'open' ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
              <span className="text-[#6B7684]">미장</span>
              <span className={`font-semibold text-[12px] ${us.status === 'open' ? 'text-[#2AC769]' : 'text-[#B0B8C1]'}`}>{us.label}</span>
            </span>
          </div>

          {/* 환율 */}
          {krwRate && (
            <div className="text-[14px] font-bold text-[#191F28] font-mono tabular-nums">
              ₩{fmt(krwRate)}
              <span className="text-[11px] font-normal text-[#B0B8C1] ml-1">USD/KRW</span>
            </div>
          )}

          {/* 업데이트 시각 */}
          {timeStr && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
              <span className="text-[12px] text-[#B0B8C1] font-mono">{timeStr}</span>
            </div>
          )}

          {/* #164 Phase B: 크론 상태 뱃지 (localStorage opsMode=true 일 때만 표시) */}
          <OpsStatusBadge />

          {/* 다크모드 토글 */}
          {onDarkToggle && (
            <button
              onClick={onDarkToggle}
              aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
              title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[#6B7684] hover:bg-[#F2F4F6] hover:text-[#191F28] transition-colors"
            >
              <DarkToggleIcon dark={dark} />
            </button>
          )}

          {/* 새로고침 버튼 */}
          <button
            disabled={loading}
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[#E5E8EB] text-[#191F28] bg-white hover:bg-[#F2F4F6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            )}
            새로고침
          </button>
        </div>
      </div>
    </header>
  );
}
