// 고래 알림 패널 — 멀티소스 실시간 대량 체결 감지
// 소스 1: Upbit WebSocket (2000만원+ 단일 체결)
// 소스 2: Blockchain.com WebSocket (10 BTC+ 온체인 이동)
// 소스 3: Whale Alert REST 폴링 (Vercel 프록시, 60초 간격)
import { useState, useEffect, useRef } from 'react';
import {
  subscribeUpbitWhaleTrades,
  unsubscribeUpbitWhaleTrades,
  subscribeBtcWhales,
  unsubscribeBtcWhales,
  startWhaleAlertPolling,
  stopWhaleAlertPolling,
} from '../api/whale';
import { pushWhaleEvent } from '../state/whaleBus';

const MAX_EVENTS = 30;

function fmtAmt(n) {
  if (n >= 1e12) return `${(n/1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n/1e8).toFixed(1)}억`;
  if (n >= 1e4)  return `${(n/1e4).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// 고래 이벤트 의미를 설명하는 한 줄 인사이트 텍스트 반환
function getWhaleInsight(event) {
  const amt = event.tradeAmt || 0;
  const side = event.side;
  const isOnchain = event.chain === 'bitcoin' || event.source === 'whale-alert';

  if (isOnchain) {
    if (amt >= 5e9) return '거래소 대규모 입금 — 매도 압력 가능성';
    if (amt >= 1e9) return '고래 자산 이동 — 방향성 주시';
    return '대형 지갑 자산 이동 감지';
  }
  if (side === '매수') {
    if (amt >= 5e8) return '기관/대형 투자자 대량 매수 — 단기 급등 주의';
    if (amt >= 1e8) return '세력 유입 의심 — 모멘텀 확인 필요';
    return '대량 단일 체결 — 방향성 주시';
  }
  if (side === '매도') {
    if (amt >= 5e8) return '대규모 매도 출현 — 하락 압력 주의';
    if (amt >= 1e8) return '고래 차익실현 가능성 — 추격매수 주의';
    return '대량 단일 체결 — 방향성 주시';
  }
  return '대량 거래 감지';
}

function EventRow({ event }) {
  const isHigh = event.severity === 'high';

  // 체인/소스 배지 결정
  const chainBadge = event.source === 'whale-alert'
    ? { bg: '#F0F4FF', color: '#3182F6', text: event.chain?.toUpperCase() || 'CHAIN' }
    : event.chain === 'bitcoin'
    ? { bg: '#FFF4E6', color: '#FF9500', text: 'BTC 온체인' }
    : { bg: '#F2F4F6', color: '#6B7684', text: 'UPBIT' };

  // 매수/매도/온체인 색상
  const sideBg    = event.side === '매수' ? '#FFF0F1' : event.side === '매도' ? '#F0F4FF' : '#F3FFF3';
  const sideColor = event.side === '매수' ? '#F04452' : event.side === '매도' ? '#1764ED' : '#2AC769';

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 border-b border-[#F2F4F6] last:border-0 ${isHigh ? 'bg-[#FFFBF0]' : ''}`}>
      <span className="text-[15px] flex-shrink-0 mt-0.5">🐋</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[12px] font-bold text-[#191F28]">{event.symbol}</span>
          {/* 체인/소스 배지 */}
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: chainBadge.bg, color: chainBadge.color }}
          >
            {chainBadge.text}
          </span>
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
          <span className="text-[11px] text-[#B0B8C1] font-mono">
            {event.symbol} {Number(event.volume) % 1 === 0 ? event.volume : Number(event.volume).toFixed(3)}
          </span>
        </div>
        {/* Whale Alert 출처: from → to 레이블 표시 */}
        {event.label && event.label !== '온체인 이동' && (
          <div className="text-[10px] text-[#B0B8C1] mt-0.5 truncate">{event.label}</div>
        )}
        {/* 이벤트 의미 인사이트 */}
        <div className="text-[10px] text-[#8B95A1] mt-0.5 italic">
          {getWhaleInsight(event)}
        </div>
      </div>
    </div>
  );
}

