// 섹터 미니 위젯 — index.jsx에서 추출 (ExploreTabsWidget 섹터 탭용)
import { useState, useMemo } from 'react';
import { getPct } from './utils';
import { clampPct } from '../../utils/clampPct';

export default function SectorMiniContent({ krStocks = [], usStocks = [], coins = [], onTabChange, allItems = [], onItemClick }) {
  const [expandedSector, setExpandedSector] = useState(null);

  const sectors = useMemo(() => {
    const coinsWithPct = coins.filter(c => c.sector).map(c => ({ ...c, changePct: c.change24h ?? 0 }));
    const items = [...krStocks, ...usStocks, ...coinsWithPct];
    const map = {};
    for (const s of items) {
      if (!s.sector) continue;
      if (!map[s.sector]) map[s.sector] = { sum: 0, count: 0 };
      map[s.sector].sum += clampPct(s.changePct ?? 0);
      map[s.sector].count += 1;
    }
    return Object.entries(map)
      .map(([name, { sum, count }]) => ({ name, avg: parseFloat((sum / count).toFixed(2)) }))
      .sort((a, b) => b.avg - a.avg);
  }, [krStocks, usStocks, coins]);

  // 펼쳐진 섹터의 종목 리스트
  const expandedItems = useMemo(() => {
    if (!expandedSector || !allItems) return [];
    return allItems
      .filter(i => i.sector === expandedSector)
      .sort((a, b) => (getPct(b) || 0) - (getPct(a) || 0))
      .slice(0, 10);
  }, [expandedSector, allItems]);

  if (!sectors.length) {
    return <p className="text-[12px] text-[#8B95A1] py-4 text-center">섹터 데이터를 불러오는 중...</p>;
  }

  const hot  = sectors.filter(s => s.avg > 0).slice(0, 5);
  const cold = [...sectors.filter(s => s.avg <= 0)].reverse().slice(0, 5);

  // 섹터 칩 클릭 핸들러
  const handleSectorClick = (sectorName) => {
    setExpandedSector(prev => prev === sectorName ? null : sectorName);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold text-[#191F28]">섹터 자금 흐름</span>
          <span className="text-[12px] font-semibold text-[#8B95A1]">HOT · COLD</span>
        </div>
        <button
          onClick={() => onTabChange?.('sector')}
          className="text-[13px] text-[#3182F6] font-semibold hover:opacity-70 transition-opacity"
        >섹터 탭에서 상세 →</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* HOT */}
        <div className="flex-1">
          <span className="text-[12px] font-bold text-[#F04452] uppercase mb-2.5 block">HOT</span>
          <div className="flex flex-wrap gap-2">
            {hot.length > 0 ? hot.map(s => (
              <button
                key={s.name}
                onClick={() => handleSectorClick(s.name)}
                className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
                  expandedSector === s.name
                    ? 'bg-[#F04452] text-white'
                    : 'text-[#F04452] hover:bg-[#FFE0E3]'
                }`}
                style={expandedSector === s.name ? {} : { background: 'rgba(240,68,82,0.06)' }}
              >
                {s.name} +{s.avg.toFixed(1)}%
              </button>
            )) : <span className="text-[10px] text-[#B0B8C1]">없음</span>}
          </div>
        </div>
        {/* COLD */}
        <div className="flex-1">
          <span className="text-[12px] font-bold text-[#1764ED] uppercase mb-2.5 block">COLD</span>
          <div className="flex flex-wrap gap-2">
            {cold.length > 0 ? cold.map(s => (
              <button
                key={s.name}
                onClick={() => handleSectorClick(s.name)}
                className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
                  expandedSector === s.name
                    ? 'bg-[#1764ED] text-white'
                    : 'text-[#1764ED] hover:bg-[#DCE8FF]'
                }`}
                style={expandedSector === s.name ? {} : { background: 'rgba(23,100,237,0.06)' }}
              >
                {s.name} {s.avg.toFixed(1)}%
              </button>
            )) : <span className="text-[10px] text-[#B0B8C1]">없음</span>}
          </div>
        </div>
      </div>

      {/* 섹터 drill-down: 종목 리스트 인라인 펼침 */}
      {expandedSector && expandedItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#F2F4F6]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#191F28]">{expandedSector} 종목</span>
            <button
              onClick={() => setExpandedSector(null)}
              className="text-[10px] text-[#B0B8C1] hover:text-[#4E5968]"
            >접기 ✕</button>
          </div>
          <div className="space-y-1">
            {expandedItems.map(item => {
              const pct = getPct(item) || 0;
              const color = pct > 0 ? '#F04452' : pct < 0 ? '#1764ED' : '#8B95A1';
              return (
                <button
                  key={item.symbol || item.id}
                  onClick={() => onItemClick?.(item)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F7F8FA] active:bg-[#F2F4F6] transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-medium text-[#191F28] truncate block">{item.name || item.symbol}</span>
                    <span className="text-[10px] text-[#8B95A1] font-mono">{item.symbol}</span>
                  </div>
                  <span className="text-[12px] font-bold font-mono tabular-nums flex-shrink-0 ml-2" style={{ color }}>
                    {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
