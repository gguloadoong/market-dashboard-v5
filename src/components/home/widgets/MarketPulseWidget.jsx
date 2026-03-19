// Market Pulse 위젯 — 지수 6개 + 환율 compact 스트립
import MarketIndexSection from '../MarketIndexSection';

export default function MarketPulseWidget({ indices, krwRate }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#F2F4F6] shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-bold text-[#191F28]">Market Pulse</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse flex-shrink-0" />
      </div>
      <MarketIndexSection indices={indices} krwRate={krwRate} />
    </div>
  );
}
