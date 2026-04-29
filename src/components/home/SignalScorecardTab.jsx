// 시그널 봇 성적표 탭 — 적중률 기반 봇 랭킹
import { useState, useMemo } from 'react';
import { useSignalAccuracy } from '../../hooks/useSignalAccuracy';
import { BOT_CATEGORIES } from '../../constants/signalBotCategories';

// ── 봇 한국어 이름 매핑 (사용자 친화 명칭) ──
const SIGNAL_BOT_NAMES = {
  foreign_consecutive_buy:       '외국인 연속 매수',
  foreign_consecutive_sell:      '외국인 연속 매도',
  institutional_consecutive_buy: '기관 연속 매수',
  institutional_consecutive_sell:'기관 연속 매도',
  volume_anomaly:                '거래량 폭발',
  fear_greed_shift:              '공포·탐욕 전환',
  news_sentiment_cluster:        '뉴스 집중 포착',
  sector_rotation:               '주도 섹터 교체',
  put_call_ratio:                '옵션 경보',
  funding_rate_extreme:          '코인 레버리지 과열',
  order_flow_imbalance:          '매수·매도 불균형',
  vwap_deviation:                'VWAP 이탈',
  social_sentiment:              '소셜 반응',
  cross_market_correlation:      '연동 자산 괴리',
  sentiment_divergence:          '뉴스·가격 불일치',
  smart_money_flow:              '스마트머니 감지',
  momentum_divergence:           '추세 전환',
  volume_price_divergence:       '거래량·가격 괴리',
  market_mood_shift:             '시장 분위기 전환',
  composite_score:               '종합 매수·매도 신호',
  gap_analysis:                  '갭 출발',
  rebalancing_alert:             '리밸런싱 경보',
  fx_impact:                     '환율 충격',
  capitulation:                  '투매 감지',
  stealth_activity:              '뉴스 없는 거래 폭발',
  btc_leading:                   'BTC 선행 신호',
  support_resistance_break:      '지지·저항 돌파',
  double_bottom:                 '이중바닥 패턴',
  recovery_detection:            '반등 감지',
  sector_outlier:                '섹터 이탈 종목',
};

// ── 카테고리 분류 (src/constants/signalBotCategories.js 단일 소스) ──

// 타입 → 카테고리 역매핑
const TYPE_TO_CATEGORY = {};
for (const [cat, types] of Object.entries(BOT_CATEGORIES)) {
  for (const t of types) TYPE_TO_CATEGORY[t] = cat;
}

// 카테고리별 한국어 + 개수
const CATEGORY_CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'event', label: '이벤트', count: BOT_CATEGORIES.event.length },
  { key: 'quant', label: '퀀트', count: BOT_CATEGORIES.quant.length },
  { key: 'pattern', label: '패턴', count: BOT_CATEGORIES.pattern.length },
];

// 적중률 → 색상
function accuracyColor(pct) {
  if (pct >= 70) return '#2AC769';
  if (pct >= 50) return '#FF9500';
  return '#F04452';
}

