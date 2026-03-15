// 고래 알림 패널 — Upbit WebSocket 실시간 대량 체결 감지
// 5000만원 이상 단일 체결 → 표시, 5억원+ → HIGH
import { useState, useEffect, useRef } from 'react';
import { subscribeUpbitWhaleTrades, unsubscribeUpbitWhaleTrades } from '../api/whale';

const MAX_EVENTS = 20;

function fmtAmt(n) {
  if (n >= 1e12) return `${(n/1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n/1e8).toFixed(1)}억`;
  if (n >= 1e4)  return `${(n/1e4).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function EventRow({ event }) {
  const isHigh = event.severity === 'high';
  const sideBg = event.side === '매수' ? '#FFF0F1' : '#F0F4FF';
  const sideColor = event.side === '매수' ? '#F04452' : '#1764ED';

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 border-b border-[#F2F4F6] last:border-0 ${isHigh ? 'bg-[#FFFBF0]' : ''}`}>
      <span className="text-[15px] flex-shrink-0 mt-0.5">🐋</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[12px] font-bold text-[#191F28]">{event.symbol}</span>
          {isHigh && (
            <span className="text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] px-1.5 py-0.5 rounded">🔥 HIGH</span>
          )}
          <span className="text-[10px] text-[#B0B8C1] ml-auto flex-shrink-0">{timeStr(event.timestamp)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[12px] font-bold font-mono" style={{ color: sideColor }}>
            ₩{fmtAmt(event.tradeAmt)}
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: sideBg, color: sideColor }}
          >
            {event.side}
          </span>
          <span className="text-[11px] text-[#B0B8C1] font-mono">{event.symbol} {event.volume % 1 === 0 ? event.volume : Number(event.volume).toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
}

// 감시할 코인 심볼 목록 (Upbit KRW 마켓)
const WATCH_SYMBOLS = [
  'BTC','ETH','XRP','SOL','ADA','DOGE','AVAX','DOT','LINK','UNI',
  'NEAR','APT','ARB','SUI','OP','PEPE','XLM','TON','ATOM','INJ',
];

export default function WhalePanel({ isVisible = true }) {
  const [events,    setEvents]    = useState([]);
  const [connected, setConnected] = useState(false);
  const [msgCount,  setMsgCount]  = useState(0); // WS 수신 전체 체결 수 (임계값 미만 포함)

  useEffect(() => {
    if (!isVisible) return;

    setConnected(false);
    setMsgCount(0);

    subscribeUpbitWhaleTrades(WATCH_SYMBOLS, (evt) => {
      if (evt._connected) { setConnected(true); return; }
      if (evt._tick)      { setConnected(true); setMsgCount(p => p + 1); return; }
      setConnected(true);
      setMsgCount(p => p + 1);
      setEvents(prev => [evt, ...prev].slice(0, MAX_EVENTS));
    });

    return () => {
      unsubscribeUpbitWhaleTrades();
      setConnected(false);
    };
  }, [isVisible]);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[15px]">🐋</span>
        <span className="text-[14px] font-bold text-[#191F28]">고래 알림</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
          <span className="text-[10px] text-[#B0B8C1]">
            {connected ? 'Upbit 실시간' : '연결 중...'}
          </span>
          {connected && msgCount > 0 && (
            <span className="text-[10px] text-[#C9CDD2] font-mono">수신 {msgCount.toLocaleString()}건</span>
          )}
        </div>
      </div>

      {/* 이벤트 목록 */}
      <div className="max-h-[280px] overflow-y-auto">
        {events.length === 0 && (
          <div className="px-4 py-6 text-center">
            <div className="text-[13px] text-[#B0B8C1] mb-1">
              {connected
                ? `5,000만원+ 단일 체결 감지 중... (${msgCount}건 수신)`
                : 'Upbit WebSocket 연결 중...'}
            </div>
            <div className="text-[11px] text-[#C9CDD2]">대량 매매 발생 시 즉시 표시됩니다</div>
          </div>
        )}
        {events.map((evt, i) => (
          <EventRow key={`${evt.symbol}-${evt.timestamp}-${i}`} event={evt} />
        ))}
      </div>

      {/* 안내 */}
      <div className="px-4 py-2 border-t border-[#F2F4F6] bg-[#FAFBFC]">
        <span className="text-[10px] text-[#C9CDD2]">Upbit 5천만원+ 단일 체결 · 5억원+ 시 🔥HIGH · 자동 재연결</span>
      </div>
    </div>
  );
}
