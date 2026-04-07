// 시그널 보드 위젯 — SignalSummaryWidget + SeoulForceSection 통합
// 카운터 3개 (강세/약세/중립) + 시그널 리스트 + 접기/펼치기
import { useState, useCallback, useMemo } from 'react';
import { useTopSignals } from '../../hooks/useSignals';
import { extractName, getEasyLabel } from '../../utils/signalLabel';
import { SIGNAL_TYPES } from '../../engine/signalTypes';
import TickerLogo from './TickerLogo';

const FORCE_TYPES = [
  SIGNAL_TYPES.FOREIGN_CONSECUTIVE_BUY,
  SIGNAL_TYPES.FOREIGN_CONSECUTIVE_SELL,
  SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_BUY,
  SIGNAL_TYPES.INSTITUTIONAL_CONSECUTIVE_SELL,
];

export default function SignalBoardWidget({ onItemClick }) {
  // 모바일 기본 접힘 — 카운터만 노출
  const [expanded, setExpanded] = useState(false);
  const allSignals = useTopSignals(20);

  const { bullSignals, bearSignals, neutralSignals, bullCount, bearCount, neutralCount } = useMemo(() => {
    const bull = [], bear = [], neutral = [];
    for (const s of allSignals) {
      if (s.direction === 'bullish') bull.push(s);
      else if (s.direction === 'bearish') bear.push(s);
      else neutral.push(s);
    }
    // 강도순 정렬
    bull.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    bear.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    neutral.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    return {
      bullSignals: bull, bearSignals: bear, neutralSignals: neutral,
      bullCount: bull.length, bearCount: bear.length, neutralCount: neutral.length,
    };
  }, [allSignals]);

  // 세력 포착 시그널 (강도 3 이상)
  const forceSignals = useMemo(
    () => allSignals.filter(s => FORCE_TYPES.includes(s.type) && s.strength >= 3),
    [allSignals],
  );

  // 통합 리스트: 모든 시그널 (세력 포착 포함)
  const combinedList = useMemo(() => {
    const all = [...bullSignals, ...bearSignals, ...neutralSignals];
    // 강도순 재정렬
    all.sort((a, b) => (b.strength || 0) - (a.strength || 0));
    return all;
  }, [bullSignals, bearSignals, neutralSignals]);

  const displayList = expanded ? combinedList : combinedList.slice(0, 5);

  const handleClick = useCallback((signal) => {
    if (signal.symbol && onItemClick) {
      onItemClick({ symbol: signal.symbol, name: signal.name || signal.symbol, market: signal.market });
    }
  }, [onItemClick]);

  // 빈 상태
  if (allSignals.length === 0) {
    return (
      <div className="bg-white rounded-2xl px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[19px] font-bold text-[#191F28] tracking-tight">시그널 보드</span>
          <span className="text-[11px] font-bold text-[#2AC769] flex items-center gap-1">
            <span className="w-[5px] h-[5px] rounded-full bg-[#2AC769] inline-block" />실시간
          </span>
        </div>
        <p className="text-[13px] text-[#8B95A1] leading-relaxed">
          시장을 분석 중이에요. 시그널이 포착되면 여기에 알려드릴게요.
        </p>
        <div className="space-y-2 mt-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-11 bg-[#F7F8FA] rounded-[10px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl px-5 pt-6 pb-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[19px] font-bold text-[#191F28] tracking-tight">시그널 보드</span>
        <span className="text-[11px] font-bold text-[#2AC769] flex items-center gap-1">
          <span className="w-[5px] h-[5px] rounded-full bg-[#2AC769] inline-block" />실시간
        </span>
      </div>

      {/* 카운터 3개 — 큰 숫자 + 레이블만 (카드 배경 없음) */}
      <div className="flex gap-8 mb-5 px-1">
        <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setExpanded(true)}>
          <div className="text-[28px] font-extrabold text-[#F04452] leading-none tracking-tight">{bullCount}</div>
          <div className="text-[12px] font-medium text-[#8B95A1] mt-1">강세 시그널</div>
        </button>
        <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setExpanded(true)}>
          <div className="text-[28px] font-extrabold text-[#1764ED] leading-none tracking-tight">{bearCount}</div>
          <div className="text-[12px] font-medium text-[#8B95A1] mt-1">약세 시그널</div>
        </button>
        <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setExpanded(true)}>
          <div className="text-[28px] font-extrabold text-[#8B95A1] leading-none tracking-tight">{neutralCount}</div>
          <div className="text-[12px] font-medium text-[#8B95A1] mt-1">중립</div>
        </button>
      </div>

      {/* 모바일: 카운터만 노출, 리스트는 접힌 상태 기본 — 펼치기 버튼으로 토글 */}
      {/* 데스크톱: 항상 표시 */}
      <div className={expanded ? '' : 'hidden lg:block'}>
        {/* 세력 포착 (있을 때만) */}
        {forceSignals.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-bold text-[#191F28]">세력 포착</span>
              <span className="text-[10px] text-[#B0B8C1]">외국인·기관 연속 매수매도</span>
            </div>
            <div className="space-y-1.5">
              {forceSignals.slice(0, 3).map(sig => {
                const isBull = sig.direction === 'bullish';
                const typeLabel = sig.type.includes('foreign') ? '외국인' : '기관';
                const dirLabel = isBull ? '연속 매수' : '연속 매도';
                return (
                  <button
                    key={sig.symbol + sig.type + (sig.timestamp || '')}
                    onClick={() => handleClick(sig)}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left"
                    style={{ background: isBull ? '#F0FFF6' : '#FFF0F1' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold" style={{ color: isBull ? '#2AC769' : '#F04452' }}>
                        {typeLabel}
                      </span>
                      <span className="text-[12px] font-bold text-[#191F28]">{sig.name}</span>
                      <span className="text-[11px] text-[#8B95A1]">{dirLabel} {sig.meta?.consecutiveDays || sig.strength}일+</span>
                    </div>
                    <span className="text-[10px] text-[#B0B8C1]">차트 →</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 시그널 리스트 — 텍스트 색상으로 강세/약세 구분, 좌측 보더 없음 */}
        <div>
          {displayList.map((signal, idx) => {
            const isBull = signal.direction === 'bullish';
            const isBear = signal.direction === 'bearish';
            const nameColor = isBull ? '#F04452' : isBear ? '#1764ED' : '#191F28';
            const dotColor = isBull ? '#F04452' : isBear ? '#1764ED' : '#8B95A1';
            return (
              <button
                key={signal.id}
                onClick={() => handleClick(signal)}
                className={`w-full text-left flex items-center gap-3 py-[11px] px-2 rounded-[10px] transition-colors ${
                  signal.symbol ? 'cursor-pointer hover:bg-[#F2F3F5]' : ''
                } ${idx > 0 ? 'border-t border-[#F2F3F5]' : ''}`}
                style={idx > 0 ? {} : {}}
              >
                {signal.symbol && (
                  <TickerLogo item={{ symbol: signal.symbol, name: signal.name, _market: signal.market === 'kr' ? 'KR' : signal.market === 'us' ? 'US' : signal.market === 'crypto' ? 'COIN' : '', id: signal.market === 'crypto' ? signal.symbol : undefined }} size={24} />
                )}
                <span className="text-[14px] font-semibold flex-shrink-0" style={{ color: nameColor }}>
                  {extractName(signal)}
                </span>
                <span className="text-[13px] text-[#8B95A1] truncate flex-1 min-w-0">{getEasyLabel(signal)}</span>
                {/* 강도 도트 (원형) */}
                <div className="flex gap-[3px] flex-shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-[5px] h-[5px] rounded-full"
                      style={{
                        background: dotColor,
                        opacity: i < (signal.strength || 0) ? 1 : 0.15,
                      }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 더보기 / 접기 */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-center gap-1 text-[13px] font-semibold text-[#8B95A1] hover:text-[#4E5968] transition-colors mt-2 pt-2.5 pb-1"
      >
        {expanded ? '접기' : '더보기'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
    </div>
  );
}
