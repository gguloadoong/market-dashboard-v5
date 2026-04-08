// 커맨드 센터 위젯 — MarketPulse + Sentiment + HeroSignal + Watchlist + EventTicker 통합
import { useMemo } from 'react';
import { useSignals, useTopSignals } from '../../hooks/useSignals';
import { useFearGreed } from '../../hooks/useFearGreed';
import { calcTemperature, calcFallbackTemperature } from '../../utils/temperature';
import { extractName, getEasyLabel } from '../../utils/signalLabel';
import { TYPE_META } from '../../engine/signalTypes';
import MarketIndexSection from './MarketIndexSection';
import EventTicker from './EventTicker';
import TickerLogo from './TickerLogo';
import { getPct, fmt } from './utils';

// ── 게이지 존 스타일 (5단계) — MarketSentimentWidget에서 재사용 ──
const ZONE = {
  '강한 경계': { bar: '#3182F6', bg: '#EDF4FF', text: '#1764ED' },
  '약세 우위': { bar: '#7EB4F7', bg: '#F0F6FF', text: '#3182F6' },
  '중립':      { bar: '#B0B8C1', bg: '#F7F8FA', text: '#4E5968' },
  '강세 징후': { bar: '#F7A0A8', bg: '#FFF5F6', text: '#F04452' },
  '강한 강세': { bar: '#F04452', bg: '#FFF0F1', text: '#C0392B' },
};

