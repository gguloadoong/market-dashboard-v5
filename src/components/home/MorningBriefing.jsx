// 모닝 브리핑 위젯 — /api/morning-briefing 데이터를 카드로 표시
// 닫기 버튼 → localStorage에 오늘 날짜 저장 → 같은 날 재표시 안 함
import { useState, useEffect } from 'react';
import { useTopSignals } from '../../hooks/useSignals';
import { showBriefingNotification, requestNotificationPermission } from '../../utils/briefingNotification';

const DISMISS_KEY = 'morning-briefing-dismissed';

// F&G 라벨 색상
function fgColor(value) {
  if (value == null) return '#8B95A1';
  if (value <= 25) return '#F04452';
  if (value <= 45) return '#FF6B00';
  if (value <= 55) return '#8B95A1';
  if (value <= 75) return '#2AC769';
  return '#2AC769';
}

// 방향 색상 — SignalSummaryWidget 기준으로 통일 (금융 표준: 강세=초록, 약세=빨강)
function directionColor(direction) {
  if (direction === 'bullish') return '#2AC769';
  if (direction === 'bearish') return '#F04452';
  return '#FF9500';
}

export default function MorningBriefing() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const topSignals = useTopSignals(3);

  useEffect(() => {
    // 오늘 이미 닫았는지 확인
    const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored === kstToday) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    fetch('/api/morning-briefing')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && !d.error) setData(d);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (
      data &&
      !localStorage.getItem(`briefing_notified_${data.date}`)
    ) {
      showBriefingNotification(data);
      localStorage.setItem(`briefing_notified_${data.date}`, '1');
    }
  }, [data]);

  const handleDismiss = () => {
    const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    localStorage.setItem(DISMISS_KEY, kstToday);
    setDismissed(true);
  };

  if (loading || dismissed || !data) return null;

  const { fearGreed, summary, date } = data;
  const dateLabel = date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : '';

  // 실제 API 데이터: 시그널 + F&G + 한 줄 요약 (지수 중복 제거)
  return (
    <div className="bg-gradient-to-br from-[#FFF9E6] to-[#FFFDF5] rounded-2xl border border-[#F5E6B8] shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">☀️</span>
          <span className="text-[13px] font-bold text-[#191F28]">오늘의 마켓 브리핑</span>
          {dateLabel && <span className="text-[11px] text-[#B0B8C1]">{dateLabel}</span>}
        </div>
        <div className="flex items-center gap-2">
          {Notification?.permission === 'default' && (
            <button onClick={async () => { await requestNotificationPermission(); }}
              className="text-[10px] text-[#3182F6] font-medium">
              🔔 알림 받기
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="text-[#B0B8C1] hover:text-[#4E5968] transition-colors p-1"
            title="브리핑 닫기"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {/* 시그널 엔진 상위 시그널 */}
      {topSignals.length > 0 && (
        <>
          <div className="mx-4 border-t border-[#F0E4C0]" />
          <div className="px-4 pb-2 pt-2">
            <span className="text-[10px] font-bold text-[#B0986E] uppercase mb-1.5 block">시그널</span>
            <div className="space-y-1">
              {topSignals.map(sig => (
                <div key={sig.id} className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-[#191F28]">{sig.symbol}</span>
                  <span className="text-[#8B95A1] truncate flex-1">{sig.label || sig.type}</span>
                  <span className="font-mono tabular-nums" style={{ color: directionColor(sig.direction) }}>
                    {sig.direction === 'bullish' ? '▲' : sig.direction === 'bearish' ? '▼' : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* F&G 지수 */}
      {(fearGreed?.us || fearGreed?.crypto) && (
        <>
          <div className="mx-4 border-t border-[#F0E4C0]" />
          <div className="px-4 py-2">
            <div className="flex gap-3 text-[11px]">
              {fearGreed.us && (
                <span className="text-[#8B95A1]">
                  F&G US{' '}
                  <span className="font-bold font-mono" style={{ color: fgColor(fearGreed.us.value) }}>
                    {fearGreed.us.value}
                  </span>
                  <span className="text-[10px]">({fearGreed.us.label})</span>
                </span>
              )}
              {fearGreed.crypto && (
                <span className="text-[#8B95A1]">
                  Crypto{' '}
                  <span className="font-bold font-mono" style={{ color: fgColor(fearGreed.crypto.value) }}>
                    {fearGreed.crypto.value}
                  </span>
                  <span className="text-[10px]">({fearGreed.crypto.label})</span>
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* 한 줄 요약 */}
      {summary && (
        <>
          <div className="mx-4 border-t border-[#F0E4C0]" />
          <div className="px-4 py-2 pb-3">
            <p className="text-[11px] text-[#4E5968] leading-relaxed">{summary}</p>
          </div>
        </>
      )}
    </div>
  );
}
