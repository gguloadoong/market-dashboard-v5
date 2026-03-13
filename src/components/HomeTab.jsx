import { useMemo } from 'react';
import StockRow from './StockRow';
import Sparkline from './Sparkline';
import NewsSection from './NewsSection';
import { fmt, fmtPrice, getPct } from '../utils/format';

/* ── 지수 카드 ── */
function IndexCard({ idx }) {
  const isUp   = idx.changePct > 0;
  const isDown = idx.changePct < 0;
  return (
    <div className="index-card">
      <div className="text-[12px] font-medium text-text2 mb-2">{idx.name}</div>
      <div className="text-[17px] font-bold text-text1 tabular-nums leading-none">
        {fmt(idx.value, idx.id === 'DXY' ? 2 : 0)}
      </div>
      <div className={`text-[12px] font-semibold tabular-nums mt-1.5 ${isUp ? 'text-up' : isDown ? 'text-down' : 'text-text2'}`}>
        {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(idx.changePct).toFixed(2)}%
      </div>
    </div>
  );
}

/* ── 시장 분위기 ── */
function MarketMood({ stocks, coins }) {
  const { upCount, downCount, mood, emoji, desc } = useMemo(() => {
    const allPcts = [
      ...stocks.map(s => s.changePct ?? 0),
      ...coins.map(c => c.change24h ?? 0),
    ];
    const up   = allPcts.filter(p => p > 0).length;
    const down = allPcts.filter(p => p < 0).length;
    const total = allPcts.length;
    const upRatio = up / total;

    if (upRatio >= 0.7)  return { upCount: up, downCount: down, mood: '강세장',  emoji: '🚀', desc: '전체 자산의 70% 이상이 상승 중' };
    if (upRatio >= 0.55) return { upCount: up, downCount: down, mood: '상승세',  emoji: '📈', desc: '글로벌 시장 전반적 상승 중' };
    if (upRatio <= 0.3)  return { upCount: up, downCount: down, mood: '하락세',  emoji: '📉', desc: '전체 자산의 70% 이상이 하락 중' };
    if (upRatio <= 0.45) return { upCount: up, downCount: down, mood: '약세장',  emoji: '⚠️', desc: '글로벌 시장 전반적 하락 중' };
    return                     { upCount: up, downCount: down, mood: '혼조세',  emoji: '↔️', desc: '상승·하락 종목이 팽팽하게 나뉨' };
  }, [stocks, coins]);

  return (
    <div className="px-5 py-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] text-text2 font-medium mb-1">지금 시장은</div>
          <div className="text-[22px] font-bold text-text1">{emoji} {mood}</div>
          <div className="text-[13px] text-text2 mt-1">{desc}</div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-text3 mb-2">전체 종목</div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[18px] font-bold text-up">{upCount}</div>
              <div className="text-[11px] text-text3">상승</div>
            </div>
            <div className="text-center">
              <div className="text-[18px] font-bold text-down">{downCount}</div>
              <div className="text-[11px] text-text3">하락</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 급등/급락 모버 카드 ── */
function MoverCard({ item, coinUnit, onClick }) {
  const pct  = getPct(item);
  const isUp = pct > 0;
  return (
    <div
      className="flex items-center justify-between py-3 cursor-pointer active:opacity-70 transition-opacity"
      onClick={() => onClick?.(item)}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-text1 truncate">{item.name}</div>
        <div className="text-[12px] text-text3">{item.symbol}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <Sparkline data={item.sparkline} width={44} height={18} positive={isUp} />
        <div className={`text-[13px] font-bold tabular-nums ${isUp ? 'text-up' : 'text-down'}`}>
          {isUp ? '+' : ''}{pct?.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

/* ── 홈 탭 ── */
export default function HomeTab({ krStocks, usStocks, coins, indices, coinUnit, onCardClick, onTabChange }) {
  const allStocks = [...krStocks, ...usStocks];

  const topGainers = useMemo(() =>
    [...allStocks, ...coins.map(c => ({ ...c, changePct: c.change24h }))]
      .sort((a, b) => getPct(b) - getPct(a)).slice(0, 5),
    [allStocks, coins]);

  const topLosers = useMemo(() =>
    [...allStocks, ...coins.map(c => ({ ...c, changePct: c.change24h }))]
      .sort((a, b) => getPct(a) - getPct(b)).slice(0, 5),
    [allStocks, coins]);

  const krTop = useMemo(() =>
    [...krStocks].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5),
    [krStocks]);

  const usTop = useMemo(() =>
    [...usStocks].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5),
    [usStocks]);

  const coinTop = useMemo(() =>
    [...coins].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 5),
    [coins]);

  return (
    <div className="space-y-2.5 pb-10">

      {/* ── 시장 지수 ── */}
      <div className="sc">
        <div className="sc-header pb-2">
          <span className="sc-title">시장 지수</span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 pb-5">
          {indices.map(idx => <IndexCard key={idx.id} idx={idx} />)}
        </div>
      </div>

      {/* ── 시장 분위기 ── */}
      <div className="sc">
        <MarketMood stocks={allStocks} coins={coins} />
      </div>

      {/* ── 급등 / 급락 ── */}
      <div className="sc">
        <div className="grid grid-cols-2 divide-x divide-[#F2F4F6]">
          <div className="px-4 pt-4 pb-2">
            <div className="text-[13px] font-bold text-up mb-1 flex items-center gap-1">
              <span>🔥</span> 급등
            </div>
            <div className="divide-y divide-[#F2F4F6]">
              {topGainers.map(item => (
                <MoverCard key={item.id || item.symbol} item={item} coinUnit={coinUnit} onClick={onCardClick} />
              ))}
            </div>
          </div>
          <div className="px-4 pt-4 pb-2">
            <div className="text-[13px] font-bold text-down mb-1 flex items-center gap-1">
              <span>❄️</span> 급락
            </div>
            <div className="divide-y divide-[#F2F4F6]">
              {topLosers.map(item => (
                <MoverCard key={item.id || item.symbol} item={item} coinUnit={coinUnit} onClick={onCardClick} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 최신 뉴스 ── */}
      <div className="sc">
        <div className="sc-header">
          <span className="sc-title">📰 최신 뉴스</span>
          <button className="sc-more" onClick={() => onTabChange('news')}>전체 보기 →</button>
        </div>
        <NewsSection limit={5} showFilter={false} />
      </div>

      {/* ── 국장 TOP 5 ── */}
      <div className="sc">
        <div className="sc-header">
          <span className="sc-title">🇰🇷 국장</span>
          <button className="sc-more" onClick={() => onTabChange('kr')}>전체 →</button>
        </div>
        {krTop.map((item, i) => (
          <StockRow key={item.symbol} item={item} rank={i + 1} onClick={onCardClick} />
        ))}
      </div>

      {/* ── 미장 TOP 5 ── */}
      <div className="sc">
        <div className="sc-header">
          <span className="sc-title">🇺🇸 미장</span>
          <button className="sc-more" onClick={() => onTabChange('us')}>전체 →</button>
        </div>
        {usTop.map((item, i) => (
          <StockRow key={item.symbol} item={item} rank={i + 1} onClick={onCardClick} />
        ))}
      </div>

      {/* ── 코인 TOP 5 ── */}
      <div className="sc">
        <div className="sc-header">
          <span className="sc-title">₿ 코인</span>
          <button className="sc-more" onClick={() => onTabChange('coin')}>전체 →</button>
        </div>
        {coinTop.map((item, i) => (
          <StockRow key={item.id} item={item} rank={i + 1} coinUnit={coinUnit} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
