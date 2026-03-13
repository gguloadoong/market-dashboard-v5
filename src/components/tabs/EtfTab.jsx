import { useState, useMemo } from 'react';
import StockRow from '../StockRow';

const CATEGORIES = ['지수','채권','섹터','원자재','테마','해외','인버스'];

export default function EtfTab({ etfs = [], onCardClick }) {
  const [category, setCategory] = useState(null);
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState('changePct');
  const [sortDir, setSortDir]   = useState('desc');

  const items = useMemo(() => {
    let list = [...etfs];
    if (category) list = list.filter(e => e.category === category);
    if (search) list = list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.symbol.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => {
      const va = sortKey === 'changePct' ? Math.abs(a.changePct) : sortKey === 'marketCap' ? (a.aum ?? 0) : a[sortKey] ?? 0;
      const vb = sortKey === 'changePct' ? Math.abs(b.changePct) : sortKey === 'marketCap' ? (b.aum ?? 0) : b[sortKey] ?? 0;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [etfs, category, search, sortKey, sortDir]);

  // ETF는 aum → marketCap, volume 그대로
  const toRow = e => ({ ...e, marketCap: e.aum });

  return (
    <div className="space-y-3 pb-8">
      <div className="section-card px-4 py-3 flex items-center gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ETF명·심볼 검색"
          className="flex-1 text-[14px] bg-[#F7F8FA] rounded-xl px-3 py-2 outline-none placeholder:text-text3"
        />
        <select
          value={sortKey + '_' + sortDir}
          onChange={e => { const [k, d] = e.target.value.split('_'); setSortKey(k); setSortDir(d); }}
          className="text-[13px] border border-border rounded-lg px-2 py-1.5 bg-surface text-text2"
        >
          <option value="changePct_desc">등락률↓</option>
          <option value="changePct_asc">등락률↑</option>
          <option value="marketCap_desc">AUM↓</option>
          <option value="price_desc">가격↓</option>
        </select>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button className={`chip ${!category ? 'active' : ''}`} onClick={() => setCategory(null)}>전체</button>
        {CATEGORIES.map(c => (
          <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>
      <div className="section-card">
        <div className="px-4 py-2.5 border-b border-[#F2F4F6] text-[12px] text-text3">{items.length}개 ETF</div>
        {items.map((item, i) => (
          <StockRow key={item.symbol} item={toRow(item)} rank={i + 1} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
