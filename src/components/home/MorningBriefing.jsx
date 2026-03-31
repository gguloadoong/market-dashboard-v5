// 모닝 브리핑 위젯 — /api/morning-briefing 데이터를 카드로 표시
// 닫기 버튼 → localStorage에 오늘 날짜 저장 → 같은 날 재표시 안 함
import { useState, useEffect } from 'react';

const DISMISS_KEY = 'morning-briefing-dismissed';

// 변동률 색상
function changeColor(v) {
  if (v > 0) return '#F04452';
  if (v < 0) return '#1764ED';
  return '#8B95A1';
}

// 변동률 텍스트
function changeFmt(v) {
  if (v == null) return '';
  if (v > 0) return `+${v}%`;
  if (v < 0) return `${v}%`;
  return '보합';
}

// F&G 라벨 색상
function fgColor(value) {
  if (value == null) return '#8B95A1';
  if (value <= 25) return '#F04452';
  if (value <= 45) return '#FF6B00';
  if (value <= 55) return '#8B95A1';
  if (value <= 75) return '#2AC769';
  return '#2AC769';
}

export default function MorningBriefing() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDismiss = () => {
    const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    localStorage.setItem(DISMISS_KEY, kstToday);
    setDismissed(true);
  };

  if (loading || dismissed || !data) return null;

  const { markets, fearGreed, summary, date } = data;
  // 날짜 포맷 (MM/DD)
  const dateLabel = date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : '';

  return (
    <div className="bg-gradient-to-br from-[#FFF9E6] to-[#FFFDF5] rounded-2xl border border-[#F5E6B8] shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">☀️</span>
          <span className="text-[13px] font-bold text-[#191F28]">오늘의 마켓 브리핑</span>
          {dateLabel && <span className="text-[11px] text-[#B0B8C1]">{dateLabel}</span>}
        </div>
        <button
          onClick={handleDismiss}
          className="text-[#B0B8C1] hover:text-[#4E5968] transition-colors p-1"
          title="브리핑 닫기"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* 시장 지수 */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {markets?.kospi && (
            <span className="font-medium text-[#191F28]">
              코스피 <span className="font-mono tabular-nums">{markets.kospi.close?.toLocaleString()}</span>
              {' '}<span style={{ color: changeColor(markets.kospi.change) }} className="font-mono tabular-nums">{changeFmt(markets.kospi.change)}</span>
            </span>
          )}
          {markets?.nasdaq && (
            <span className="font-medium text-[#191F28]">
              나스닥 <span className="font-mono tabular-nums">{markets.nasdaq.close?.toLocaleString()}</span>
              {' '}<span style={{ color: changeColor(markets.nasdaq.change) }} className="font-mono tabular-nums">{changeFmt(markets.nasdaq.change)}</span>
            </span>
          )}
          {markets?.btc && (
            <span className="font-medium text-[#191F28]">
              BTC <span className="font-mono tabular-nums">${markets.btc.price?.toLocaleString()}</span>
              {' '}<span style={{ color: changeColor(markets.btc.change) }} className="font-mono tabular-nums">{changeFmt(markets.btc.change)}</span>
            </span>
          )}
        </div>
      </div>

      {/* 구분선 */}
      <div className="mx-4 border-t border-[#F0E4C0]" />

      {/* 요약 */}
      {summary && (
        <div className="px-4 py-2">
          <p className="text-[11px] text-[#4E5968] leading-relaxed">{summary}</p>
        </div>
      )}

      {/* F&G 지수 */}
      {(fearGreed?.us || fearGreed?.crypto) && (
        <div className="px-4 pb-3">
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
      )}
    </div>
  );
}
