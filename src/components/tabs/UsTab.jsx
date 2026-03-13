import { useState, useMemo } from 'react';
import StockRow from '../StockRow';

const SECTORS = ['테크', '반도체', '금융', '소비재', '전기차'];

export default function UsTab({ stocks = [], onCardClick }) {
  const [sector, setSector] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('changePct');
  const [sortDir, setSortDir] = useState('desc');

  const items = useMemo(() => {
    let list = stocks.filter(s => s.market === 'us');
    if (sector) list = list.filter(s => s.sector === sector);
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.symbol.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => {
      const va = sortKey === 'changePct' ? Math.abs(a.changePct) : a[sortKey] ?? 0;
      const vb = sortKey === 'changePct' ? Math.abs(b.changePct) : b[sortKey] ?? 0;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [stocks, sector, search, sortKey, sortDir]);

  return (
    <div className="space-y-3 pb-8">
      <div className="section-card px-4 py-3 flex items-center gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="종목명·심볼 검색"
          className="flex-1 text-[14px] bg-[#F7F8FA] rounded-xl px-3 py-2 outline-none placeholder:text-text3"
        />
        <select
          value={sortKey + '_' + sortDir}
          onChange={e => { const [k, d] = e.target.value.split('_'); setSortKey(k); setSortDir(d); }}
          className="text-[13px] border border-border rounded-lg px-2 py-1.5 bg-surface text-text2"
        >
          <option value="changePct_desc">등락률↓</option>
          <option value="changePct_asc">등락률↑</option>
          <option value="volume_desc">거래량↓</option>
          <option value="marketCap_desc">시총↓</option>
          <option value="price_desc">가격↓</option>
        </select>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button className={`chip ${!sector ? 'active' : ''}`} onClick={() => setSector(null)}>전체</button>
        {SECTORS.map(s => (
          <button key={s} className={`chip ${sector === s ? 'active' : ''}`} onClick={() => setSector(s)}>{s}</button>
        ))}
      </div>
      <div className="section-card">
        <div className="px-4 py-2.5 border-b border-[#F2F4F6] text-[12px] text-text3">{items.length}개 종목</div>
        {items.map((item, i) => (
          <StockRow key={item.symbol} item={item} rank={i + 1} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
