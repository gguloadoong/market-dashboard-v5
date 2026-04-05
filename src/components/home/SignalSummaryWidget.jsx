// 투자 시그널 요약 위젯 — 강세/약세 2열 분리 + 스코어 바 + 쉬운 언어
// Phase 8B: "우리만의 언어"로 사용자가 한눈에 판단할 수 있는 구조
import { useState, useCallback, useMemo } from 'react';
import { useTopSignals } from '../../hooks/useSignals';
import { TYPE_META as ENGINE_META } from '../../engine/signalTypes';

// 한국식 색상 (빨강=상승/강세, 파랑=하락/약세)
const DIR_STYLE = {
  bullish: { bg: '#FFF0F1', border: '#F04452', text: '#C0392B', label: '강세' },
  bearish: { bg: '#EDF4FF', border: '#1764ED', text: '#1249B3', label: '약세' },
  neutral: { bg: '#FFF8E1', border: '#FF9500', text: '#A05C00', label: '주목' },
};

function extractName(signal) {
  return signal.name || signal.symbol || '';
}

// 시그널의 easyLabel 가져오기 (TYPE_META에서)
function getEasyLabel(signal) {
  const meta = ENGINE_META[signal.type];
  if (meta?.easyLabel) return meta.easyLabel;
  // fallback
  const fallback = {
    foreign_consecutive_buy: '외국인이 사모으는 중 🔥',
    foreign_consecutive_sell: '외국인이 빠지고 있어요 ⚠️',
    institutional_consecutive_buy: '기관이 담고 있어요 🔥',
    institutional_consecutive_sell: '기관이 빠지고 있어요 ⚠️',
    volume_anomaly: '거래가 평소보다 폭발 💥',
    whale_exchange_inflow: '큰손이 거래소에 입금 📥',
    whale_exchange_outflow: '큰손이 거래소에서 출금 📤',
    whale_stablecoin_inflow: '현금이 거래소로 들어오는 중 💰',
    whale_large_single: '초대형 자금 이동 감지 🐋',
    fear_greed_shift: '시장 심리가 바뀌고 있어요 🔄',
    put_call_ratio: '하락 보험 변동 📊',
    funding_rate_extreme: '레버리지 쏠림 ⚡',
    order_flow_imbalance: '매수/매도 균형 깨짐 ⚖️',
    vwap_deviation: '평균가에서 벗어남 📏',
    social_sentiment: 'SNS 분위기 변화 📱',
    news_sentiment_cluster: '뉴스 쏟아지는 중 📰',
    sector_rotation: '섹터 자금 이동 🔄',
  };
  return fallback[signal.type] || signal.type;
}

