// 투자 시그널 요약 위젯 — 상위 3개 시그널 표시
import { useTopSignals } from '../../hooks/useSignals';

export default function SignalSummaryWidget() {
  const signals = useTopSignals(3);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">투자 시그널</span>
        <span className="text-[11px] text-[#B0B8C1]">실시간</span>
      </div>
      {signals.map(signal => (
        <div key={signal.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-[#F2F4F6] last:border-0">
          <span className="text-[16px]">
            {signal.direction === 'bullish' ? '🟢' : signal.direction === 'bearish' ? '🔴' : '🟡'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[#191F28] leading-snug">{signal.title}</p>
            <p className="text-[11px] text-[#8B95A1] mt-0.5">{signal.detail ?? signal.meta?.currentZoneKo ?? ''}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* 강도 바 (1~5) */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-1 h-3 rounded-full ${
                  i < signal.strength
                    ? signal.direction === 'bullish'
                      ? 'bg-[#2AC769]'
                      : signal.direction === 'bearish'
                        ? 'bg-[#F04452]'
                        : 'bg-[#FF9500]'
                    : 'bg-[#E5E8EB]'
                }`}
              />
            ))}
          </div>
        </div>
      ))}
      {signals.length === 0 && (
        <div className="px-4 py-6 text-center text-[12px] text-[#B0B8C1]">
          시그널 수집 중...
        </div>
      )}
    </div>
  );
}
