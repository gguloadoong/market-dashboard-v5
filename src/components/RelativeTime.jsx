// #380: 데이터 freshness 상대시간 표시 — 'N분 전 업데이트' (토스/네이버증권 수준 신뢰 확보)
// 격리 원칙: 자체 setInterval(20s)로 자기 자신만 리렌더. 상위 트리로 콜백/setState 전파 절대 금지
//           → 타이머가 종목 리스트·상위 트리 리렌더를 유발하지 않음. asOf 동일 시 memo로 억제.
import { useState, useEffect, memo } from 'react';

// epoch ms → 한국어 상대시간 문자열
function formatRelative(asOf, now) {
  if (asOf == null) return '';
  const diffMs = now - asOf;
  // 음수(서버-클라 시계 오차) 또는 10초 미만 → '방금'
  if (diffMs < 10_000) return '방금 업데이트';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}초 전 업데이트`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전 업데이트`;
  const hr = Math.floor(min / 60);
  return `${hr}시간 전 업데이트`;
}

// props: asOf(epoch ms 또는 null), prefix(옵션 — 라벨 앞 텍스트)
const RelativeTime = memo(function RelativeTime({ asOf, prefix = '' }) {
  // now만 자체 상태로 갱신 — 상위로 전파하지 않음
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // asOf 없으면 타이머 불필요
    if (asOf == null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, [asOf]);

  // asOf null이면 빈 표시 (graceful — 렌더 자체를 생략)
  if (asOf == null) return null;

  const label = formatRelative(asOf, now);
  if (!label) return null;

  return (
    <span className="text-[12px] text-[#B0B8C1] tabular-nums">
      {prefix}{label}
    </span>
  );
});

export default RelativeTime;