export default function SignalSummaryWidget({ onItemClick }) {
  const [expanded, setExpanded] = useState(false);
  const allSignals = useTopSignals(20);

  const { bullSignals, bearSignals, bullCount, bearCount } = useMemo(() => {
    const bull = [], bear = [];
    for (const s of allSignals) {
      if (s.direction === 'bullish') bull.push(s);
      else if (s.direction === 'bearish') bear.push(s);
    }
    // 강도순 정렬
    bull.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    bear.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    return { bullSignals: bull, bearSignals: bear, bullCount: bull.length, bearCount: bear.length };
  }, [allSignals]);

  const total = bullCount + bearCount || 1;
  const bullPct = Math.round((bullCount / total) * 100);
  const scoreLabel = bullPct >= 60 ? '강세 우세' : bullPct <= 40 ? '약세 우세' : '팽팽';

  const handleClick = useCallback((signal) => {
    if (signal.symbol && onItemClick) {
      onItemClick({ symbol: signal.symbol, name: signal.name || signal.symbol, market: signal.market });
    }
  }, [onItemClick]);

  // 빈 상태
  if (allSignals.length === 0) {
    return (
      <div className="bg-white rounded-xl overflow-hidden border border-[#ECEEF1]">
        <div className="px-4 py-3 border-b border-[#F2F4F6]">
          <span className="text-[13px] font-bold text-[#191F28]">투자 시그널</span>
        </div>
        <div className="px-4 py-4">
          <p className="text-[12px] text-[#8B95A1] leading-relaxed">
            시장을 분석 중이에요. 시그널이 포착되면 여기에 알려드릴게요.
          </p>
          <div className="space-y-2 mt-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-[#F2F4F6] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayBull = expanded ? bullSignals : bullSignals.slice(0, 3);
  const displayBear = expanded ? bearSignals : bearSignals.slice(0, 3);

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-[#ECEEF1]">
      {/* 헤더: 스코어 바 */}
      <div className="px-4 py-3 border-b border-[#F2F4F6]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-bold text-[#191F28]">투자 시그널</span>
          <span className="text-[11px] font-bold tabular-nums" style={{
            color: bullPct >= 60 ? '#F04452' : bullPct <= 40 ? '#1764ED' : '#FF9500',
          }}>
            {scoreLabel}
          </span>
        </div>
        {/* 스코어 바 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#1764ED] font-semibold w-14">약세 {bearCount}건</span>
          <div className="flex-1 h-2 bg-[#F2F4F6] rounded-full overflow-hidden flex">
            <div
              className="h-full rounded-l-full transition-all duration-500"
              style={{ width: `${100 - bullPct}%`, background: '#1764ED' }}
            />
            <div
              className="h-full rounded-r-full transition-all duration-500"
              style={{ width: `${bullPct}%`, background: '#F04452' }}
            />
          </div>
          <span className="text-[10px] text-[#F04452] font-semibold w-14 text-right">강세 {bullCount}건</span>
        </div>
      </div>

      {/* 강세 / 약세 2열 분리 */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#F2F4F6]">
        {/* 강세 시그널 */}
        <div className="px-4 py-3">
          <div className="text-[11px] font-bold text-[#F04452] mb-2">🔴 강세 시그널</div>
          {displayBull.length === 0 ? (
            <p className="text-[11px] text-[#B0B8C1]">강세 시그널 없음</p>
          ) : (
            <div className="space-y-1.5">
              {displayBull.map(signal => (
                <button
                  key={signal.id}
                  onClick={() => handleClick(signal)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors hover:bg-[#FFF0F1]"
                  style={{ background: '#FFFAFA' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#191F28] truncate">{extractName(signal)}</div>
                    <div className="text-[10px] text-[#8B95A1] truncate">{getEasyLabel(signal)}</div>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-1 h-3 rounded-full" style={{ background: i < (signal.strength || 0) ? '#F04452' : '#E5E8EB' }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 약세 시그널 */}
        <div className="px-4 py-3">
          <div className="text-[11px] font-bold text-[#1764ED] mb-2">🔵 약세 시그널</div>
          {displayBear.length === 0 ? (
            <p className="text-[11px] text-[#B0B8C1]">약세 시그널 없음</p>
          ) : (
            <div className="space-y-1.5">
              {displayBear.map(signal => (
                <button
                  key={signal.id}
                  onClick={() => handleClick(signal)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors hover:bg-[#EDF4FF]"
                  style={{ background: '#FAFCFF' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#191F28] truncate">{extractName(signal)}</div>
                    <div className="text-[10px] text-[#8B95A1] truncate">{getEasyLabel(signal)}</div>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-1 h-3 rounded-full" style={{ background: i < (signal.strength || 0) ? '#1764ED' : '#E5E8EB' }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 더보기 */}
      {(bullSignals.length > 3 || bearSignals.length > 3) && (
        <div className="px-4 py-2 border-t border-[#F2F4F6]">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[11px] text-[#8B95A1] hover:text-[#4E5968] transition-colors"
          >
            {expanded ? '접기 ▲' : `더보기 (${allSignals.length}건) ▼`}
          </button>
        </div>
      )}
    </div>
  );
}
