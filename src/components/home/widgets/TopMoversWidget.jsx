// 급등/급락 위젯 — KR/US/COIN 탭
import { useState } from 'react';
import HotListSection from '../HotListSection';

const TABS = [
  { id: 'all', label: '전체' },
  { id: 'kr',  label: '🇰🇷 국내' },
  { id: 'us',  label: '🇺🇸 미장' },
  { id: 'coin',label: '🪙 코인' },
];

export default function TopMoversWidget({ hasData, krHot, usHot, coinHot, krDrop, usDrop, coinDrop, krwRate, onItemClick }) {
  const [tab, setTab] = useState('all');

  const filtered = {
    krHot:   tab === 'us' || tab === 'coin' ? [] : krHot,
    usHot:   tab === 'kr' || tab === 'coin' ? [] : usHot,
    coinHot: tab === 'kr' || tab === 'us'   ? [] : coinHot,
    krDrop:  tab === 'us' || tab === 'coin' ? [] : krDrop,
    usDrop:  tab === 'kr' || tab === 'coin' ? [] : usDrop,
    coinDrop:tab === 'kr' || tab === 'us'   ? [] : coinDrop,
  };

  return (
    <div>
      {/* 탭 헤더 */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-[12px] font-bold text-[#8B95A1] uppercase tracking-wide mr-2">급등/급락</span>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
              tab === t.id ? 'bg-[#191F28] text-white' : 'bg-white text-[#6B7684] hover:bg-[#F2F4F6]'
            }`}
          >{t.label}</button>
        ))}
      </div>
      <HotListSection hasData={hasData} krwRate={krwRate} onItemClick={onItemClick} {...filtered} />
    </div>
  );
}
