import { useState, useMemo } from 'react';
import StockRow from '../StockRow';

export default function CoinTab({ coins = [], onCardClick }) {
  const [search, setSearch]   = useState('');
  const [sortKey, setSortKey] = useState('marketCap');
  const [sortDir, setSortDir] = useState('desc');
  const [coinUnit, setCoinUnit] = useState('usd');

  const items = useMemo(() => {
    let list = [...coins];
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.symbol.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => {
      const keyMap = { changePct: 'change24h', price: 'priceUsd', volume: 'volume24h', marketCap: 'marketCap' };
      const k = keyMap[sortKey] || sortKey;
      const va = Math.abs(a[k] ?? 0);
      const vb = Math.abs(b[k] ?? 0);
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [coins, search, sortKey, sortDir]);

  return (
    <div className="space-y-3 pb-8">
      <div className="section-card px-4 py-3 flex items-center gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="코인명·심볼 검색"
          className="flex-1 text-[14px] bg-[#F7F8FA] rounded-xl px-3 py-2 outline-none placeholder:text-text3"
        />
        <div className="flex border border-border rounded-lg overflow-hidden flex-shrink-0">
          <button className={`unit-btn ${coinUnit === 'usd' ? 'active' : ''}`} onClick={() => setCoinUnit('usd')}>USD</button>
          <button className={`unit-btn ${coinUnit === 'krw' ? 'active' : ''}`} onClick={() => setCoinUnit('krw')}>KRW</button>
        </div>
        <select
          value={sortKey + '_' + sortDir}
          onChange={e => { const [k, d] = e.target.value.split('_'); setSortKey(k); setSortDir(d); }}
          className="text-[13px] border border-border rounded-lg px-2 py-1.5 bg-surface text-text2"
        >
          <option value="marketCap_desc">시총↓</option>
          <option value="changePct_desc">등락률↓</option>
          <option value="volume_desc">거래량↓</option>
          <option value="price_desc">가격↓</option>
        </select>
      </div>
      <div className="section-card">
        <div className="px-4 py-2.5 border-b border-[#F2F4F6] flex items-center justify-between">
          <span className="text-[12px] text-text3">{items.length}개 코인</span>
          <span className="text-[11px] text-green-500 font-semibold">● CoinGecko 실시간</span>
        </div>
        {items.map((item, i) => (
          <StockRow key={item.id} item={item} rank={i + 1} coinUnit={coinUnit} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