// ────────────────────────────────────────────────────────
// TemperatureBar — 시장 온도 프로그레스 바 + 지수 미니카드 + 공포탐욕
// ────────────────────────────────────────────────────────
function TemperatureBar({ indices, krwRate, allItems }) {
  const signals = useSignals();
  const temp = useMemo(() => calcTemperature(signals), [signals]);
  const fallback = useMemo(() => calcFallbackTemperature(allItems), [allItems]);
  const { crypto, us, kr } = useFearGreed();

  const isFallback = temp.count === 0;
  const displayTemp = isFallback && fallback ? { ...temp, score: fallback.score, label: fallback.label } : temp;
  const zone = ZONE[displayTemp.label] || ZONE['중립'];
  const gaugeWidth = Math.round(((displayTemp.score + 1) / 2) * 100);

  // 공포탐욕 대표 점수 (가장 먼저 로딩 완료된 것)
  const fgScore = crypto.data?.score ?? us.data?.score ?? kr.data?.score ?? null;

  return (
    <div className="space-y-5">
      {/* 온도 바 — 인라인 수평 (목업 시안) */}
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold text-[#4E5968] flex-shrink-0">시장 온도</span>
        <div className="flex-1 h-1.5 rounded-[3px] overflow-hidden" style={{ background: 'rgba(23,100,237,0.10)' }}>
          <div
            className="h-full rounded-[3px] transition-all duration-[600ms]"
            style={{ width: `${gaugeWidth}%`, background: zone.bar }}
          />
        </div>
        <span className="text-[13px] font-bold flex-shrink-0" style={{ color: zone.text }}>
          {displayTemp.label} {gaugeWidth}%
        </span>
        {fgScore != null && (
          <span className="text-[12px] font-semibold flex-shrink-0 px-2.5 py-0.5 rounded-xl" style={{ background: 'rgba(255,149,0,0.06)', color: '#FF9500' }}>
            탐욕 {fgScore}
          </span>
        )}
      </div>

      {/* 지수 스트립 */}
      <MarketIndexSection indices={indices} krwRate={krwRate} />
    </div>
  );
}

// ────────────────────────────────────────────────────────
// HeroSignalCard — D안 하이브리드: 1위 확장 카드 + 2~3위 컴팩트 행
// ────────────────────────────────────────────────────────

// allItems에서 시그널 symbol로 종목 데이터 매칭
function findItemBySignal(signal, allItems) {
  if (!signal?.symbol || !allItems?.length) return null;
  // symbol 정확 매칭 + _market 우선 비교
  return allItems.find(i =>
    (i.symbol === signal.symbol || i.id === signal.symbol) &&
    (!signal.market || (i._market || '').toLowerCase() === signal.market)
  ) || allItems.find(i => i.symbol === signal.symbol || i.id === signal.symbol) || null;
}

// 미니 스파크라인 SVG
function MiniSparkline({ data, color, width = 80, height = 28 }) {
  if (!data || data.length < 3) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const path = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeroSignalCard({ onItemClick, allItems }) {
  const topSignals = useTopSignals(3);

  if (!topSignals.length) {
    return (
      <div className="space-y-2.5">
        <div className="h-16 bg-[#F7F8FA] rounded-[14px] animate-pulse" />
        <div className="h-14 bg-[#F7F8FA] rounded-[14px] animate-pulse" />
        <p className="text-[11px] text-[#B0B8C1]">시그널 수집 중...</p>
      </div>
    );
  }

  const [hero, ...rest] = topSignals;
  const heroItem = findItemBySignal(hero, allItems);
  const isBullHero = hero.direction === 'bullish';
  const heroAccent = isBullHero ? '#F04452' : '#1764ED';
  const heroBg = isBullHero ? 'rgba(240,68,82,0.03)' : 'rgba(23,100,237,0.03)';
  const heroPct = heroItem ? getPct(heroItem) : null;

  // 히어로 아이템 가격 포맷
  const heroPrice = heroItem
    ? (heroItem._market === 'COIN'
        ? `₩${fmt(Math.round(heroItem.priceKrw || 0))}`
        : heroItem._market === 'KR'
          ? `₩${fmt(heroItem.price)}`
          : `$${(heroItem.price ?? 0).toFixed(2)}`)
    : null;

  return (
    <div className="flex flex-col gap-2">
      {/* 1위 시그널 — 확장 카드 */}
      <div
        className={`rounded-[14px] p-5 ${hero.symbol ? 'cursor-pointer hover:brightness-[0.98]' : ''} transition-all`}
        style={{ background: heroBg }}
        onClick={() => hero.symbol && onItemClick?.({ symbol: hero.symbol, name: hero.name || hero.symbol, market: hero.market })}
        role={hero.symbol ? 'button' : undefined}
        tabIndex={hero.symbol ? 0 : undefined}
      >
        {/* 상단: 로고 + 종목명 + 가격 + 변동률 + 스파크라인 */}
        <div className="flex items-center gap-3 mb-3">
          {heroItem && <TickerLogo item={heroItem} size={32} />}
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold text-[#191F28] tracking-tight truncate">{extractName(hero)}</div>
          </div>
          {heroPrice && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[16px] font-bold tabular-nums font-mono text-[#191F28]">{heroPrice}</span>
              {heroPct != null && (
                <span className="text-[13px] font-bold tabular-nums font-mono" style={{ color: heroPct > 0 ? '#F04452' : heroPct < 0 ? '#1764ED' : '#8B95A1' }}>
                  {heroPct > 0 ? '+' : ''}{heroPct.toFixed(2)}%
                </span>
              )}
            </div>
          )}
          {heroItem?.sparkline && <MiniSparkline data={heroItem.sparkline} color={heroAccent} />}
        </div>

        {/* 하단: 방향 + 강도 + 시그널 설명 */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold" style={{ color: heroAccent }}>
            {isBullHero ? '강세' : '약세'}
          </span>
          <div className="flex gap-[3px]">
            {Array.from({ length: 5 }).map((_, i) => (
              <i key={i} className="block w-[5px] h-[5px] rounded-full" style={{ background: heroAccent, opacity: i < (hero.strength || 0) ? 1 : 0.2 }} />
            ))}
          </div>
          <span className="text-[13px] text-[#4E5968] truncate flex-1 min-w-0">{getEasyLabel(hero)}</span>
          <span className="text-[11px] text-[#8B95A1] flex-shrink-0">{TYPE_META[hero.type]?.label || ''}</span>
        </div>
      </div>

      {/* 2~3위 시그널 — HotRow 스타일 컴팩트 행 */}
      {rest.map((signal, idx) => {
        const item = findItemBySignal(signal, allItems);
        const isBull = signal.direction === 'bullish';
        const accent = isBull ? '#F04452' : '#1764ED';
        const pct = item ? getPct(item) : null;
        const price = item
          ? (item._market === 'COIN'
              ? `₩${fmt(Math.round(item.priceKrw || 0))}`
              : item._market === 'KR'
                ? `₩${fmt(item.price)}`
                : `$${(item.price ?? 0).toFixed(2)}`)
          : null;

        return (
          <div
            key={signal.id || `hero-sub-${idx}`}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${signal.symbol ? 'cursor-pointer hover:bg-[#F7F8FA]' : ''} transition-colors`}
            style={{ borderTop: '1px solid #F2F3F5' }}
            onClick={() => signal.symbol && onItemClick?.({ symbol: signal.symbol, name: signal.name || signal.symbol, market: signal.market })}
          >
            {item && <TickerLogo item={item} size={24} />}
            <span className="text-[14px] font-semibold text-[#191F28] truncate flex-1 min-w-0">{extractName(signal)}</span>
            {price && <span className="text-[12px] font-semibold tabular-nums font-mono text-[#191F28] flex-shrink-0">{price}</span>}
            {pct != null && (
              <span className="text-[12px] font-bold tabular-nums font-mono flex-shrink-0" style={{ color: pct > 0 ? '#F04452' : pct < 0 ? '#1764ED' : '#8B95A1' }}>
                {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
              </span>
            )}
            <span className="text-[11px] text-[#8B95A1] flex-shrink-0 hidden sm:inline">{getEasyLabel(signal)}</span>
            <div className="flex gap-[3px] flex-shrink-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <i key={i} className="block w-[4px] h-[4px] rounded-full" style={{ background: accent, opacity: i < (signal.strength || 0) ? 1 : 0.2 }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// WatchlistMini — 관심종목 컴팩트 리스트 (최대 4행)
// ────────────────────────────────────────────────────────
// 마켓 배지 설정
const MKT_BADGE_CONFIG = {
  COIN: { label: 'COIN', bg: '#FF9500', color: '#FFFFFF' },
  KR:   { label: 'KR',   bg: '#F04452', color: '#FFFFFF' },
  US:   { label: 'US',   bg: '#1764ED', color: '#FFFFFF' },
};

function getMktBadge(item) {
  const isCoin = !!item.id;
  if (isCoin) return MKT_BADGE_CONFIG.COIN;
  if (item._market === 'KR' || item.market === 'kr') return MKT_BADGE_CONFIG.KR;
  return MKT_BADGE_CONFIG.US;
}

function WatchlistMini({ watchedItems, popularItems, toggle, onItemClick }) {
  const items = watchedItems.length > 0 ? watchedItems.slice(0, 6) : popularItems.slice(0, 4);
  const isEmpty = watchedItems.length === 0;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[14px] font-bold text-[#191F28]">관심종목</span>
        <span className="text-[12px] font-medium text-[#8B95A1] cursor-pointer hover:text-[#4E5968]">/ 검색</span>
      </div>

      {/* 빈 상태 안내 */}
      {isEmpty && (
        <div className="text-[13px] text-[#B0B8C1] mb-2.5">관심종목을 추가해보세요 — 인기 종목을 둘러보세요</div>
      )}

      {/* 콜드스타트: popularItems도 없을 때 */}
      {items.length === 0 ? (
        <div className="py-4 text-center space-y-1.5">
          <span className="text-[18px]">📌</span>
          <p className="text-[11px] font-medium text-[#4E5968]">관심종목을 추가해보세요</p>
          <p className="text-[10px] text-[#B0B8C1]">종목 검색 후 +를 눌러 추가</p>
        </div>
      ) : (
        <>
          {/* 모바일 수평 칩 */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 md:hidden">
            {items.map(item => {
              const pct = getPct(item);
              const isUp = pct > 0;
              const isDown = pct < 0;
              const color = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
              return (
                <div
                  key={item.id || item.symbol}
                  className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[#F2F3F5] cursor-pointer hover:bg-[#F2F4F6] transition-colors"
                  onClick={() => onItemClick?.(item)}
                >
                  <span className="text-[11px] font-semibold text-[#191F28] whitespace-nowrap">{item.name?.slice(0, 6)}</span>
                  <span className="text-[10px] font-bold tabular-nums font-mono whitespace-nowrap" style={{ color }}>
                    {isUp ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
          {/* 데스크톱 세로 리스트 */}
          <div className="hidden md:block">
            {items.map(item => {
              const pct = getPct(item);
              const isUp = pct > 0;
              const isDown = pct < 0;
              const color = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
              const badge = getMktBadge(item);

              return (
                <div
                  key={item.id || item.symbol}
                  className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-[#F2F3F5] -mx-2 px-2 rounded-lg transition-colors"
                  style={{ borderTop: '1px solid #F2F3F5' }}
                  onClick={() => onItemClick?.(item)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 leading-tight"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                    <TickerLogo item={item} size={20} />
                    <span className="text-[15px] font-semibold text-[#191F28] truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                    <span className="text-[13px] font-semibold tabular-nums font-mono" style={{ color }}>
                      {isUp ? '+' : ''}{pct.toFixed(2)}%
                    </span>
                    <span className="text-[15px] font-bold tabular-nums font-mono text-[#191F28]">
                      {fmt(item.price || item.priceKrw || 0)}
                    </span>
                    {/* + / ✕ 버튼 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggle?.(item.id || item.symbol); }}
                      className={`w-6 h-6 flex items-center justify-center rounded-md text-[18px] leading-none transition-colors ${
                        !isEmpty
                          ? 'text-[#B0B8C1] hover:text-[#F04452] hover:bg-[#FFF0F1]'
                          : 'text-[#B0B8C1] hover:text-[#2AC769] hover:bg-[#F0FFF6]'
                      }`}
                      title={isEmpty ? '추가' : '제거'}
                    >
                      {isEmpty ? '+' : '✕'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// EventStrip — EventTicker 래핑 (1줄)
// ────────────────────────────────────────────────────────
function EventStrip() {
  return <EventTicker />;
}

// ────────────────────────────────────────────────────────
// CommandCenterWidget — 메인 통합 컴포넌트
// ────────────────────────────────────────────────────────
export default function CommandCenterWidget({
  indices,
  krwRate,
  allItems,
  watchedItems,
  popularItems,
  onItemClick,
  toggle,
}) {
  return (
    <div className="bg-white rounded-2xl px-5 pt-6 pb-4">
      {/* 온도바 + 지수 + 공포탐욕 */}
      <TemperatureBar indices={indices} krwRate={krwRate} allItems={allItems} />

      {/* 히어로 시그널 + 관심종목 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 mt-4 mb-3.5">
        <div className="min-w-0">
          <HeroSignalCard onItemClick={onItemClick} allItems={allItems} />
        </div>
        <div>
          <WatchlistMini
            watchedItems={watchedItems}
            popularItems={popularItems}
            toggle={toggle}
            onItemClick={onItemClick}
            krwRate={krwRate}
          />
        </div>
      </div>

      {/* 경제 이벤트 세로 롤링 */}
      <EventStrip />
    </div>
  );
}
