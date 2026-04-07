// 탐색 탭 위젯 — TopMoversWidget + SectorMini 탭 통합
// AI 토론은 별도 섹션으로 분리됨 (AiDebateSection)
import { useState } from 'react';
import TopMoversWidget from './widgets/TopMoversWidget';
import SectorMiniContent from './SectorMiniContent';

const TABS = [
  { id: 'hotcold', label: '급등/급락' },
  { id: 'sector',  label: '섹터' },
];

export default function ExploreTabsWidget({
  // 급등/급락
  hasData, krHot, usHot, coinHot, krDrop, usDrop, coinDrop, krwRate,
  onItemClick,
  // AI 토론 (미사용 — 하위 호환)
  usStocks,
  // 섹터
  krStocks, coins, allItems, onTabChange,
}) {
  const [activeTab, setActiveTab] = useState('hotcold');

  return (
    <div className="bg-white rounded-2xl p-5">
      {/* 섹션 헤더 */}
      <div className="mb-0">
        <h2 className="text-[19px] font-bold text-[#191F28] tracking-tight">탐색</h2>
      </div>

      {/* 탭 바 */}
      <div className="flex gap-1 bg-[#F4F5F7] rounded-[10px] p-[3px] mt-4 mb-4 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-[13px] font-semibold py-[7px] px-3 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white text-[#191F28] shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                : 'text-[#8B95A1] hover:text-[#4E5968]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'hotcold' && (
        <TopMoversWidget
          hasData={hasData}
          krHot={krHot} usHot={usHot} coinHot={coinHot}
          krDrop={krDrop} usDrop={usDrop} coinDrop={coinDrop}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {activeTab === 'sector' && (
        <SectorMiniContent
          krStocks={krStocks}
          usStocks={usStocks}
          coins={coins}
          allItems={allItems}
          onTabChange={onTabChange}
          onItemClick={onItemClick}
        />
      )}
    </div>
  );
}
