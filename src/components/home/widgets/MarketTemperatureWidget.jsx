// 마켓 온도계 — 활성 시그널 종합 스코어 (-1 ~ +1)
import { useMemo } from 'react';
import { useSignals } from '../../../hooks/useSignals';

const ZONE = {
  '강한 경계':  { bar: '#F04452', text: '#C0392B', bg: '#FFF0F0', icon: '🔴' },
  '약세 우위':  { bar: '#FF6B35', text: '#C04A2A', bg: '#FFF4EE', icon: '🟠' },
  '중립':       { bar: '#B0B8C1', text: '#4E5968', bg: '#F2F4F6', icon: '🟡' },
  '강세 징후':  { bar: '#2AC769', text: '#1A7A45', bg: '#F0FFF4', icon: '🟢' },
  '강한 강세':  { bar: '#1764ED', text: '#1249B3', bg: '#EDF4FF', icon: '🔵' },
};

function calcTemperature(signals) {
  if (!signals.length) return { score: 0, label: '중립', count: 0, bullCount: 0, bearCount: 0, neutralCount: 0 };
  let bullWeight = 0, bearWeight = 0, neutralCount = 0;
  for (const sig of signals) {
    const w = sig.strength || 1;
    if (sig.direction === 'bullish') bullWeight += w;
    else if (sig.direction === 'bearish') bearWeight += w;
    else neutralCount++;
  }
  const total = bullWeight + bearWeight;
  const score = total === 0 ? 0 : (bullWeight - bearWeight) / total;
  let label;
  if (score <= -0.5) label = '강한 경계';
  else if (score <= -0.15) label = '약세 우위';
  else if (score < 0.15) label = '중립';
  else if (score < 0.5) label = '강세 징후';
  else label = '강한 강세';
  return { score, label, count: signals.length,
    bullCount: signals.filter(s => s.direction === 'bullish').length,
    bearCount: signals.filter(s => s.direction === 'bearish').length,
    neutralCount };
}

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
