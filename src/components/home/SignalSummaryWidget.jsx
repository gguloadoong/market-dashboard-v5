// 투자 시그널 요약 위젯 — 일반 사용자 친화적 UX
import { useState, useCallback } from 'react';
import { useTopSignals } from '../../hooks/useSignals';

// 시그널 타입 → 한 줄 키워드 + 행동 문구 매핑
const TYPE_META = {
  foreign_consecutive_buy:      { tag: '외국인 매수', action: '세력 집중 중', icon: '🏦' },
  foreign_consecutive_sell:     { tag: '외국인 매도', action: '세력 이탈 중', icon: '🏦' },
  institutional_consecutive_buy: { tag: '기관 매수',  action: '기관 담고 있어', icon: '🏛' },
  institutional_consecutive_sell:{ tag: '기관 매도',  action: '기관 던지고 있어', icon: '🏛' },
  volume_anomaly:               { tag: '거래량 폭발', action: '뭔가 일어나고 있어', icon: '📊' },
  whale_exchange_inflow:        { tag: '고래 입금',   action: '매도 가능성 주의', icon: '🐋' },
  whale_exchange_outflow:       { tag: '고래 출금',   action: '장기 보유 신호', icon: '🐋' },
  whale_stablecoin_inflow:      { tag: '고래 대기',   action: '큰손 매수 준비 중', icon: '🐋' },
  whale_large_single:           { tag: '고래 한 방',  action: '대량 거래 감지', icon: '🐋' },
  fear_greed_shift:             { tag: '심리 전환',   action: '분위기 바뀌고 있어', icon: '😱' },
  news_sentiment_cluster:       { tag: '뉴스 집중',   action: '이슈 몰리는 중', icon: '📰' },
  sector_rotation:              { tag: '섹터 이동',   action: '자금 흐름 변화', icon: '🔄' },
  PUT_CALL_RATIO:               { tag: '옵션 시그널', action: '풋/콜 비율 이상', icon: '📈' },
  FUNDING_RATE_EXTREME:         { tag: '선물 과열',   action: '롱/숏 과열 주의', icon: '🔥' },
  ORDER_FLOW_IMBALANCE:         { tag: '매수세 집중', action: '호가 불균형 감지', icon: '⚡' },
  VWAP_DEVIATION:               { tag: 'VWAP 이탈',  action: '가격 이탈 감지', icon: '📉' },
  SOCIAL_SENTIMENT:             { tag: 'SNS 화제',    action: 'SNS에서 달아오르는 중', icon: '💬' },
};

const DIR_COLOR = {
  bullish: { bg: '#F0FFF4', dot: '#2AC769', text: '#1A7A45', label: '상승' },
  bearish: { bg: '#FFF0F0', dot: '#F04452', text: '#C0392B', label: '하락' },
  neutral: { bg: '#FFFBF0', dot: '#FF9500', text: '#A05C00', label: '주목' },
};

// 시그널 이름 추출 — 종목명 우선, 없으면 symbol
function extractName(signal) {
  return signal.name || signal.symbol || '';
}

async function shareSignal(signal) {
  const emoji = signal.direction === 'bullish' ? '🟢' : signal.direction === 'bearish' ? '🔴' : '🟡';
  const meta = TYPE_META[signal.type] || {};
  const text = `${emoji} ${extractName(signal)} — ${meta.tag || signal.type}\n${meta.action || ''}\n\n마켓레이더에서 확인 →`;
  if (navigator.share) {
    try { await navigator.share({ text, url: window.location.origin }); } catch { /* 취소 */ }
  } else {
    try { await navigator.clipboard?.writeText(`${text} ${window.location.origin}`); } catch { /* 실패 */ }
  }
}

export default function SignalSummaryWidget({ onItemClick }) {
  const [expanded, setExpanded] = useState(false);
  const allSignals = useTopSignals(20);
  const visibleSignals = expanded ? allSignals : allSignals.slice(0, 3);

  const handleClick = useCallback((signal) => {
    if (signal.symbol && onItemClick) {
      onItemClick({ symbol: signal.symbol, name: signal.name || signal.symbol, market: signal.market });
    }
  }, [onItemClick]);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">투자 시그널</span>
        <span className="text-[11px] text-[#B0B8C1]">실시간</span>
      </div>

      {visibleSignals.map(signal => {
        const meta = TYPE_META[signal.type] || { tag: signal.type, action: signal.detail || '', icon: signal.direction === 'bullish' ? '🟢' : signal.direction === 'bearish' ? '🔴' : '🟡' };
        const dir = DIR_COLOR[signal.direction] || DIR_COLOR.neutral;
        const name = extractName(signal);

        return (
          <div
            key={signal.id}
            className={`flex items-center gap-3 px-4 py-3 border-b border-[#F2F4F6] last:border-0 ${
              signal.symbol && onItemClick ? 'cursor-pointer hover:bg-[#FAFBFC] active:bg-[#F2F4F6] transition-colors' : ''
            }`}
            onClick={() => handleClick(signal)}
          >
            {/* 방향 도트 */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[16px]"
              style={{ background: dir.bg }}>
              {meta.icon}
            </div>

            {/* 콘텐츠 */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                {/* 종목명 */}
                {name && (
                  <span className="text-[13px] font-bold text-[#191F28] truncate max-w-[80px]">{name}</span>
                )}
                {/* 키워드 칩 */}
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: dir.bg, color: dir.text }}
                >
                  {meta.tag}
                </span>
              </div>
              {/* 행동 문구 */}
              <p className="text-[11px] text-[#8B95A1] leading-snug">{meta.action}</p>
            </div>

            {/* 강도 + 공유 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-3 rounded-full"
                    style={{ background: i < signal.strength ? dir.dot : '#E5E8EB' }}
                  />
                ))}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); shareSignal(signal); }}
                className="p-1 rounded-md hover:bg-[#F2F4F6] transition-colors text-[#B0B8C1] hover:text-[#4E5968]"
                title="공유"
              >
                <span className="text-[12px]">↗</span>
              </button>
            </div>
          </div>
        );
      })}

      {allSignals.length === 0 && (
        <div className="px-4 py-4">
          <p className="text-[12px] text-[#8B95A1] leading-relaxed">
            시장을 분석 중이에요. 외국인/기관 매매, 거래량 급증, 고래 움직임이 포착되면 여기에 알려드립니다.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#EDF4FF] text-[#3182F6]">🏦 외국인 매수</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#FFF4E6] text-[#FF9500]">📊 거래량 폭발</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#F0FFF4] text-[#2AC769]">🐋 고래 움직임</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#FFF0F0] text-[#F04452]">🔥 선물 과열</span>
          </div>
        </div>
      )}

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
