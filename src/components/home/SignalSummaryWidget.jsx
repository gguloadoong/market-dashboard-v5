// 투자 시그널 요약 위젯 — 스코어 + TOP 카드 + 칩 레이아웃
import { useState, useCallback, useMemo } from 'react';
import { useTopSignals } from '../../hooks/useSignals';

// 시그널 타입 → 사용자 친화 텍스트 매핑
const TYPE_META = {
  foreign_consecutive_buy:       { tag: '외국인 매수', action: '세력 집중 중', icon: '🏦' },
  foreign_consecutive_sell:      { tag: '외국인 매도', action: '세력 이탈 중', icon: '🏦' },
  institutional_consecutive_buy: { tag: '기관 매수',  action: '기관 담고 있어', icon: '🏛' },
  institutional_consecutive_sell:{ tag: '기관 매도',  action: '기관 던지고 있어', icon: '🏛' },
  volume_anomaly:                { tag: '거래량 폭발', action: '뭔가 일어나고 있어', icon: '📊' },
  whale_exchange_inflow:         { tag: '고래 입금',   action: '매도 가능성 주의', icon: '🐋' },
  whale_exchange_outflow:        { tag: '고래 출금',   action: '장기 보유 신호', icon: '🐋' },
  whale_stablecoin_inflow:       { tag: '고래 대기',   action: '큰손 매수 준비 중', icon: '🐋' },
  whale_large_single:            { tag: '고래 한 방',  action: '대량 거래 감지', icon: '🐋' },
  fear_greed_shift:              { tag: '심리 전환',   action: '분위기 바뀌고 있어', icon: '😱' },
  news_sentiment_cluster:        { tag: '뉴스 집중',   action: '이슈 몰리는 중', icon: '📰' },
  sector_rotation:               { tag: '섹터 이동',   action: '자금 흐름 변화', icon: '🔄' },
  put_call_ratio:                { tag: '옵션 시그널', action: '풋/콜 비율 이상', icon: '📈' },
  funding_rate_extreme:          { tag: '선물 과열',   action: '롱/숏 과열 주의', icon: '🔥' },
  order_flow_imbalance:          { tag: '매수 집중',   action: '매수세가 매도를 압도 중', icon: '⚡' },
  vwap_deviation:                { tag: '평균가 이탈', action: '평균 매입가보다 싸게 살 기회', icon: '💡' },
  social_sentiment:              { tag: 'SNS 화제',    action: 'SNS에서 달아오르는 중', icon: '💬' },
};

const DIR_COLOR = {
  bullish: { bg: '#F0FFF4', dot: '#2AC769', text: '#1A7A45', label: '상승', emoji: '🟢' },
  bearish: { bg: '#FFF0F0', dot: '#F04452', text: '#C0392B', label: '하락', emoji: '🔴' },
  neutral: { bg: '#FFFBF0', dot: '#FF9500', text: '#A05C00', label: '주목', emoji: '🟡' },
};

function extractName(signal) {
  return signal.name || signal.symbol || '';
}

export default function SignalSummaryWidget({ onItemClick }) {
  const [expanded, setExpanded] = useState(false);
  const allSignals = useTopSignals(20);

  const { bullCount, bearCount } = useMemo(() => {
    let bull = 0, bear = 0;
    for (const s of allSignals) {
      if (s.direction === 'bullish') bull++;
      else if (s.direction === 'bearish') bear++;
    }
    return { bullCount: bull, bearCount: bear };
  }, [allSignals]);

  // 강도 기준 정렬, 가장 강한 시그널이 TOP
  const sorted = useMemo(() =>
    [...allSignals].sort((a, b) => (b.strength || 0) - (a.strength || 0)),
    [allSignals]
  );
  const topSignal = sorted[0] || null;
  const restSignals = expanded ? sorted.slice(1) : sorted.slice(1, 5);

  const handleClick = useCallback((signal) => {
    if (signal.symbol && onItemClick) {
      onItemClick({ symbol: signal.symbol, name: signal.name || signal.symbol, market: signal.market });
    }
  }, [onItemClick]);

  // 빈 상태: pulse skeleton
  if (allSignals.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#F2F4F6]">
        <div className="px-4 py-3 border-b border-[#F2F4F6]">
          <span className="text-[13px] font-bold text-[#191F28]">투자 시그널</span>
        </div>
        <div className="px-4 py-4">
          <p className="text-[12px] text-[#8B95A1] leading-relaxed">
            시장을 분석 중이에요. 외국인/기관 매매, 거래량 급증, 고래 움직임이 포착되면 여기에 알려드립니다.
          </p>
          <div className="space-y-2 mt-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-[#F2F4F6] rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const topMeta = topSignal ? (TYPE_META[topSignal.type] || { tag: topSignal.type, action: '', icon: '🟡' }) : null;
  const topDir = topSignal ? (DIR_COLOR[topSignal.direction] || DIR_COLOR.neutral) : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#F2F4F6]">
      {/* 헤더: 스코어 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-[#191F28]">투자 시그널</span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[#2AC769] font-bold">🟢 강세 {bullCount}건</span>
            <span className="text-[#F04452] font-bold">🔴 약세 {bearCount}건</span>
          </div>
        </div>
        {sorted.length > 5 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[11px] text-[#3182F6] font-medium hover:underline"
          >
            {expanded ? '접기' : '더보기'}
          </button>
        )}
      </div>

      {/* TOP 1 시그널 — 크게 강조 */}
      {topSignal && (
        <button
          onClick={() => handleClick(topSignal)}
          className="w-full text-left px-4 py-3 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] active:bg-[#F2F4F6] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[20px] flex-shrink-0"
              style={{ background: topDir.bg }}
            >
              {topMeta.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[14px] font-bold text-[#191F28]">{extractName(topSignal)}</span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: topDir.bg, color: topDir.text }}
                >
                  {topMeta.tag}
                </span>
              </div>
              <p className="text-[12px] text-[#4E5968] leading-snug">{topMeta.action}</p>
            </div>
            {/* 강도 바 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-4 rounded-full"
                    style={{ background: i < (topSignal.strength || 0) ? topDir.dot : '#E5E8EB' }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-[#B0B8C1] ml-1">차트 →</span>
            </div>
          </div>
        </button>
      )}

      {/* 나머지 시그널: 가로 스크롤 칩 */}
      {restSignals.length > 0 && (
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {restSignals.map(signal => {
              const meta = TYPE_META[signal.type] || { tag: signal.type, icon: '🟡' };
              const dir = DIR_COLOR[signal.direction] || DIR_COLOR.neutral;
              const name = extractName(signal);
              return (
                <button
                  key={signal.id}
                  onClick={() => handleClick(signal)}
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-lg transition-colors hover:opacity-80"
                  style={{ background: dir.bg, color: dir.text }}
                >
                  <span>{dir.emoji}</span>
                  <span className="truncate max-w-[80px]">{name}</span>
                  <span className="text-[10px] opacity-70">{meta.tag}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