// ── 요약 바 ──
function ScorecardSummary({ accuracy, isLoading }) {
  const color = accuracyColor(accuracy);
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-[#4E5968]">전체 평균 적중률</span>
        <span className="text-[15px] font-bold" style={{ color }}>
          {isLoading ? '--' : `${accuracy}%`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#F2F4F6] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${isLoading ? 0 : accuracy}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── 봇 랭킹 리스트 ──
function BotRankingList({ bots }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  if (bots.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="space-y-2 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-[#F7F8FA] rounded-[10px] animate-pulse" />
          ))}
        </div>
        <p className="text-[13px] text-[#8B95A1]">시그널 데이터 수집 중...</p>
      </div>
    );
  }

  return (
    <div>
      {bots.map((bot, idx) => {
        const isExpanded = expandedIdx === idx;
        const isMissing = bot.isMissing === true;
        const isCold = !isMissing && bot.totalFired < 30;
        const name = SIGNAL_BOT_NAMES[bot.type] || bot.type;
        const color = accuracyColor(bot.accuracy);
        const streak = (bot.recentResults || []).slice(-10);

        return (
          <div key={bot.type}>
            {/* 봇 카드 행 */}
            <button
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              className={`w-full flex items-center gap-3 py-3 text-left ${
                idx > 0 ? 'border-t border-[#F2F4F6]' : ''
              }`}
            >
              <span className="text-[14px] font-bold text-[#B0B8C1] w-5 text-right flex-shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[14px] font-semibold truncate ${isCold ? 'text-[#8B95A1]' : 'text-[#191F28]'}`}>
                    {name}
                  </span>
                  <span
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      color: '#fff',
                      background: isMissing ? '#D1D5DB' : isCold ? '#B0B8C1' : color,
                      opacity: isMissing ? 0.8 : isCold ? 0.7 : 1,
                    }}
                  >
                    {isMissing ? '집계 중' : isCold ? '데이터 누적 중' : `${bot.accuracy}%`}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {streak.map((hit, i) => (
                    <span
                      key={i}
                      className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                      style={{ background: hit ? '#2AC769' : '#F04452' }}
                    />
                  ))}
                  <span className="text-[10px] text-[#B0B8C1] ml-1">{bot.totalFired}회</span>
                </div>
              </div>
              <span
                className="text-[11px] font-mono flex-shrink-0"
                style={{ color: bot.trend >= 0 ? '#2AC769' : '#F04452' }}
              >
                {bot.trend > 0 ? '+' : ''}{bot.trend}%
              </span>
            </button>

            {/* 확장 상세 */}
            {isExpanded && (
              <div className="pb-3 pl-8 pr-2">
                {/* 1h / 4h / 24h 적중률 */}
                <div className="flex gap-4 mb-3">
                  {[
                    { label: '1시간', val: bot.accuracy1h },
                    { label: '4시간', val: bot.accuracy4h },
                    { label: '24시간', val: bot.accuracy24h },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex-1 text-center">
                      <div className="text-[10px] text-[#8B95A1] mb-0.5">{label}</div>
                      <div
                        className="text-[13px] font-bold"
                        style={{ color: val != null ? accuracyColor(val) : '#B0B8C1' }}
                      >
                        {val != null ? `${val}%` : '-'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 최근 5건 시그널 */}
                {bot.recentSignals.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-[#8B95A1] mb-1">최근 시그널</div>
                    {bot.recentSignals.slice(0, 5).map((sig, si) => (
                      <div key={si} className="flex items-center gap-2 text-[11px]">
                        <span className="font-medium text-[#191F28] w-14 truncate">{sig.symbol}</span>
                        <span style={{ color: sig.direction === 'bullish' ? '#F04452' : '#1764ED' }}>
                          {sig.direction === 'bullish' ? '▲' : '▼'}
                        </span>
                        <span className="text-[#8B95A1] flex-1 truncate">
                          {sig.resultPct != null ? `${sig.resultPct > 0 ? '+' : ''}${sig.resultPct}%` : '-'}
                        </span>
                        <span
                          className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                          style={{ background: sig.hit ? '#2AC769' : '#F04452' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 메인 성적표 탭 ──
export default function SignalScorecardTab() {
  const { bots, overallAccuracy, isLoading } = useSignalAccuracy();
  const [category, setCategory] = useState('all');

  // 카테고리 필터 + 정렬 (레거시는 hook에서 이미 차단됨)
  // 정렬 우선순위: ① 발화 있는 봇(totalFired≥10) — 적중률 내림차순
  //               ② cold 봇(totalFired 1~9) — 적중률 내림차순
  //               ③ 집계 중 봇(isMissing or totalFired===0) — 이름순
  const filteredBots = useMemo(() => {
    const filtered = category === 'all'
      ? bots
      : bots.filter((b) => TYPE_TO_CATEGORY[b.type] === category);
    return [...filtered].sort((a, b) => {
      const rankA = a.isMissing || a.totalFired === 0 ? 2 : a.totalFired < 30 ? 1 : 0;
      const rankB = b.isMissing || b.totalFired === 0 ? 2 : b.totalFired < 10 ? 1 : 0;
      if (rankA !== rankB) return rankA - rankB;
      if (rankA === 0) return b.accuracy - a.accuracy;
      if (rankA === 1) return b.accuracy - a.accuracy;
      return (a.type < b.type ? -1 : 1);
    });
  }, [bots, category]);

  return (
    <div>
      {/* 요약 바 */}
      <ScorecardSummary accuracy={overallAccuracy} isLoading={isLoading} />

      {/* 카테고리 칩 */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-1 px-1">
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = category === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => setCategory(chip.key)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                isActive
                  ? 'bg-[#191F28] text-white'
                  : 'bg-[#F2F4F6] text-[#8B95A1]'
              }`}
            >
              {chip.label}{chip.count != null ? `(${chip.count})` : ''}
            </button>
          );
        })}
      </div>

      {/* 봇 랭킹 */}
      <BotRankingList bots={filteredBots} />
    </div>
  );
}

// 외부에서 접근 가능하도록 이름 매핑 export
export { SIGNAL_BOT_NAMES };
