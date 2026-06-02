// 데이터 상태 배지 — 문제 발생 시에만 노출, 정상이면 null
// 사용자 언어로만 표시 (KIS/Naver/API 등 기술어 절대 노출 금지)
import { useServerSignals } from '../hooks/useServerSignals';

export default function DataHealthBadge({ dataErrors = {}, coinError = false }) {
  const serverMeta = useServerSignals();

  const issues = [];
  if (dataErrors.kr && dataErrors.us) {
    issues.push('시세 점검 중');
  } else if (dataErrors.kr) {
    issues.push('국내 시세 일부 지연');
  } else if (dataErrors.us) {
    issues.push('미국 시세 일부 지연');
  }
  if (coinError) issues.push('코인 시세 일부 지연');
  if (serverMeta.stale) issues.push('시그널 업데이트 지연 — 최신 아님');

  if (!issues.length) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFF8EC] border border-[#FFE0A0] text-[12px] text-[#996600] mb-1">
      <span>⚠️</span>
      <span>{issues.join(' · ')}</span>
    </div>
  );
}
