// 통합 시장 심리 위젯 — 마켓 온도계 + 공포탐욕 지수
// MarketTemperatureWidget + FearGreedWidget 통합
import { useState, useMemo } from 'react';
import { useSignals } from '../../../hooks/useSignals';
import { useFearGreed, getFgColor } from '../../../hooks/useFearGreed';
import { TYPE_META } from '../../../engine/signalTypes';
import { getPct } from '../utils';

// ── 온도 계산 (기존 MarketTemperatureWidget 로직 재사용) ──
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

// ── 가격 기반 fallback 온도 계산 ──
function calcFallbackTemperature(allItems) {
  if (!allItems?.length) return null;
  const pcts = allItems.map(i => getPct(i)).filter(p => !isNaN(p));
  if (!pcts.length) return null;
  const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  // 평균 등락률을 -1 ~ +1 스코어로 변환 (+-5% 기준 클램핑)
  const score = Math.max(-1, Math.min(1, avg / 5));
  let label;
  if (score <= -0.5) label = '강한 경계';
  else if (score <= -0.15) label = '약세 우위';
  else if (score < 0.15) label = '중립';
  else if (score < 0.5) label = '강세 징후';
  else label = '강한 강세';
  return { score, label, avgPct: avg };
}

// ── 게이지 존 스타일 (5단계) ──
const ZONE = {
  '강한 경계': { bar: '#3182F6', bg: '#EDF4FF', text: '#1764ED' },
  '약세 우위': { bar: '#7EB4F7', bg: '#F0F6FF', text: '#3182F6' },
  '중립':      { bar: '#B0B8C1', bg: '#F7F8FA', text: '#4E5968' },
  '강세 징후': { bar: '#F7A0A8', bg: '#FFF5F6', text: '#F04452' },
  '강한 강세': { bar: '#F04452', bg: '#FFF0F1', text: '#C0392B' },
};

// ── 한 줄 해석 메시지 ──
const MESSAGE_MAP = {
  '강한 경계': '조심하세요, 시장이 불안해하고 있어요',
  '약세 우위': '약세 신호가 좀 더 많아요',
  '중립':      '시장이 눈치를 보고 있어요',
  '강세 징후': '강세 신호가 나오고 있어요',
  '강한 강세': '시장이 뜨겁습니다! 🔥',
};

// ── 공포탐욕 레이블 쉬운 말 변환 ──
function toEasyFgLabel(score) {
  if (score == null) return '';
  if (score <= 24) return '겁먹음';
  if (score <= 44) return '불안';
  if (score <= 55) return '보통';
  if (score <= 74) return '흥분';
  return '과열';
}

// ── 공포탐욕 미니 게이지 (서브 컴포넌트) ──
function FgMiniGauge({ emoji, marketLabel, score, isLoading, isError, closed }) {
  if (isLoading) return (
    <div className="flex items-center gap-2">
      <span className="text-[10px]">{emoji}</span>
      <div className="h-4 w-16 bg-[#F2F4F6] rounded animate-pulse" />
    </div>
  );
  if (isError) return (
    <div className="flex items-center gap-2">
      <span className="text-[10px]">{emoji}</span>
      <span className="text-[10px] text-[#B0B8C1]">{marketLabel} —</span>
    </div>
  );
  if (closed) return (
    <div className="flex items-center gap-2">
      <span className="text-[10px]">{emoji}</span>
      <span className="text-[10px] text-[#B0B8C1]">{marketLabel} 휴장</span>
    </div>
  );

  const label = toEasyFgLabel(score);
  const color = getFgColor(score);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px]">{emoji}</span>
      <span className="text-[11px] font-bold tabular-nums font-mono" style={{ color }}>{score}</span>
      <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
    </div>
  );
}

