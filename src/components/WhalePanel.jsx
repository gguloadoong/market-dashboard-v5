// 고래 알림 패널 — Upbit WebSocket 실시간 대량 체결 감지
// 1억원 이상 단일 체결 → 고래 의심 알림, 5억원+ → HIGH
import { useState, useEffect } from 'react';
import { subscribeUpbitWhaleTrades, unsubscribeUpbitWhaleTrades } from '../api/whale';

const MAX_EVENTS = 20;

const TYPE_STYLE = {
  whale_trade: { icon: '🐋', label: '대량 체결' },
  price_surge: { icon: '🚀', label: '급등'     },
  price_crash: { icon: '💣', label: '급락'     },
  volume_spike:{ icon: '📊', label: '거래 급증' },
};

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
  const t   = TYPE_STYLE[event.type] || { icon: '⚡', label: '이벤트' };
  const isHigh = event.severity === 'high';

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 border-b border-[#F2F4F6] last:border-0 ${isHigh ? 'bg-[#FFF8F0]' : ''}`}>
      <span className="text-[16px] flex-shrink-0 mt-0.5">{t.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[12px] font-bold text-[#191F28]">{event.symbol}</span>
          {isHigh && (
            <span className="text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] px-1 py-0.5 rounded">HIGH</span>
          )}
          <span className="text-[10px] text-[#B0B8C1] ml-auto flex-shrink-0">{timeStr(event.timestamp)}</span>
        </div>
        <div className="text-[12px] text-[#6B7684] leading-snug">{event.message}</div>
        {event.tradeAmt && (
          <div className="text-[11px] font-bold text-[#FF9500] mt-0.5 font-mono">
            ₩{fmtAmt(event.tradeAmt)} · {event.side}
          </div>
        )}
      </div>
    </div>
  );
}

// 감시할 코인 심볼 목록
const WATCH_SYMBOLS = [
  'BTC','ETH','XRP','SOL','ADA','DOGE','AVAX','DOT','LINK','UNI',
  'NEAR','APT','ARB','SUI','OP','PEPE','XLM','TON','ATOM','INJ',
];

export default function WhalePanel({ isVisible = true }) {
  const [events,    setEvents]    = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    setConnected(false);
    subscribeUpbitWhaleTrades(WATCH_SYMBOLS, (evt) => {
      if (evt._connected) {
        setConnected(true);
        return;
      }
      setConnected(true);
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
        <div className="flex items-center gap-1 ml-auto">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
          <span className="text-[10px] text-[#B0B8C1]">
            {connected ? 'Upbit 실시간' : '연결 중...'}
          </span>
        </div>
      </div>

      {/* 이벤트 목록 */}
      <div className="max-h-[280px] overflow-y-auto">
        {events.length === 0 && (
          <div className="px-4 py-6 text-center">
            <div className="text-[13px] text-[#B0B8C1] mb-1">
              {connected ? '1억원 이상 단일 체결 감지 중...' : 'Upbit 연결 중...'}
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
        <span className="text-[10px] text-[#C9CDD2]">Upbit 1억원+ 단일 체결 기준 · 5억원+ 시 HIGH 표시</span>
      </div>
    </div>
  );
}
