// 국장 탭

import { useState, useMemo } from 'react';
import StockCard from '../StockCard';
import SortFilter from '../SortFilter';

const SECTORS = ['반도체', 'IT', '화학', '배터리', '바이오', '자동차', '금융', '보험', '통신', '지주', '가전', '부품', '제약', '해운', '금속', '방산', '에너지', '유틸리티', 'IT서비스'];

function sortItems(items, key, dir) {
  return [...items].sort((a, b) => {
    if (key === 'name') {
      return dir === 'asc'
        ? a.name.localeCompare(b.name, 'ko')
        : b.name.localeCompare(a.name, 'ko');
    }
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    return dir === 'asc' ? va - vb : vb - va;
  });
}

export default function KoreanTab({ stocks = [], onCardClick }) {
  const [sortKey, setSortKey] = useState('changePct');
  const [sortDir, setSortDir] = useState('desc');
  const [sector, setSector] = useState(null);
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    let list = stocks.filter(s => s.market === 'kr');
    if (sector) list = list.filter(s => s.sector === sector);
    if (search) list = list.filter(s =>
      s.name.includes(search) || s.symbol.includes(search)
    );
    return sortItems(list, sortKey, sortDir);
  }, [stocks, sector, search, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <SortFilter
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(k, d) => { setSortKey(k); setSortDir(d); }}
        filter={sector}
        onFilter={setSector}
        filterOptions={SECTORS}
        searchQuery={search}
        onSearch={setSearch}
      />
      <div className="text-xs text-text3">{items.length}개 종목</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
        {items.map(item => (
          <StockCard key={item.symbol} item={item} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
