// 경제 이벤트 티커 — 다가오는 이벤트 롤링 표시
// 클릭 시 전체 캘린더 모달 오픈
import { useState, useEffect, useMemo } from 'react';

// 2026년 주요 경제 이벤트 (향후 API 전환 가능)
const EVENTS_2026 = [
  { date: '2026-03-18', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-03-27', type: 'PCE',  label: 'PCE 물가지수', importance: 'medium' },
  { date: '2026-04-03', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-04-10', type: 'CPI',  label: 'CPI 발표 (3월)', importance: 'high' },
  { date: '2026-04-16', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
  { date: '2026-04-29', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-04-29', type: 'GDP',  label: 'GDP 1차 발표 (Q1)', importance: 'medium' },
  { date: '2026-04-30', type: 'PCE',  label: 'PCE 물가지수', importance: 'medium' },
  { date: '2026-05-01', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-05-13', type: 'CPI',  label: 'CPI 발표 (4월)', importance: 'high' },
  { date: '2026-05-28', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
  { date: '2026-05-29', type: 'PCE',  label: 'PCE 물가지수', importance: 'medium' },
  { date: '2026-06-05', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-06-10', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-06-10', type: 'CPI',  label: 'CPI 발표 (5월)', importance: 'high' },
  { date: '2026-07-02', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-07-15', type: 'CPI',  label: 'CPI 발표 (6월)', importance: 'high' },
  { date: '2026-07-16', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
  { date: '2026-07-29', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-07-30', type: 'GDP',  label: 'GDP 1차 발표 (Q2)', importance: 'medium' },
  { date: '2026-08-12', type: 'CPI',  label: 'CPI 발표 (7월)', importance: 'high' },
  { date: '2026-08-27', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
  { date: '2026-09-10', type: 'CPI',  label: 'CPI 발표 (8월)', importance: 'high' },
  { date: '2026-09-16', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-10-14', type: 'CPI',  label: 'CPI 발표 (9월)', importance: 'high' },
  { date: '2026-10-28', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-11-11', type: 'CPI',  label: 'CPI 발표 (10월)', importance: 'high' },
  { date: '2026-12-09', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-12-09', type: 'CPI',  label: 'CPI 발표 (11월)', importance: 'high' },
];

const TYPE_CONFIG = {
  FOMC:  { color: '#F04452', bg: '#FFF0F0', emoji: '🏦' },
  CPI:   { color: '#3182F6', bg: '#EDF4FF', emoji: '📊' },
  NFP:   { color: '#FF9500', bg: '#FFF4E6', emoji: '👷' },
  PCE:   { color: '#8B5CF6', bg: '#F5F0FF', emoji: '💳' },
  GDP:   { color: '#2AC769', bg: '#F0FFF6', emoji: '📈' },
  금통위: { color: '#F04452', bg: '#FFF0F0', emoji: '🏛' },
};

function dday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  const now = new Date();
  const diff = Math.ceil((d - now) / (24 * 60 * 60 * 1000));
  if (diff === 0) return { text: 'D-DAY', urgent: true };
  if (diff === 1) return { text: 'D-1', urgent: true };
  if (diff <= 3) return { text: `D-${diff}`, urgent: true };
  if (diff <= 7) return { text: `D-${diff}`, urgent: false };
  return { text: `D-${diff}`, urgent: false };
}

function FullCalendarModal({ events, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-[10vh] left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
          <span className="text-[14px] font-bold text-[#191F28]">경제 이벤트 캘린더</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F2F4F6] text-[#6B7684] text-[18px]">×</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {events.map((ev, i) => {
            const cfg = TYPE_CONFIG[ev.type] || { color: '#8B95A1', bg: '#F2F4F6', emoji: '📅' };
            const dd = dday(ev.date);
            const d = new Date(ev.date);
            const dateLabel = `${d.getMonth()+1}/${d.getDate()} (${['일','월','화','수','목','금','토'][d.getDay()]})`;
            return (
              <div key={`${ev.date}-${ev.type}-${i}`}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[#F2F4F6] last:border-0 ${dd.urgent ? 'bg-[#FFF8F0]' : ''}`}>
                <span className="text-[16px] flex-shrink-0">{cfg.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded mr-1.5"
                    style={{ background: cfg.bg, color: cfg.color }}>{ev.type}</span>
                  <span className="text-[13px] font-medium text-[#191F28]">{ev.label}</span>
                  <div className="text-[11px] text-[#8B95A1] mt-0.5">{dateLabel}</div>
                </div>
                <span className={`text-[12px] font-bold tabular-nums flex-shrink-0 ${dd.urgent ? 'text-[#F04452]' : 'text-[#8B95A1]'}`}>
                  {dd.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function EventTicker() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // 향후 30일 이내 이벤트
  const upcoming = useMemo(() => {
    const now = new Date();
    const limit = new Date(now.getTime() + 30 * 86400000);
    return EVENTS_2026
      .filter(e => { const d = new Date(e.date); return d >= now && d <= limit; })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, []);

  // 3초마다 롤링
  useEffect(() => {
    if (upcoming.length <= 1) return;
    const id = setInterval(() => setActiveIdx(i => (i + 1) % upcoming.length), 3000);
    return () => clearInterval(id);
  }, [upcoming.length]);

  if (!upcoming.length) return null;

  const ev = upcoming[activeIdx % upcoming.length];
  const cfg = TYPE_CONFIG[ev.type] || { color: '#8B95A1', bg: '#F2F4F6', emoji: '📅' };
  const dd = dday(ev.date);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-[#F2F4F6] shadow-sm hover:bg-[#FAFBFC] transition-colors"
      >
        <span className="text-[14px] flex-shrink-0">{cfg.emoji}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.color }}>{ev.type}</span>
        <span className="text-[12px] font-medium text-[#191F28] truncate">{ev.label}</span>
        <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ml-auto ${dd.urgent ? 'text-[#F04452]' : 'text-[#8B95A1]'}`}>
          {dd.text}
        </span>
        {upcoming.length > 1 && (
          <span className="text-[10px] text-[#C9CDD2] flex-shrink-0">
            +{upcoming.length - 1}
          </span>
        )}
      </button>

      {modalOpen && <FullCalendarModal events={upcoming} onClose={() => setModalOpen(false)} />}
    </>
  );
}
