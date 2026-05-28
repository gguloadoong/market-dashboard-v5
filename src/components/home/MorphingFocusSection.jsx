// 모핑 포커스 — 시간대 인지 단일 포커스 (#335, 최유나 디자인)
// NotableMoversSection 흡수: 시간대(국장/미장/갭/코인)에 따라 주도주 또는 주목 종목으로 자동 전환.
//
// 위계 (절대 준수):
//   1순위 시선 = 등락률 색(빨강 상승 #F04452 / 파랑 하락 #1764ED)
//   2순위      = WHY 정량근거 (◆ LEAD 칩 + 정량 한 줄)
//   3순위      = 세션 인디케이터(작게, 색 2개만)
//
// computeMorphFocus(#335)가 모드/주도테마/무버/브릿지를 계산하고, 이 컴포넌트는 모드별로 렌더만 한다.
import { useMemo } from 'react';
import { DEFAULT_KRW_RATE } from '../../constants/market';
import { computeMorphFocus, MORPH_MODE } from '../../utils/leadingStocks';
import { getKoreanMarketStatus, getUsMarketStatus } from '../../utils/marketHours';
import { findRelatedNews } from './utils';
import { itemKey } from '../../utils/symbolKey';
import TickerLogo from './TickerLogo';

// ─── 색상 토큰 (한국식: 빨강 상승 / 파랑 하락) ───────────────────
const UP = '#F04452';
const DOWN = '#1764ED';
const NEUTRAL = '#8B95A1';
const LIVE_DOT = '#2AC769';   // 세션 라이브 점(초록) — 등락률과 절대 겹치지 않음
const IDLE_DOT = '#B0B8C1';   // 세션 정지 점(회색)

function dirColor(pct) {
  if (pct > 0) return UP;
  if (pct < 0) return DOWN;
  return NEUTRAL;
}

// 미세 배경 틴트 — CommandCenter HeroSignalCard heroBg 패턴 재사용
function tintBg(pct) {
  if (pct > 0) return 'rgba(240,68,82,0.03)';
  if (pct < 0) return 'rgba(23,100,237,0.03)';
  return 'rgba(139,149,161,0.04)';
}

// 가격 포맷 — 마켓별 통화/소수 처리 (NotableCard 패턴 차용)
function formatPrice(item, krwRate) {
  if (!item) return '';
  if (item._market === 'COIN') {
    const krw = item.priceKrw || (item.priceUsd ?? 0) * krwRate;
    return `₩${Math.round(krw).toLocaleString('ko-KR')}`;
  }
  if (item._market === 'KR') return `₩${Math.round(item.price || 0).toLocaleString('ko-KR')}`;
  return `$${(item.price ?? 0).toFixed(2)}`;
}

