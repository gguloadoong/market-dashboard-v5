// 코인 탭

import { useState, useMemo } from 'react';
import StockCard from '../StockCard';
import SortFilter from '../SortFilter';

function sortCoins(coins, key, dir) {
  return [...coins].sort((a, b) => {
    let va, vb;
    if (key === 'changePct' || key === 'changePct') {
      va = a.change24h ?? 0;
      vb = b.change24h ?? 0;
    } else if (key === 'price') {
      va = a.priceUsd ?? 0;
      vb = b.priceUsd ?? 0;
    } else if (key === 'volume') {
      va = a.volume24h ?? 0;
      vb = b.volume24h ?? 0;
    } else if (key === 'marketCap') {
      va = a.marketCap ?? 0;
      vb = b.marketCap ?? 0;
    } else if (key === 'name') {
      return dir === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    } else {
      va = a[key] ?? 0;
      vb = b[key] ?? 0;
    }
    return dir === 'asc' ? va - vb : vb - va;
  });
}

export default function CoinTab({ coins = [], onCardClick }) {
  const [sortKey, setSortKey] = useState('marketCap');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [coinUnit, setCoinUnit] = useState('usd'); // 'usd' | 'krw'

  const items = useMemo(() => {
    let list = [...coins];
    if (search) list = list.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.toLowerCase().includes(search.toLowerCase())
    );
    return sortCoins(list, sortKey, sortDir);
  }, [coins, search, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <SortFilter
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k, d) => { setSortKey(k); setSortDir(d); }}
          searchQuery={search}
          onSearch={setSearch}
        />
        {/* USD/KRW 토글 */}
        <div className="flex border border-border rounded-md overflow-hidden ml-auto flex-shrink-0">
          <button className={`unit-btn ${coinUnit === 'usd' ? 'active' : ''}`} onClick={() => setCoinUnit('usd')}>USD</button>
          <button className={`unit-btn ${coinUnit === 'krw' ? 'active' : ''}`} onClick={() => setCoinUnit('krw')}>KRW</button>
        </div>
      </div>
      <div className="text-xs text-text3">{items.length}개 코인 · CoinGecko 실시간</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
        {items.map(coin => (
          <StockCard
            key={coin.id}
            item={coin}
            coinUnit={coinUnit}
            onClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
}