// Upbit KRW 마켓 감시 종목 목록
const WATCH_SYMBOLS = [
  'BTC','ETH','XRP','SOL','ADA','DOGE','AVAX','DOT','LINK','UNI',
  'NEAR','APT','ARB','SUI','OP','PEPE','XLM','TON','ATOM','INJ',
];

export default function WhalePanel({ isVisible = true }) {
  const [events,       setEvents]       = useState([]);
  const [connected,    setConnected]    = useState(false);
  const [btcConnected, setBtcConnected] = useState(false);
  const [msgCount,     setMsgCount]     = useState(0); // WS 수신 전체 체결 수

  // 이벤트 추가 헬퍼 (MAX_EVENTS 제한 + 버스 발행)
  const addEvent = (evt) => {
    pushWhaleEvent(evt);
    setEvents(prev => [evt, ...prev].slice(0, MAX_EVENTS));
  };

  useEffect(() => {
    if (!isVisible) return;

    setConnected(false);
    setBtcConnected(false);
    setMsgCount(0);

    // ── 소스 1: Upbit WebSocket ─────────────────────────────────
    subscribeUpbitWhaleTrades(WATCH_SYMBOLS, (evt) => {
      if (evt._connected) { setConnected(true); return; }
      if (evt._tick)      { setConnected(true); setMsgCount(p => p + 1); return; }
      setConnected(true);
      setMsgCount(p => p + 1);
      addEvent(evt);
    });

    // ── 소스 2: Blockchain.com BTC 온체인 WebSocket ─────────────
    subscribeBtcWhales((evt) => {
      if (evt._connected) { setBtcConnected(true); return; }
      setBtcConnected(true);
      addEvent(evt);
    });

    // ── 소스 3: Whale Alert REST 폴링 (프록시 없으면 무시) ───────
    startWhaleAlertPolling((evt) => {
      addEvent(evt);
    });

    return () => {
      unsubscribeUpbitWhaleTrades();
      unsubscribeBtcWhales();
      stopWhaleAlertPolling();
      setConnected(false);
      setBtcConnected(false);
    };
  }, [isVisible]);

  // 연결 상태 텍스트
  const connStatus = connected && btcConnected
    ? 'Upbit + BTC 온체인'
    : connected
    ? 'Upbit 실시간'
    : btcConnected
    ? 'BTC 온체인'
    : '연결 중...';

  const isAnyConnected = connected || btcConnected;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[15px]">🐋</span>
        <span className="text-[14px] font-bold text-[#191F28]">고래 알림</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAnyConnected ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
          <span className="text-[10px] text-[#B0B8C1]">{connStatus}</span>
          {connected && msgCount > 0 && (
            <span className="text-[10px] text-[#C9CDD2] font-mono">수신 {msgCount.toLocaleString()}건</span>
          )}
        </div>
      </div>

      {/* 이벤트 목록 */}
      <div className="max-h-[320px] overflow-y-auto">
        {events.length === 0 && (
          <div className="px-4 py-6 text-center">
            <div className="text-[13px] text-[#B0B8C1] mb-1">
              {isAnyConnected
                ? `2,000만원+ 단일 체결 / 10 BTC+ 온체인 감지 중...`
                : '웹소켓 연결 중...'}
            </div>
            <div className="text-[11px] text-[#C9CDD2]">대량 매매 발생 시 즉시 표시됩니다</div>
          </div>
        )}
        {events.map((evt, i) => (
          <EventRow key={`${evt.id || evt.symbol}-${evt.timestamp}-${i}`} event={evt} />
        ))}
      </div>

      {/* 안내 */}
      <div className="px-4 py-2 border-t border-[#F2F4F6] bg-[#FAFBFC]">
        <span className="text-[10px] text-[#C9CDD2]">
          Upbit 2천만원+ · BTC 온체인 10BTC+ · Whale Alert REST · 1억원+ 시 🔥HIGH
        </span>
      </div>
    </div>
  );
}
