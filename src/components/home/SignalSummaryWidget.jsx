// 투자 시그널 요약 위젯 — 더보기 + 타입별 아이콘 + 클릭 + 공유
import { useState, useCallback } from 'react';
import { useTopSignals } from '../../hooks/useSignals';

// 시그널 타입별 아이콘 매핑
const TYPE_ICON = {
  foreign_consecutive_buy: '🏦',
  foreign_consecutive_sell: '🏦',
  institutional_consecutive_buy: '🏦',
  institutional_consecutive_sell: '🏦',
  volume_anomaly: '📊',
  whale_exchange_inflow: '🐋',
  whale_exchange_outflow: '🐋',
  whale_stablecoin_inflow: '🐋',
  whale_large_single: '🐋',
  fear_greed_shift: '😱',
  news_sentiment_cluster: '📰',
  sector_rotation: '🔄',
};

// 시그널 공유 — Web Share API + 클립보드 폴백
async function shareSignal(signal) {
  const emoji = signal.direction === 'bullish' ? '🟢' : signal.direction === 'bearish' ? '🔴' : '🟡';
  const text = `${emoji} ${signal.title}\n${signal.detail || signal.meta?.currentZoneKo || ''}\n\n마켓레이더에서 확인 →`;
  if (navigator.share) {
    try {
      await navigator.share({ text, url: window.location.origin });
    } catch {
      // 사용자 취소 — 무시
    }
  } else {
    // 폴백: 클립보드 복사
    try {
      await navigator.clipboard?.writeText(`${text} ${window.location.origin}`);
    } catch {
      // 클립보드 실패 — 무시
    }
  }
}

export default function SignalSummaryWidget({ onItemClick }) {
  const [expanded, setExpanded] = useState(false);
  const allSignals = useTopSignals(20);

  // 펼침 상태에 따라 표시 개수 조절
  const visibleSignals = expanded ? allSignals : allSignals.slice(0, 3);

  // 시그널 클릭 → symbol이 있으면 ChartSidePanel 열기
  const handleClick = useCallback((signal) => {
    if (signal.symbol && onItemClick) {
      // symbol 기반으로 아이템 객체 구성 (최소한의 정보)
      onItemClick({ symbol: signal.symbol, name: signal.name || signal.symbol, market: signal.market });
    }
  }, [onItemClick]);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">투자 시그널</span>
        <span className="text-[11px] text-[#B0B8C1]">실시간</span>
      </div>
      {visibleSignals.map(signal => (
        <div
          key={signal.id}
          className={`flex items-start gap-3 px-4 py-2.5 border-b border-[#F2F4F6] last:border-0 ${
            signal.symbol && onItemClick ? 'cursor-pointer hover:bg-[#FAFBFC] active:bg-[#F2F4F6] transition-colors' : ''
          }`}
          onClick={() => handleClick(signal)}
        >
          {/* 타입별 아이콘 + 방향 표시 */}
          <span className="text-[16px] flex-shrink-0" title={signal.type}>
            {TYPE_ICON[signal.type] || (signal.direction === 'bullish' ? '🟢' : signal.direction === 'bearish' ? '🔴' : '🟡')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[#191F28] leading-snug">{signal.title}</p>
            <p className="text-[11px] text-[#8B95A1] mt-0.5">{signal.detail ?? signal.meta?.currentZoneKo ?? ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 강도 바 (1~5) */}
            <div className="flex items-center gap-1">
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
            {/* 공유 버튼 */}
            <button
              onClick={(e) => { e.stopPropagation(); shareSignal(signal); }}
              className="p-1 rounded-md hover:bg-[#F2F4F6] transition-colors text-[#B0B8C1] hover:text-[#4E5968]"
              title="시그널 공유"
            >
              <span className="text-[12px]">↗</span>
            </button>
          </div>
        </div>
      ))}
      {allSignals.length === 0 && (
        <div className="px-4 py-3">
          <p className="text-[11px] text-[#8B95A1] leading-relaxed">
            시장 데이터를 분석 중입니다. 외국인/기관 매매 동향, 거래량 이상치, 고래 움직임이 감지되면 여기에 표시됩니다.
          </p>
          <div className="flex gap-2 mt-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F2F4F6] text-[#8B95A1]">🏦 외국인 동향</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F2F4F6] text-[#8B95A1]">📊 거래량</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F2F4F6] text-[#8B95A1]">🐋 고래</span>
          </div>
        </div>
      )}
      {/* 더보기/접기 버튼 — 시그널 5개 이상일 때 표시 */}
      {allSignals.length > 3 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full py-2.5 text-center text-[12px] font-medium text-[#3182F6] hover:bg-[#F7F8FA] transition-colors border-t border-[#F2F4F6]"
        >
          {expanded ? '접기' : `더보기 (${allSignals.length}건)`}
        </button>
      )}
    </div>
  );
}
