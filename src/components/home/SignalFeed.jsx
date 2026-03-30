// 3시장 통합 시그널 피드 — 국장+미장+코인 시그널을 시간순으로 표시
import { useMemo } from 'react';
import { useSignals } from '../../hooks/useSignals';

// 마켓별 배지 스타일
const MKT = {
  kr:     { label: '국내', bg: '#FFF0F0', color: '#F04452' },
  us:     { label: '미장', bg: '#EDF4FF', color: '#3182F6' },
  crypto: { label: '코인', bg: '#FFF4E6', color: '#FF9500' },
  coin:   { label: '코인', bg: '#FFF4E6', color: '#FF9500' },
};

// 시그널 방향 스타일
const DIR = {
  bullish: { emoji: '\u{1F7E2}', color: '#2AC769' },
  bearish: { emoji: '\u{1F534}', color: '#F04452' },
  neutral: { emoji: '\u{1F7E1}', color: '#FF9500' },
};

export default function SignalFeed({ onItemClick }) {
  const signals = useSignals();

  // 시간순 정렬, 최대 20개
  const sorted = useMemo(
    () => [...signals].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20),
    [signals],
  );

  // 시그널 0건이면 대기 안내 표시
  if (!sorted.length) return (
    <div className="bg-white rounded-2xl shadow-sm px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#191F28]">시그널 피드</span>
        <span className="text-[10px] text-[#B0B8C1]">시그널 감지 시 실시간 표시</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">시그널 피드</span>
        <span className="text-[11px] text-[#B0B8C1]">3시장 통합</span>
      </div>

      {
        sorted.map(sig => {
          const mkt = MKT[sig.market] || MKT.kr;
          const dir = DIR[sig.direction] || DIR.neutral;
          const timeStr = sig.timestamp
            ? new Date(sig.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <div
              key={sig.id}
              onClick={() => sig.symbol && onItemClick?.({ symbol: sig.symbol, _market: (sig.market || '').toUpperCase() })}
              className={`flex items-start gap-3 px-4 py-2.5 border-b border-[#F2F4F6] last:border-0 ${
                sig.symbol ? 'cursor-pointer hover:bg-[#FAFBFC]' : ''
              }`}
            >
              <span className="text-[14px] mt-0.5">{dir.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: mkt.bg, color: mkt.color }}
                  >
                    {mkt.label}
                  </span>
                  <span className="text-[10px] text-[#B0B8C1] ml-auto">{timeStr}</span>
                </div>
                <p className="text-[12px] font-medium text-[#191F28] leading-snug">{sig.title}</p>
                {sig.detail && (
                  <p className="text-[10px] text-[#8B95A1] mt-0.5">{sig.detail}</p>
                )}
              </div>
              {/* 강도 바 (1~5) */}
              <div className="flex items-center gap-0.5 flex-shrink-0 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-3 rounded-full"
                    style={{ background: i < sig.strength ? dir.color : '#E5E8EB' }}
                  />
                ))}
              </div>
            </div>
          );
        })
      }
    </div>
  );
}