// 미니 스파크라인 path 생성 (NotableCard / MiniSparkline 패턴)
function sparkPath(spark, w, h) {
  if (!Array.isArray(spark) || spark.length < 3) return '';
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const range = max - min || 1;
  return spark.map((v, i) => {
    const x = (i / (spark.length - 1)) * w;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

// 정량 WHY 한 줄 — 모드별로 단정 강도를 다르게.
//   LEAD: 실시간 단정 가능 ("거래 회전율 상위 · 뉴스 N건 · +X%")
//   GAP:  실시간 단정 금지 ("어제 마감 ±X% · 뉴스 N건")
function buildLeadWhy({ item, pct, newsCount, isGap }) {
  const parts = [];
  if (isGap) {
    // 시간외 — 실시간 체결가 없음 → "어제 마감" 명시 (단정 회피)
    const sign = pct > 0 ? '+' : '';
    parts.push(`어제 마감 ${sign}${pct.toFixed(1)}%`);
    if (newsCount > 0) parts.push(`뉴스 ${newsCount}건`);
    return parts.join(' · ');
  }
  // LEAD/COIN — 회전율 percentile이 높으면 "거래 쏠림" 근거
  const turnPct = item?._leadBreakdown?.turn;
  if (Number.isFinite(turnPct) && turnPct >= 70) parts.push('거래 쏠림 상위');
  else if (Number.isFinite(turnPct) && turnPct >= 50) parts.push('거래 활발');
  if (newsCount > 0) parts.push(`뉴스 ${newsCount}건`);
  const sign = pct > 0 ? '+' : '';
  parts.push(`${sign}${pct.toFixed(1)}%`);
  return parts.join(' · ');
}

// ─── SessionDot (3순위, 마이크로) ────────────────────────────────
// 색 2개만: 초록 점멸(isLive) / 회색 정지(비라이브). 세션 구분은 텍스트 라벨이 담당.
function SessionDot({ status, align = 'left' }) {
  if (!status) return null;
  const live = !!status.isLive;
  return (
    <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <span className="relative flex items-center justify-center" style={{ width: 7, height: 7 }}>
        {live && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
            style={{ background: LIVE_DOT }}
          />
        )}
        <span
          className="relative inline-flex rounded-full"
          style={{ width: 7, height: 7, background: live ? LIVE_DOT : IDLE_DOT }}
        />
      </span>
      <span className="text-[11px] font-semibold whitespace-nowrap"
        style={{ color: live ? '#1A7D4B' : '#8B95A1' }}>
        {status.label}
      </span>
    </span>
  );
}

// ─── SessionBar — [좌: 주도시장] [중: 시계] [우: 보조시장] ──────────
function SessionBar({ primaryStatus, secondaryStatus, clockLabel }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <SessionDot status={primaryStatus} align="left" />
      {clockLabel && (
        <span className="text-[11px] font-medium text-[#B0B8C1] dark:text-[#6B7684] tabular-nums font-mono flex-shrink-0">
          {clockLabel}
        </span>
      )}
      <SessionDot status={secondaryStatus} align="right" />
    </div>
  );
}

// ─── FocusLeadCard — 대장주 1위 (풀폭) ───────────────────────────
function FocusLeadCard({ item, pct, newsCount, isGap, krwRate, onClick }) {
  const color = dirColor(pct);
  const price = formatPrice(item, krwRate);
  const spark = item?.sparkline?.length >= 3 ? item.sparkline : null;
  const path = spark ? sparkPath(spark, 96, 28) : '';
  const why = buildLeadWhy({ item, pct, newsCount, isGap });

  return (
    <div
      onClick={() => onClick?.(item)}
      className="rounded-2xl px-4 py-4 cursor-pointer transition-all hover:brightness-[0.99] active:scale-[0.995]"
      style={{ background: tintBg(pct) }}
      role="button"
      tabIndex={0}
    >
      {/* 상단: 로고 + 종목명 + (우) 가격/스파크 */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <TickerLogo item={item} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold text-[#191F28] dark:text-[#E5E8EB] truncate leading-tight">
            {item.name || item.symbol}
          </div>
          <div className="text-[11px] font-medium text-[#B0B8C1] dark:text-[#6B7684] font-mono">
            {item.symbol}
          </div>
        </div>
        {spark && (
          <svg width={96} height={28} className="flex-shrink-0" aria-hidden="true">
            <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* 등락률 (1순위 — 가장 크게) + 가격 */}
      <div className="flex items-baseline gap-2.5 mb-2.5">
        <span className="text-[26px] font-bold tabular-nums font-mono leading-none" style={{ color }}>
          {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
        </span>
        {price && (
          <span className="text-[14px] font-semibold tabular-nums font-mono text-[#6B7684] dark:text-[#8B95A1]">
            {price}
          </span>
        )}
      </div>

      {/* WHY (2순위 — ◆ LEAD 검정칩 + 정량근거) */}
      {why && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 bg-[#191F28] text-white tracking-wide">
            LEAD
          </span>
          <span className="text-[12px] font-medium text-[#4E5968] dark:text-[#B0B8C1] truncate">
            {why}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── CompactMoverRow — 대장주 2~3위 / GAP·COIN 무버 행 ────────────
function CompactMoverRow({ item, pct, newsCount, isGap, krwRate, onClick, showTopBorder }) {
  const color = dirColor(pct);
  const price = formatPrice(item, krwRate);
  // 행 단위는 근거를 더 짧게 — 뉴스 우선, 없으면 회전율/변동폭
  let reason = '';
  if (isGap) {
    const sign = pct > 0 ? '+' : '';
    reason = newsCount > 0 ? `어제 마감 ${sign}${pct.toFixed(1)}% · 뉴스 ${newsCount}건` : `어제 마감 ${sign}${pct.toFixed(1)}%`;
  } else if (newsCount > 0) {
    reason = `뉴스 ${newsCount}건`;
  } else {
    const turnPct = item?._leadBreakdown?.turn;
    reason = Number.isFinite(turnPct) && turnPct >= 70 ? '거래 쏠림' : '';
  }

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex items-center gap-2.5 py-2.5 cursor-pointer hover:bg-[#F7F8FA] dark:hover:bg-[#1C2230] -mx-2 px-2 rounded-lg transition-colors"
      style={showTopBorder ? { borderTop: '1px solid #F2F3F5' } : undefined}
      role="button"
      tabIndex={0}
    >
      <TickerLogo item={item} size={24} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[#191F28] dark:text-[#E5E8EB] truncate leading-tight">
          {item.name || item.symbol}
        </div>
        {reason && (
          <div className="text-[11px] font-medium text-[#8B95A1] dark:text-[#6B7684] truncate">{reason}</div>
        )}
      </div>
      {price && (
        <span className="text-[12px] font-semibold tabular-nums font-mono text-[#6B7684] dark:text-[#8B95A1] flex-shrink-0">
          {price}
        </span>
      )}
      <span className="text-[14px] font-bold tabular-nums font-mono flex-shrink-0 w-[64px] text-right" style={{ color }}>
        {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
      </span>
    </div>
  );
}

// ─── AltThemeChips — 동반 테마 칩 (LEAD 모드) ────────────────────
function AltThemeChips({ themes }) {
  if (!Array.isArray(themes) || themes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      <span className="text-[11px] font-medium text-[#B0B8C1] dark:text-[#6B7684] self-center mr-0.5">함께 오른 테마</span>
      {themes.map((t) => (
        <span
          key={t.theme}
          className="text-[11px] font-semibold px-2 py-1 rounded-full bg-[#F2F4F6] dark:bg-[#252B38] text-[#4E5968] dark:text-[#B0B8C1]"
        >
          {t.theme}
          {t.hot && <span className="ml-0.5" style={{ color: UP }}>·</span>}
        </span>
      ))}
    </div>
  );
}

// ─── BridgeLine — 전이구간 브릿지 (국장 모드, 한 줄) ──────────────
function BridgeLine({ bridge }) {
  if (!bridge?.line) return null;
  // tone에 따라 좌측 점 색 (up=빨강 / down=파랑 / flat=회색). 텍스트는 보조색(11px).
  const dot = bridge.tone === 'up' ? UP : bridge.tone === 'down' ? DOWN : NEUTRAL;
  return (
    <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid #F2F3F5' }}>
      <span className="inline-block rounded-full flex-shrink-0" style={{ width: 5, height: 5, background: dot }} />
      <span className="text-[11px] font-medium text-[#6B7684] dark:text-[#8B95A1] leading-snug">
        {bridge.line}
      </span>
    </div>
  );
}

// ─── 헤더 (모드별 타이틀 + 서브) ─────────────────────────────────
function SectionHeader({ title, subtitle, themeDir }) {
  return (
    <div className="mb-3">
      <h2 className="text-[19px] font-bold text-[#191F28] dark:text-[#E5E8EB] tracking-tight flex items-center gap-1.5">
        {title}
        {themeDir != null && (
          <span className="text-[15px]" style={{ color: themeDir >= 0 ? UP : DOWN }}>
            {themeDir >= 0 ? '▲' : '▼'}
          </span>
        )}
      </h2>
      {subtitle && <p className="text-[13px] text-[#8B95A1] dark:text-[#6B7684] mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── 카드 셸 ─────────────────────────────────────────────────────
function Shell({ children }) {
  return <div className="bg-white dark:bg-[#171B24] rounded-2xl p-5 pt-6">{children}</div>;
}

// ─── 메인 ────────────────────────────────────────────────────────
export default function MorphingFocusSection({
  krItems = [],
  usItems = [],
  coinItems = [],
  recentNews = [],
  krwRate = DEFAULT_KRW_RATE,
  krwRateLoaded = false,
  indices = [],
  onItemClick,
}) {
  // 세션 상태 — 컴포넌트 내부에서 직접 조회 (NotableMovers 패턴)
  const krStatus = getKoreanMarketStatus();
  const usStatus = getUsMarketStatus();

  const focus = useMemo(
    () => computeMorphFocus({
      krItems, usItems, coinItems, recentNews, krwRate, krwRateLoaded, indices, krStatus, usStatus,
    }),
    // krStatus/usStatus는 매 렌더 새 객체지만 phase만 의존 → phase 문자열로 안정화
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [krItems, usItems, coinItems, recentNews, krwRate, krwRateLoaded, indices, krStatus.phase, usStatus.phase],
  );

  const { mode, primaryTheme, altThemes, movers, bridge } = focus;
  const isGap = mode === MORPH_MODE.US_GAP || mode === MORPH_MODE.KR_GAP;
  const isCoin = mode === MORPH_MODE.COIN_LEAD;

  // 뉴스 매칭 카운트 — item별 (LEAD 카드/행 근거용). _leadNewsCount가 이미 있으면 그것 사용.
  const newsCountOf = (it) => {
    if (Number.isFinite(it?._leadNewsCount)) return it._leadNewsCount;
    return findRelatedNews(it, recentNews) ? 1 : 0;
  };

  const pctOf = (it) => (Number.isFinite(it?._leadPct) ? it._leadPct : 0);

  // 세션 바 구성 — 모드별 주도/보조 시장 매핑
  let primaryStatus = null;
  let secondaryStatus = null;
  let clockLabel = null;
  if (mode === MORPH_MODE.KR_LEAD || mode === MORPH_MODE.KR_GAP) {
    primaryStatus = krStatus;
    secondaryStatus = usStatus;
  } else if (mode === MORPH_MODE.US_LEAD || mode === MORPH_MODE.US_GAP) {
    primaryStatus = usStatus;
    secondaryStatus = krStatus;
  } else {
    // COIN_LEAD — 코인은 24시간이므로 라이브 점 없이 양쪽 휴장 표시
    primaryStatus = krStatus;
    secondaryStatus = usStatus;
  }
  try {
    clockLabel = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { clockLabel = null; }

  // ── LEAD 모드: 주도 테마가 있으면 테마형, 없으면 단일 폴백 ──
  if (mode === MORPH_MODE.KR_LEAD || mode === MORPH_MODE.US_LEAD) {
    const leaders = primaryTheme?.leaders || [];

    // 주도 테마가 있는 경우
    if (primaryTheme && leaders.length > 0) {
      const lead = leaders[0];
      const rest = leaders.slice(1, 3);
      const themeDir = pctOf(lead);
      return (
        <Shell>
          <SectionHeader
            title={`지금 주도 테마 ─ ${primaryTheme.theme}`}
            subtitle={mode === MORPH_MODE.KR_LEAD ? '국내 장중 · 거래 쏠림 기준' : '미국 장중 · 거래 쏠림 기준'}
            themeDir={themeDir}
          />
          <SessionBar primaryStatus={primaryStatus} secondaryStatus={secondaryStatus} clockLabel={clockLabel} />
          <FocusLeadCard
            item={lead} pct={pctOf(lead)} newsCount={newsCountOf(lead)}
            isGap={false} krwRate={krwRate} onClick={onItemClick}
          />
          {rest.length > 0 && (
            <div className="mt-1">
              {rest.map((it) => (
                <CompactMoverRow
                  key={itemKey(it)} item={it} pct={pctOf(it)} newsCount={newsCountOf(it)}
                  isGap={false} krwRate={krwRate} onClick={onItemClick} showTopBorder
                />
              ))}
            </div>
          )}
          <AltThemeChips themes={altThemes} />
          <BridgeLine bridge={bridge} />
        </Shell>
      );
    }

    // 무섹터 graceful degrade — primaryTheme 없음 → movers 단일 폴백
    if (movers.length > 0) {
      const lead = movers[0].item;
      const rest = movers.slice(1, 4);
      return (
        <Shell>
          <SectionHeader title="주목할 종목" subtitle="지금 시장에서 눈여겨볼 움직임" />
          <SessionBar primaryStatus={primaryStatus} secondaryStatus={secondaryStatus} clockLabel={clockLabel} />
          <FocusLeadCard
            item={lead} pct={movers[0].pct} newsCount={movers[0].newsCount}
            isGap={false} krwRate={krwRate} onClick={onItemClick}
          />
          {rest.length > 0 && (
            <div className="mt-1">
              {rest.map((m) => (
                <CompactMoverRow
                  key={itemKey(m.item)} item={m.item} pct={m.pct} newsCount={m.newsCount}
                  isGap={false} krwRate={krwRate} onClick={onItemClick} showTopBorder
                />
              ))}
            </div>
          )}
          <BridgeLine bridge={bridge} />
        </Shell>
      );
    }
    return null;
  }

  // ── GAP 모드: 시간외/프리/데이마켓 — 변동폭 무버 (실시간 단정 금지) ──
  if (isGap) {
    if (movers.length === 0) return null;
    const lead = movers[0];
    const rest = movers.slice(1, 5);
    const sessionWord = mode === MORPH_MODE.US_GAP
      ? (usStatus.label || '시간외')
      : (krStatus.label || '시간외');
    return (
      <Shell>
        <SectionHeader title={`지금 주목 · ${sessionWord}`} subtitle="정규장 밖 — 어제 마감 대비 움직임" />
        <SessionBar primaryStatus={primaryStatus} secondaryStatus={secondaryStatus} clockLabel={clockLabel} />
        <FocusLeadCard
          item={lead.item} pct={lead.pct} newsCount={lead.newsCount}
          isGap krwRate={krwRate} onClick={onItemClick}
        />
        {rest.length > 0 && (
          <div className="mt-1">
            {rest.map((m) => (
              <CompactMoverRow
                key={itemKey(m.item)} item={m.item} pct={m.pct} newsCount={m.newsCount}
                isGap krwRate={krwRate} onClick={onItemClick} showTopBorder
              />
            ))}
          </div>
        )}
        <BridgeLine bridge={bridge} />
      </Shell>
    );
  }

  // ── COIN_LEAD 모드: 코인 무버 + 다음 개장 안내 ──
  if (isCoin) {
    if (movers.length === 0) return null;
    const lead = movers[0];
    const rest = movers.slice(1, 5);
    return (
      <Shell>
        <SectionHeader title="지금은 코인 시간" subtitle="증시 마감 · 24시간 거래대금 기준" />
        <SessionBar primaryStatus={primaryStatus} secondaryStatus={secondaryStatus} clockLabel={clockLabel} />
        <FocusLeadCard
          item={lead.item} pct={lead.pct} newsCount={lead.newsCount}
          isGap={false} krwRate={krwRate} onClick={onItemClick}
        />
        {rest.length > 0 && (
          <div className="mt-1">
            {rest.map((m) => (
              <CompactMoverRow
                key={itemKey(m.item)} item={m.item} pct={m.pct} newsCount={m.newsCount}
                isGap={false} krwRate={krwRate} onClick={onItemClick} showTopBorder
              />
            ))}
          </div>
        )}
        {/* 다음 개장 안내 — 작게 */}
        <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid #F2F3F5' }}>
          <span className="inline-block rounded-full flex-shrink-0" style={{ width: 5, height: 5, background: IDLE_DOT }} />
          <span className="text-[11px] font-medium text-[#6B7684] dark:text-[#8B95A1]">
            국장 08:00 · 미장 22:30 개장 예정
          </span>
        </div>
      </Shell>
    );
  }

  return null;
}
