// 워치리스트 테이블 — 국장/미장/코인/ETF 공통 사용
import { useState, useRef, useEffect, useMemo } from 'react';
import Sparkline from './Sparkline';

// ─── 유틸 함수 ─────────────────────────────────────────────────
function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtLarge(n) {
  if (!n) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
function getPct(item) {
  return item.id ? (item.change24h ?? 0) : (item.changePct ?? 0);
}
// 가격을 KRW로 표시
function fmtKrwPrice(item, krwRate) {
  if (item.id) {
    // 코인: KRW 우선
    const p = item.priceKrw || item.priceUsd * krwRate;
    if (!p) return '—';
    if (p < 1) return `₩${p.toFixed(4)}`;
    if (p < 100) return `₩${fmt(p, 2)}`;
    return `₩${fmt(Math.round(p))}`;
  }
  if (item.market === 'kr') return `₩${fmt(item.price)}`;
  // 미장: 달러 + 원화 환산
  if (item.market === 'us') {
    const krw = Math.round(item.price * krwRate);
    return `₩${fmt(krw)}`;
  }
  return `₩${fmt(item.price)}`;
}
function fmtChangeAmt(item, krwRate) {
  if (item.id) return ''; // 코인은 퍼센트만
  const amt = item.change ?? 0;
  const sign = amt >= 0 ? '+' : '';
  if (item.market === 'kr') return `${sign}₩${fmt(Math.abs(amt))}`;
  if (item.market === 'us') return `${sign}₩${fmt(Math.abs(Math.round(amt * krwRate)))}`;
  return `${sign}${amt.toFixed(2)}`;
}

// ─── 행 플래시 애니메이션 ───────────────────────────────────
function FlashRow({ item, rank, krwRate, onClick, searchTerm }) {
  const rowRef  = useRef(null);
  const prevPct = useRef(getPct(item));
  const pct     = getPct(item);
  const isUp    = pct > 0;
  const isDown  = pct < 0;
  const isHot   = pct >= 3;

  useEffect(() => {
    if (pct !== prevPct.current && rowRef.current) {
      const cls = pct > prevPct.current ? 'flash-up' : 'flash-down';
      rowRef.current.classList.add(cls);
      const t = setTimeout(() => rowRef.current?.classList.remove(cls), 500);
      prevPct.current = pct;
      return () => clearTimeout(t);
    }
    prevPct.current = pct;
  }, [pct]);

  // 검색어 하이라이트
  const highlight = (text) => {
    if (!searchTerm || !text) return text;
    const idx = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 text-inherit rounded">{text.slice(idx, idx + searchTerm.length)}</mark>
        {text.slice(idx + searchTerm.length)}
      </>
    );
  };

  const volume = item.id ? item.volume24h : item.volume;
  const mcap   = item.id ? item.marketCap : item.marketCap;

  return (
    <tr
      ref={rowRef}
      onClick={() => onClick?.(item)}
      className={`border-b border-[#F2F4F6] cursor-pointer transition-colors duration-100 hover:bg-[#F9FAFB] active:bg-[#F2F4F6] ${isHot ? 'bg-[#FFFBFB]' : ''}`}
    >
      {/* 순위 */}
      <td className="pl-5 pr-2 py-3.5 text-[13px] text-[#B0B8C1] w-8 text-center">{rank}</td>

      {/* 종목명 */}
      <td className="px-2 py-3.5">
        <div className="flex items-center gap-2.5">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-semibold text-[#191F28]">
                {highlight(item.name)}
              </span>
              {isHot && <span className="text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] px-1.5 py-0.5 rounded">HOT</span>}
            </div>
            <div className="text-[12px] text-[#B0B8C1] mt-0.5">
              {item.symbol}
              {item.sector && <span className="ml-1.5 text-[11px]">{item.sector}</span>}
            </div>
          </div>
        </div>
      </td>

      {/* 현재가 (KRW 기본) */}
      <td className="px-4 py-3.5 text-right w-36">
        <div className="text-[15px] font-semibold text-[#191F28] tabular-nums font-mono">
          {fmtKrwPrice(item, krwRate)}
        </div>
        {item.market === 'us' && item.price && (
          <div className="text-[11px] text-[#B0B8C1] tabular-nums font-mono mt-0.5">
            ${fmt(item.price, 2)}
          </div>
        )}
      </td>

      {/* 전일대비 */}
      <td className={`px-4 py-3.5 text-right w-32 text-[13px] tabular-nums font-mono ${isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#6B7684]'}`}>
        {fmtChangeAmt(item, krwRate)}
      </td>

      {/* 등락률 */}
      <td className="px-4 py-3.5 text-right w-24">
        <span className={`inline-block px-2 py-0.5 rounded text-[13px] font-semibold tabular-nums font-mono ${
          isUp ? 'bg-[#FFF0F1] text-[#F04452]' : isDown ? 'bg-[#F0F4FF] text-[#1764ED]' : 'bg-[#F2F4F6] text-[#6B7684]'
        }`}>
          {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(pct).toFixed(2)}%
        </span>
      </td>

      {/* 거래량 */}
      <td className="px-4 py-3.5 text-right w-28 text-[13px] text-[#6B7684] tabular-nums">
        {fmtLarge(volume)}
      </td>

      {/* 시총 */}
      <td className="px-4 py-3.5 text-right w-28 text-[13px] text-[#6B7684] tabular-nums hidden lg:table-cell">
        {fmtLarge(mcap)}
      </td>

      {/* 스파크라인 */}
      <td className="px-4 py-3.5 w-24">
        <Sparkline
          data={item.sparkline}
          width={80}
          height={28}
          positive={isUp ? true : isDown ? false : undefined}
        />
      </td>
    </tr>
  );
}

// ─── 컬럼 헤더 ──────────────────────────────────────────────
function SortHeader({ label, sortKey, currentKey, currentDir, onSort, className = '' }) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-4 py-2.5 text-right text-[11px] font-medium text-[#B0B8C1] cursor-pointer hover:text-[#6B7684] select-none ${className}`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active && <span className="ml-1">{currentDir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function WatchlistTable({ items = [], type = 'kr', krwRate = 1466, onRowClick }) {
  const [sortKey, setSortKey] = useState('changePct');
  const [sortDir, setSortDir] = useState('desc');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all'); // all | up | down | hot

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => {
    let list = [...items];

    // 검색
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.symbol || '').toLowerCase().includes(q)
      );
    }

    // 필터
    if (filter === 'up')   list = list.filter(i => getPct(i) > 0);
    if (filter === 'down') list = list.filter(i => getPct(i) < 0);
    if (filter === 'hot')  list = list.filter(i => getPct(i) >= 3);

    // 정렬
    list.sort((a, b) => {
      let va, vb;
      if (sortKey === 'changePct') {
        va = Math.abs(getPct(a)); vb = Math.abs(getPct(b));
      } else if (sortKey === 'price') {
        va = a.id ? (a.priceKrw || a.priceUsd * krwRate) : (a.market === 'us' ? a.price * krwRate : a.price);
        vb = b.id ? (b.priceKrw || b.priceUsd * krwRate) : (b.market === 'us' ? b.price * krwRate : b.price);
      } else if (sortKey === 'volume') {
        va = a.id ? a.volume24h : a.volume;
        vb = b.id ? b.volume24h : b.volume;
      } else if (sortKey === 'marketCap') {
        va = a.id ? a.marketCap : (a.aum ?? a.marketCap ?? 0);
        vb = b.id ? b.marketCap : (b.aum ?? b.marketCap ?? 0);
      } else {
        va = a[sortKey] ?? 0; vb = b[sortKey] ?? 0;
      }
      return sortDir === 'desc' ? (vb ?? 0) - (va ?? 0) : (va ?? 0) - (vb ?? 0);
    });

    return list;
  }, [items, search, filter, sortKey, sortDir, krwRate]);

  const hotCount = items.filter(i => getPct(i) >= 3).length;

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      {/* 검색 + 필터 바 */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#F2F4F6]">
        {/* 검색 */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B8C1]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="종목명·심볼 검색"
            className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-[#F7F8FA] rounded-lg outline-none placeholder:text-[#B0B8C1]"
          />
        </div>

        {/* 필터 버튼 */}
        <div className="flex gap-1.5">
          {[
            { key: 'all',  label: '전체' },
            { key: 'hot',  label: `🔥 급등${hotCount > 0 ? ` ${hotCount}` : ''}` },
            { key: 'up',   label: '상승' },
            { key: 'down', label: '하락' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-[12px] rounded-lg font-medium transition-colors ${
                filter === f.key
                  ? 'bg-[#191F28] text-white'
                  : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ml-auto text-[12px] text-[#B0B8C1]">{sorted.length}개 종목</div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F8F9FA]">
              <th className="pl-5 pr-2 py-2.5 text-center text-[11px] font-medium text-[#B0B8C1] w-8">#</th>
              <th className="px-2 py-2.5 text-left text-[11px] font-medium text-[#B0B8C1]">종목</th>
              <SortHeader label="현재가" sortKey="price"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="전일대비" sortKey="change"  currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="등락률"  sortKey="changePct" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="거래량"  sortKey="volume"   currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="시가총액" sortKey="marketCap" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-[#B0B8C1] w-24">차트</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <FlashRow
                key={item.id || item.symbol}
                item={item}
                rank={i + 1}
                krwRate={krwRate}
                onClick={onRowClick}
                searchTerm={search}
              />
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="py-16 text-center text-[14px] text-[#B0B8C1]">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
