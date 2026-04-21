// OpsStatusBadge.jsx — 헤더 우측 크론 상태 뱃지 (#164 Phase B)
// 기본 비노출. localStorage opsMode=true 일 때만 표시 — 내부 운영용.
// 30초마다 /api/ops/cron-status 폴링.
import { useEffect, useState } from 'react';
import { useCronStatus } from '../hooks/useCronStatus';

export default function OpsStatusBadge() {
  const [visible, setVisible] = useState(false);

  // localStorage 읽기 — SSR 안전
  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem('opsMode') === 'true');
    } catch { /* 무시 */ }
  }, []);

  const { status, unhealthyCount, unhealthyNames } = useCronStatus();

  if (!visible) return null;

  const dotColor =
    status === 'ok' ? 'bg-[#2AC769]' :
    status === 'warn' ? 'bg-[#FF9500]' :
    'bg-[#C9CDD2]'; // unknown

  const label =
    status === 'ok' ? '크론 정상' :
    status === 'warn' ? `실패 ${unhealthyCount}건` :
    '상태 조회 중';

  const tooltip =
    status === 'warn'
      ? `${unhealthyNames.join(', ')} (최근 1h)`
      : label;

  return (
    <span
      className="flex items-center gap-1.5 text-[12px] text-[#8B95A1]"
      title={tooltip}
      aria-label={`크론 시스템 상태: ${label}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor} ${status === 'warn' ? 'animate-pulse' : ''}`} />
      <span className="hidden lg:inline">{label}</span>
    </span>
  );
}
