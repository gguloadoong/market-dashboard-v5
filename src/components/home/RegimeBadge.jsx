// 시장 레짐 배지 — 하락장/혼조/상승장 컨텍스트 한 줄 (#358)
// ADR-002 색 컨벤션: 빨강=상승, 파랑=하락 (한국 투자자 체화). mixed=중립 회색.
import { computeMarketRegime } from '../../utils/marketRegime';

const STYLE = {
  down:  { glyph: '▼', color: '#1764ED', bg: 'rgba(23,100,237,0.08)' },  // 파랑=하락
  up:    { glyph: '▲', color: '#F04452', bg: 'rgba(240,68,82,0.08)' },   // 빨강=상승
  mixed: { glyph: '↔', color: '#8B95A1', bg: 'rgba(139,149,161,0.12)' }, // 다크모드 표면에서도 안전한 알파
};

/**
 * @param {Array} indices  useIndices().indices
 * @param {boolean} [showAvg=true] 평균 등락률(%) 병기 여부
 */
export default function RegimeBadge({ indices, showAvg = true, className = '' }) {
  const regime = computeMarketRegime(indices);
  if (!regime) return null;
  const s = STYLE[regime.regime] || STYLE.mixed;
  // 혼조는 avg(-2~+2) 표기 시 경계 반올림으로 "혼조 -2%" 같은 모순이 보일 수 있어 라벨만 표시.
  const avgStr = showAvg && regime.regime !== 'mixed'
    ? ` ${regime.avg > 0 ? '+' : ''}${regime.avg}%`
    : '';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${className}`}
      style={{ background: s.bg, color: s.color }}
      title={`주요 지수 평균 ${regime.avg > 0 ? '+' : ''}${regime.avg}% — ${regime.label}`}
    >
      <span aria-hidden="true">{s.glyph}</span>
      {regime.label}{avgStr}
    </span>
  );
}
