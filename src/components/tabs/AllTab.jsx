// 전체보기 탭

import { useState, useMemo } from 'react';
import StockCard from '../StockCard';
import SortFilter from '../SortFilter';
import { getPct } from '../../utils/format';

function sortItems(items, key, dir) {
  return [...items].sort((a, b) => {
    let va, vb;
    if (key === 'changePct') {
      va = Math.abs(getPct(a));
      vb = Math.abs(getPct(b));
    } else if (key === 'name') {
      return dir === 'asc'
        ? a.name.localeCompare(b.name, 'ko')
        : b.name.localeCompare(a.name, 'ko');
    } else if (key === 'price') {
      va = a.id ? a.priceUsd : a.price;
      vb = b.id ? b.priceUsd : b.price;
    } else if (key === 'volume') {
      va = a.id ? a.volume24h : a.volume;
      vb = b.id ? b.volume24h : b.volume;
    } else {
      va = a[key] ?? 0;
      vb = b[key] ?? 0;
    }
    return dir === 'asc' ? va - vb : vb - va;
  });
}

export default function AllTab({ stocks = [], coins = [], coinUnit, onCardClick }) {
  const [sortKey, setSortKey] = useState('changePct');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const allItems = useMemo(() => {
    const combined = [
      ...stocks.map(s => ({ ...s, _type: 'stock' })),
      ...coins.map(c => ({ ...c, _type: 'coin' })),
    ];
    const filtered = search
      ? combined.filter(item =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          (item.symbol || '').toLowerCase().includes(search.toLowerCase())
        )
      : combined;
    return sortItems(filtered, sortKey, sortDir);
  }, [stocks, coins, sortKey, sortDir, search]);

  return (
    <div className="space-y-3">
      <SortFilter
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(k, d) => { setSortKey(k); setSortDir(d); }}
        searchQuery={search}
        onSearch={setSearch}
      />
      <div className="text-xs text-text3">{allItems.length}개 종목</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
        {allItems.map(item => (
          <StockCard
            key={item.id || item.symbol}
            item={item}
            coinUnit={coinUnit}
            onClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
}
