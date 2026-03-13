// 정렬/필터 바 컴포넌트

const SORT_OPTIONS = [
  { key: 'changePct', label: '등락률' },
  { key: 'price', label: '가격' },
  { key: 'volume', label: '거래량' },
  { key: 'marketCap', label: '시가총액' },
  { key: 'name', label: '이름' },
];

export default function SortFilter({
  sortKey,
  sortDir,
  onSort,
  filter,
  onFilter,
  filterOptions = [],
  searchQuery,
  onSearch,
}) {
  function handleSort(key) {
    if (sortKey === key) {
      onSort(key, sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      onSort(key, 'desc');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 검색 */}
      {onSearch !== undefined && (
        <div className="relative flex-shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="검색..."
            className="pl-7 pr-3 py-1.5 text-xs border border-border rounded-lg bg-surface text-text1 placeholder:text-text3 focus:outline-none focus:border-primary w-36"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text3 text-xs">🔍</span>
        </div>
      )}

      {/* 필터 chips */}
      {filterOptions.length > 0 && (
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          <button
            className={`chip ${!filter ? 'active' : ''}`}
            onClick={() => onFilter(null)}
          >
            전체
          </button>
          {filterOptions.map(opt => (
            <button
              key={opt}
              className={`chip ${filter === opt ? 'active' : ''}`}
              onClick={() => onFilter(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* 정렬 버튼 */}
      <div className="flex gap-1 ml-auto">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`sort-btn hidden sm:block ${sortKey === opt.key ? 'active' : ''}`}
            onClick={() => handleSort(opt.key)}
          >
            {opt.label}
            {sortKey === opt.key && (
              <span className="ml-0.5 text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
            )}
          </button>
        ))}
        {/* 모바일: 드롭다운 */}
        <select
          className="sm:hidden text-xs border border-border rounded-md px-2 py-1.5 bg-surface text-text2"
          value={sortKey}
          onChange={e => onSort(e.target.value, 'desc')}
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