// ── 메인 위젯 ──
export default function MarketSentimentWidget({ allItems = [] }) {
  const [fgOpen, setFgOpen] = useState(false);
  const signals = useSignals();
  const temp = useMemo(() => calcTemperature(signals), [signals]);
  const fallback = useMemo(() => calcFallbackTemperature(allItems), [allItems]);
  const { crypto, us, kr } = useFearGreed();

  // 시그널 0건일 때 가격 기반 fallback 사용 여부
  const isFallback = temp.count === 0;
  const displayTemp = isFallback && fallback ? { ...temp, score: fallback.score, label: fallback.label } : temp;
  const zone = ZONE[displayTemp.label] || ZONE['중립'];
  const message = MESSAGE_MAP[displayTemp.label] || MESSAGE_MAP['중립'];
  const gaugeWidth = Math.round(((displayTemp.score + 1) / 2) * 100);

  // "왜 이런 분위기?" — 상위 3건 시그널의 easyLabel
  const topReasons = useMemo(() => {
    if (!signals.length) return [];
    return [...signals]
      .sort((a, b) => (b.strength || 0) - (a.strength || 0))
      .slice(0, 3)
      .map(sig => {
        const meta = TYPE_META[sig.type];
        return meta?.easyLabel || sig.label || sig.title || sig.type;
      });
  }, [signals]);

  // 시그널 0건 + fallback도 없으면 스켈레톤
  if (isFallback && !fallback) {
    return (
      <div
        data-testid="market-sentiment"
        className="rounded-xl border border-[#ECEEF1] p-3 bg-white"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-full bg-[#F2F4F6] animate-pulse" />
          <span className="text-[13px] font-bold text-[#191F28]">지금 시장 분위기</span>
          <span className="text-[10px] text-[#B0B8C1]">수집 중...</span>
        </div>
        <div className="h-2 bg-[#F2F4F6] rounded-full animate-pulse mb-2" />
        <div className="h-3 w-24 bg-[#F2F4F6] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div
      data-testid="market-sentiment"
      className="rounded-2xl border shadow-sm p-4"
      style={{ background: zone.bg, borderColor: zone.bar + '30' }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">🌡</span>
          <span className="text-[13px] font-bold text-[#191F28]">지금 시장 분위기</span>
        </div>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: zone.bar + '20', color: zone.text }}
        >
          {displayTemp.label}
        </span>
      </div>

      {/* 한 줄 해석 */}
      <p className="text-[13px] font-medium text-[#333D4B] mb-3">
        "{isFallback ? '시그널 수집 중... 가격 기준 임시 온도에요' : message}"
      </p>

      {/* 게이지 바 */}
      <div className="relative h-2.5 bg-[#E5E8EB] rounded-full mb-1.5 overflow-hidden">
        {/* 게이지 포인터 마커 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm z-20 transition-all duration-500"
          style={{ left: `calc(${gaugeWidth}% - 6px)`, background: zone.bar }}
        />
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${gaugeWidth}%`, background: zone.bar, opacity: 0.6 }}
        />
      </div>
      {/* 게이지 라벨 */}
      <div className="flex justify-between text-[10px] text-[#8B95A1] mb-3">
        <span>겁먹음</span>
        <span>보통</span>
        <span>흥분</span>
      </div>

      {/* "왜 이런 분위기?" — 시그널 이유 */}
      {topReasons.length > 0 && (
        <div className="mb-3">
          <span className="text-[11px] font-bold text-[#4E5968] mb-1.5 block">왜 이런 분위기?</span>
          <div className="space-y-1">
            {topReasons.map((reason, i) => (
              <div key={i} className="text-[11px] text-[#6B7684] flex items-start gap-1.5">
                <span className="text-[#B0B8C1] flex-shrink-0">·</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 심리 지표 (공포탐욕) — 접기/펼치기 */}
      <div className="border-t pt-2" style={{ borderColor: zone.bar + '20' }}>
        <button
          onClick={() => setFgOpen(v => !v)}
          className="w-full flex items-center justify-between py-1"
        >
          <span className="text-[11px] font-bold text-[#4E5968]">심리 지표</span>
          <span className="text-[10px] text-[#B0B8C1]">{fgOpen ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>

        {fgOpen && (
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <FgMiniGauge
              emoji="🇰🇷"
              marketLabel="국장"
              score={kr.data?.score}
              isLoading={kr.isLoading}
              isError={kr.isError}
              closed={kr.data?.closed}
            />
            <FgMiniGauge
              emoji="🇺🇸"
              marketLabel="미장"
              score={us.data?.score}
              isLoading={us.isLoading}
              isError={us.isError}
            />
            <FgMiniGauge
              emoji="🪙"
              marketLabel="코인"
              score={crypto.data?.score}
              isLoading={crypto.isLoading}
              isError={crypto.isError}
            />
          </div>
        )}
      </div>
    </div>
  );
}
