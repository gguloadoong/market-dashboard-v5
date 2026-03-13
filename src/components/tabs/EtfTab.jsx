// ETF 탭 - 섹터별 분류

import { useState, useMemo } from 'react';
import StockCard from '../StockCard';
import SortFilter from '../SortFilter';

const CATEGORIES = ['지수', '채권', '섹터', '원자재', '테마', '해외', '인버스'];

function sortItems(items, key, dir) {
  return [...items].sort((a, b) => {
    if (key === 'name') {
      return dir === 'asc'
        ? a.name.localeCompare(b.name, 'ko')
        : b.name.localeCompare(a.name, 'ko');
    }
    const keyMap = { volume: 'volume', marketCap: 'aum', price: 'price', changePct: 'changePct' };
    const actualKey = keyMap[key] || key;
    const va = a[actualKey] ?? 0;
    const vb = b[actualKey] ?? 0;
    return dir === 'asc' ? va - vb : vb - va;
  });
}

// ETF는 카드에 aum 표시가 다르므로 어댑터
function etfToCard(etf) {
  return {
    ...etf,
    volume: etf.volume,
    marketCap: etf.aum,
  };
}

function EtfRow({ etf, onClick }) {
  const pct = etf.changePct;
  const isUp = pct > 0;
  const isDown = pct < 0;
  const dirColor = isUp ? 'c-up' : isDown ? 'c-down' : 'c-neutral';

  return (
    <div
      className="card px-4 py-3 flex items-center gap-3 cursor-pointer"
      onClick={() => onClick?.(etfToCard(etf))}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-text1">{etf.symbol}</span>
          <span className="text-[10px] bg-gray-100 text-text3 px-1.5 py-0.5 rounded">{etf.category}</span>
        </div>
        <div className="text-xs text-text2 truncate mt-0.5">{etf.name}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-bold font-mono text-sm text-text1">
          {etf.market === 'kr' ? `${etf.price?.toLocaleString('ko-KR')}원` : `$${etf.price?.toFixed(2)}`}
        </div>
        <div className={`text-xs font-mono ${dirColor}`}>
          {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(pct).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

export default function EtfTab({ etfs = [], onCardClick }) {
  const [sortKey, setSortKey] = useState('changePct');
  const [sortDir, setSortDir] = useState('desc');
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'

  const items = useMemo(() => {
    let list = [...etfs];
    if (category) list = list.filter(e => e.category === category);
    if (search) list = list.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.symbol.toLowerCase().includes(search.toLowerCase())
    );
    return sortItems(list, sortKey, sortDir);
  }, [etfs, category, search, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <SortFilter
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k, d) => { setSortKey(k); setSortDir(d); }}
          filter={category}
          onFilter={setCategory}
          filterOptions={CATEGORIES}
          searchQuery={search}
          onSearch={setSearch}
        />
        <div className="flex border border-border rounded-md overflow-hidden ml-auto">
          <button className={`unit-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>리스트</button>
          <button className={`unit-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>그리드</button>
        </div>
      </div>
      <div className="text-xs text-text3">{items.length}개 ETF</div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {items.map(etf => (
            <StockCard key={etf.symbol} item={etfToCard(etf)} onClick={onCardClick} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(etf => (
            <EtfRow key={etf.symbol} etf={etf} onClick={onCardClick} />
          ))}
        </div>
      )}
    </div>
  );
}
