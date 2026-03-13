// 주요 지수 요약 카드 행

import { fmt, fmtPct } from '../utils/format';

function IndexCard({ index }) {
  const { name, value, changePct } = index;
  const isUp = changePct > 0;
  const isDown = changePct < 0;

  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 flex-1 min-w-[110px] shadow-card">
      <div className="text-[11px] text-text2 font-medium mb-1 truncate">{name}</div>
      <div className="font-bold text-text1 font-mono text-sm">{fmt(value, 2)}</div>
      <div className={`text-xs font-mono mt-0.5 ${isUp ? 'c-up' : isDown ? 'c-down' : 'c-neutral'}`}>
        {isUp ? '▲' : isDown ? '▼' : '—'} {fmtPct(changePct)}
      </div>
    </div>
  );
}

export default function IndexSummary({ indices = [] }) {
  if (!indices.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {indices.map(idx => (
        <IndexCard key={idx.id} index={idx} />
      ))}
    </div>
  );
}
