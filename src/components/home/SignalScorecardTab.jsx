// 시그널 성적표 탭 — 4캐릭터 정직 트랙레코드 (Issue #370)
// 공정 적중률(signal_accuracy_v2 fair-hit) 기준. 발화 무변경, 순수 노출.
import { useSignalCharacters } from '../../hooks/useSignalCharacters';
import { CHARACTER_STATUS } from '../../constants/signalCharacters';

// ── 봇 한국어 이름 (CommandCenterWidget 등 외부 의존 — export 유지) ──
const SIGNAL_BOT_NAMES = {
  volume_anomaly:           '거래량 폭발',
  composite_score:          '종합 매수·매도 신호',
  support_resistance_break: '지지·저항 돌파',
  double_bottom:            '이중바닥 패턴',
};

// 적중률 → 색상 (ADR-002: 한국 색관습은 가격 방향용 — 적중률은 성과 색이라 green=좋음 유지)
function accuracyColor(pct) {
  if (pct >= 70) return '#2AC769';
  if (pct >= 50) return '#FF9500';
  return '#F04452';
}

// status별 배지 (정직성 가드)
function statusBadge(status) {
  if (status === CHARACTER_STATUS.LIVE) return { label: '● 라이브', bg: '#2AC769' };
  if (status === CHARACTER_STATUS.REVIVE) return { label: '부활 예정', bg: '#FF9500' };
  return { label: '측정 준비 중', bg: '#B0B8C1' }; // measuring
}

// ── 캐릭터 카드 ──
function CharacterCard({ char }) {
  const showAcc = char.accuracy != null; // measuring → null (적중률 숨김)
  const accColor = showAcc ? accuracyColor(char.accuracy) : '#B0B8C1';
  const badge = statusBadge(char.status);
  const dormant = char.status === CHARACTER_STATUS.REVIVE && char.last30dFired === 0;

  return (
    <div className="flex items-center gap-3 py-3.5 border-t border-[#F2F4F6] first:border-t-0">
      <span className="text-[24px] flex-shrink-0 leading-none">{char.emoji}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-bold text-[#191F28]">{char.name}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
            style={{ background: badge.bg }}
          >
            {badge.label}
          </span>
        </div>
        <p className="text-[12px] text-[#8B95A1] mt-0.5 leading-snug">{char.thesis}</p>
        {char.sampleN > 0 && (
          <p className="text-[10px] text-[#B0B8C1] mt-1">
            표본 {char.sampleN.toLocaleString()}건 · {char.horizon} 기준
            {dormant ? ' · 30일 미발화(서버 재가동 예정)' : ''}
          </p>
        )}
      </div>

      <div className="text-right flex-shrink-0 w-14">
        {showAcc ? (
          <>
            <div className="text-[20px] font-extrabold leading-none" style={{ color: accColor }}>
              {char.accuracy}%
            </div>
            <div className="text-[10px] text-[#8B95A1] mt-1">적중률</div>
          </>
        ) : (
          <div className="text-[12px] text-[#B0B8C1] font-medium">수집 중</div>
        )}
      </div>
    </div>
  );
}

// status 정렬 우선순위
const STATUS_RANK = {
  [CHARACTER_STATUS.LIVE]: 0,
  [CHARACTER_STATUS.REVIVE]: 1,
  [CHARACTER_STATUS.MEASURING]: 2,
};

// ── 메인 성적표 탭 ──
export default function SignalScorecardTab() {
  const { characters, isLoading } = useSignalCharacters();

  // 로딩 가드를 정렬보다 먼저 — 로딩 중 불필요 연산·undefined 정렬 크래시 방지 (Gemini gate)
  if (isLoading) {
    return (
      <div className="py-6">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-[#F7F8FA] rounded-[10px] animate-pulse" />
          ))}
        </div>
        <p className="text-[13px] text-[#8B95A1] text-center mt-4">시그널 성적 불러오는 중...</p>
      </div>
    );
  }

  // 정렬: 라이브 → 부활 예정 → 측정 중, 동급은 적중률 내림차순
  // characters는 항상 배열(SIGNAL_CHARACTERS.map)이나 방어적으로 ?? [] 가드
  const sorted = [...(characters ?? [])].sort((a, b) => {
    const ra = STATUS_RANK[a.status] ?? 3;
    const rb = STATUS_RANK[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return (b.accuracy ?? -1) - (a.accuracy ?? -1);
  });

  return (
    <div>
      <p className="text-[11px] text-[#8B95A1] mb-2">
        공정 적중률 — 미세변동·거래비용 제외 후 측정. 못 넘는 신호는 띄우지 않습니다.
      </p>
      {sorted.map((char) => (
        <CharacterCard key={char.id} char={char} />
      ))}
    </div>
  );
}

// 외부에서 접근 가능하도록 이름 매핑 export (CommandCenterWidget 의존)
export { SIGNAL_BOT_NAMES };
