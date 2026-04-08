// 마켓 온도계 — 활성 시그널 종합 스코어 (-1 ~ +1)
import { useMemo } from 'react';
import { useSignals } from '../../../hooks/useSignals';
import { calcTemperature } from '../../../utils/temperature';

// ── 게이지 존 스타일 — CommandCenterWidget/MarketSentimentWidget과 통일 ──
// 한국 시장 관례: 빨강=상승(강세), 파랑=하락(약세)
const ZONE = {
  '강한 경계': { bar: '#3182F6', bg: '#EDF4FF', text: '#1764ED', icon: '🔵' },
  '약세 우위': { bar: '#7EB4F7', bg: '#F0F6FF', text: '#3182F6', icon: '🟠' },
  '중립':      { bar: '#B0B8C1', bg: '#F7F8FA', text: '#4E5968', icon: '🟡' },
  '강세 징후': { bar: '#F7A0A8', bg: '#FFF5F6', text: '#F04452', icon: '🟢' },
  '강한 강세': { bar: '#F04452', bg: '#FFF0F1', text: '#C0392B', icon: '🔴' },
};

export default function MarketTemperatureWidget() {
  const signals = useSignals();
  const temp = useMemo(() => calcTemperature(signals), [signals]);

  // 시그널 없으면 수집 중 스켈레톤
  if (temp.count === 0) return (
    <div
      data-testid="market-temperature"
      className="rounded-xl border border-[#ECEEF1] p-3 bg-white"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 rounded-full bg-[#F2F4F6] animate-pulse" />
        <span className="text-[13px] font-bold text-[#191F28]">마켓 온도계</span>
        <span className="text-[10px] text-[#B0B8C1]">수집 중...</span>
      </div>
      <div className="h-2 bg-[#F2F4F6] rounded-full animate-pulse mb-2" />
      <div className="h-3 w-24 bg-[#F2F4F6] rounded animate-pulse" />
    </div>
  );

  const zone = ZONE[temp.label] || ZONE['중립'];
  // -1 ~ +1 → 0% ~ 100% 게이지 변환
  const gaugeWidth = Math.round(((temp.score + 1) / 2) * 100);

  return (
    <div
      data-testid="market-temperature"
      className="rounded-2xl border shadow-sm p-3"
      style={{ background: zone.bg, borderColor: zone.bar + '30' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">{zone.icon}</span>
          <span className="text-[13px] font-bold text-[#191F28]">마켓 온도계</span>
        </div>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: zone.bar + '20', color: zone.text }}
        >
          {temp.label}
        </span>
      </div>

      {/* 게이지 바 */}
      <div className="relative h-2 bg-[#E5E8EB] rounded-full mb-2 overflow-hidden">
        {/* 중간 구분선 */}
        <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white z-10" />
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${gaugeWidth}%`, background: zone.bar }}
        />
      </div>

      {/* 시그널 카운트 요약 — 한 줄 */}
      <div className="text-[11px] text-[#4E5968]">
        {temp.bullCount > 0 && <span className="text-[#2AC769]">▲{temp.bullCount}건 강세</span>}
        {temp.bullCount > 0 && temp.bearCount > 0 && <span className="text-[#B0B8C1]"> · </span>}
        {temp.bearCount > 0 && <span className="text-[#F04452]">▼{temp.bearCount}건 약세</span>}
        {(temp.bullCount > 0 || temp.bearCount > 0) && <span className="text-[#B0B8C1]"> · </span>}
        <span className="text-[#B0B8C1]">총 {temp.count}개 시그널</span>
      </div>
    </div>
  );
}
