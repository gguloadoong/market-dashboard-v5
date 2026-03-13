import { useMemo } from 'react';
import StockRow from './StockRow';
import Sparkline from './Sparkline';
import { fmt, fmtPct, getPct } from '../utils/format';

function PulseCard({ index, onClick }) {
  const isUp = index.changePct > 0;
  const isDown = index.changePct < 0;
  return (
    <div className="pulse-card" onClick={() => onClick?.(index)}>
      <div className="text-[12px] text-text2 mb-1">{index.name}</div>
      <div className="font-bold text-[16px] text-text1 tabular-nums">{fmt(index.value, index.id === 'DXY' ? 2 : 0)}</div>
      <div className={`text-[12px] tabular-nums mt-0.5 font-medium ${isUp ? 'text-up' : isDown ? 'text-down' : 'text-text2'}`}>
        {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(index.changePct).toFixed(2)}%
      </div>
    </div>
  );
}

function SectionHeader({ title, sub, onMore }) {
  return (
    <div className="section-header">
      <div>
        <span className="font-bold text-[16px] text-text1">{title}</span>
        {sub && <span className="ml-2 text-[12px] text-text3">{sub}</span>}
      </div>
      {onMore && (
        <button onClick={onMore} className="text-[13px] text-text2 hover:text-primary">
          전체 →
        </button>
      )}
    </div>
  );
}

function MoverCard({ item, coinUnit, onClick }) {
  const pct = getPct(item);
  const isUp = pct > 0;
  return (
    <div
      className="flex items-center gap-2 p-3 rounded-xl cursor-pointer hover:bg-[#F7F8FA] transition-colors"
      onClick={() => onClick?.(item)}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[14px] text-text1 truncate">{item.name}</div>
        <div className="text-[11px] text-text3">{item.symbol}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`font-bold text-[14px] tabular-nums ${isUp ? 'text-up' : 'text-down'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
        </div>
        <Sparkline data={item.sparkline} width={50} height={20} positive={isUp} />
      </div>
    </div>
  );
}

export default function HomeTab({ krStocks, usStocks, coins, indices, coinUnit, onCardClick, onTabChange }) {
  const allItems = useMemo(() => [
    ...krStocks, ...usStocks,
    ...coins.map(c => ({ ...c, changePct: c.change24h })),
  ], [krStocks, usStocks, coins]);

  const topGainers = useMemo(() =>
    [...allItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [allItems]);

  const topLosers = useMemo(() =>
    [...allItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [allItems]);

  const hotVolume = useMemo(() =>
    [...krStocks, ...usStocks]
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, 5), [krStocks, usStocks]);

  const krTop5 = useMemo(() =>
    [...krStocks].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5), [krStocks]);

  const usTop5 = useMemo(() =>
    [...usStocks].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5), [usStocks]);

  const coinTop5 = useMemo(() =>
    [...coins].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 5), [coins]);

  return (
    <div className="space-y-3 pb-8">
      {/* 시장 지수 */}
      <div className="section-card">
        <SectionHeader title="시장 요약" />
        <div className="px-4 pb-4 flex gap-2.5 overflow-x-auto no-scrollbar">
          {indices.map(idx => <PulseCard key={idx.id} index={idx} />)}
        </div>
      </div>

      {/* 지금 주목할 것 */}
      <div className="section-card">
        <SectionHeader title="📌 지금 주목할 것" sub="전체 시장 기준" />
        <div className="grid grid-cols-3 gap-0 divide-x divide-[#F2F4F6] px-4 pb-4">
          <div>
            <div className="text-[12px] font-semibold text-up mb-1 pl-1">급등 TOP 5</div>
            {topGainers.map(item => (
              <MoverCard key={item.id || item.symbol} item={item} coinUnit={coinUnit} onClick={onCardClick} />
            ))}
          </div>
          <div className="pl-3">
            <div className="text-[12px] font-semibold text-down mb-1 pl-1">급락 TOP 5</div>
            {topLosers.map(item => (
              <MoverCard key={item.id || item.symbol} item={item} coinUnit={coinUnit} onClick={onCardClick} />
            ))}
          </div>
          <div className="pl-3">
            <div className="text-[12px] font-semibold text-amber-500 mb-1 pl-1">거래량 TOP 5</div>
            {hotVolume.map(item => (
              <MoverCard key={item.symbol} item={item} coinUnit={coinUnit} onClick={onCardClick} />
            ))}
          </div>
        </div>
      </div>

      {/* 3개 시장 나란히 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 국장 */}
        <div className="section-card">
          <SectionHeader title="🇰🇷 국장" sub="코스피·코스닥" onMore={() => onTabChange('kr')} />
          <div className="divide-y divide-[#F2F4F6]">
            {krTop5.map((item, i) => (
              <StockRow key={item.symbol} item={item} rank={i + 1} onClick={onCardClick} />
            ))}
          </div>
        </div>

        {/* 미장 */}
        <div className="section-card">
          <SectionHeader title="🇺🇸 미장" sub="NYSE·NASDAQ" onMore={() => onTabChange('us')} />
          <div className="divide-y divide-[#F2F4F6]">
            {usTop5.map((item, i) => (
              <StockRow key={item.symbol} item={item} rank={i + 1} onClick={onCardClick} />
            ))}
          </div>
        </div>

        {/* 코인 */}
        <div className="section-card">
          <SectionHeader title="₿ 코인" sub="CoinGecko 실시간" onMore={() => onTabChange('coin')} />
          <div className="divide-y divide-[#F2F4F6]">
            {coinTop5.map((item, i) => (
              <StockRow key={item.id} item={item} rank={i + 1} coinUnit={coinUnit} onClick={onCardClick} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
