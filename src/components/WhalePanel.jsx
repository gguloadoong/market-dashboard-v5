// 고래 알림 패널 — 온체인 자금 이동 전용
// 소스: Blockchain.com BTC WS + Whale Alert REST + Blockchair 폴링
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  subscribeBtcWhales,
  unsubscribeBtcWhales,
  startWhaleAlertPolling,
  stopWhaleAlertPolling,
} from '../api/whale';
import { fetchWhaleChain } from '../api/_gateway';
import EtfFlowWidget from './home/widgets/EtfFlowWidget';
import { pushWhaleEvent } from '../state/whaleBus';
import { detectWhalePatterns } from '../engine/whalePattern';
import { createSignal, addSignal } from '../engine/signalEngine';
import { SIGNAL_TYPES, STABLECOIN_SYMBOLS } from '../engine/signalTypes';
import { DEFAULT_KRW_RATE } from '../constants/market';

// 패턴 스캔 주기 (60초)
const PATTERN_SCAN_INTERVAL_MS = 60 * 1000;

const MAX_EVENTS = 30;

// ─── 알려진 거래소 이름 한국어 매핑 ────────────────────────────
const EXCHANGE_NAME_MAP = {
  binance:    '바이낸스',
  coinbase:   '코인베이스',
  kraken:     '크라켄',
  bitfinex:   '비트파이낸스',
  okx:        'OKX',
  okex:       'OKX',
  upbit:      '업비트',
  bithumb:    '빗썸',
  bybit:      '바이빗',
  huobi:      '후오비',
  kucoin:     '쿠코인',
  gate:       '게이트',
  'gate.io':  '게이트',
  bitstamp:   '비트스탬프',
  gemini:     '제미나이',
  ftx:        'FTX',
  bitget:     '비트겟',
  mexc:       'MEXC',
  cryptocom:  '크립토닷컴',
};

// 거래소명 원시 문자열에서 한국어 이름 추출
function resolveExchangeName(raw) {
  if (!raw || raw === 'unknown') return null;
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(EXCHANGE_NAME_MAP)) {
    if (lower.includes(key)) return val;
  }
  // 원본 문자열 그대로 (첫 글자 대문자)
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ─── 이동 패턴 설명 (카드 제목 수준 한 줄 요약) ─────────────────
// "바이낸스 → 콜드월렛 (HODLing 신호)" 형식으로 생성
function buildRouteTitle(event) {
  const from = resolveExchangeName(event.fromOwner) || event.fromOwner || null;
  const to   = resolveExchangeName(event.toOwner)   || event.toOwner   || null;

  if (event.source === 'bithumb') {
    return `빗썸 ${event.symbol || ''} ${event.side || '체결'}`;
  }
  if (event.source === 'binance') {
    return `바이낸스 ${event.symbol || ''} ${event.side || '체결'} ${event.tradeUsd ? `$${(event.tradeUsd / 1e6).toFixed(1)}M` : ''}`;
  }
  if (event.source !== 'whale-alert' && event.source !== 'blockchair') {
    // Upbit 체결: 거래소명 없음 — 종목 + 매수/매도 방향 표시
    return `업비트 ${event.symbol || ''} ${event.side || '체결'}`;
  }

  switch (event.movementType) {
    case 'exchange_withdrawal':
      return `${from || '거래소'} → 개인 지갑 (HODLing 신호)`;
    case 'exchange_deposit':
      return `개인 지갑 → ${to || '거래소'} (매도 압력)`;
    case 'exchange_to_exchange':
      return `${from || '거래소'} → ${to || '거래소'} (거래소 간 이동)`;
    case 'wallet_to_wallet':
      return `지갑 → 지갑 (OTC 또는 내부 이동)`;
    default:
      if (from && to) return `${from} → ${to}`;
      if (from)       return `${from} → 지갑`;
      if (to)         return `지갑 → ${to}`;
      return '거래소 이동';
  }
}

// ─── 스테이블코인 판별 ────────────────────────────────────────────
function isStablecoin(symbol) {
  return STABLECOIN_SYMBOLS.has((symbol || '').toUpperCase());
}

// ─── 이벤트 규모 등급 판별 (금액 기반 3단계) ─────────────────────
// 'normal' | 'notable'(주요) | 'major'(대형)
function getEventGrade(event) {
  const amt = event.tradeAmt || 0;
  const usd = event.tradeUsd || 0;
  if (amt >= 5_000_000_000 || usd >= 3_500_000) return 'major';   // 대형: 50억원+ / $3.5M+
  if (amt >= 1_000_000_000 || usd >= 700_000)   return 'notable'; // 주요: 10억원+ / $700K+
  return 'normal'; // 일반
}

// ─── 이동 패턴별 배지 스타일 ────────────────────────────────────
function getMovementBadge(movementType, side, symbol) {
  const stable = isStablecoin(symbol);

  // 스테이블코인 특수 로직: 입금/출금 방향성 반전
  if (stable && movementType === 'exchange_deposit') {
    // 스테이블코인 거래소 입금 = 매수 대기 자금 유입 (bullish)
    return {
      emoji: '💵',
      label: '매수 대기 자금 유입',
      bg: '#F0FFF6',
      border: '#C6F6D5',
      color: '#2AC769',
    };
  }
  if (stable && movementType === 'exchange_withdrawal') {
    // 스테이블코인 거래소 출금 = 자금 이탈 (bearish)
    return {
      emoji: '💵',
      label: '자금 이탈',
      bg: '#FFF0F1',
      border: '#FFD0D4',
      color: '#F04452',
    };
  }

  // Whale Alert 온체인 이벤트 (movementType 있음)
  if (movementType === 'exchange_deposit') {
    return {
      emoji: '🔴',
      label: '매도 압력',
      bg: '#FFF0F1',
      border: '#FFD0D4',
      color: '#F04452',
    };
  }
  if (movementType === 'exchange_withdrawal') {
    return {
      emoji: '🟢',
      label: 'HODLing',
      bg: '#F0FFF6',
      border: '#C6F6D5',
      color: '#2AC769',
    };
  }
  if (movementType === 'exchange_to_exchange') {
    return {
      emoji: '🟡',
      label: '차익거래?',
      bg: '#FFFBEB',
      border: '#FDE68A',
      color: '#CC8800',
    };
  }
  if (movementType === 'wallet_to_wallet') {
    return {
      emoji: '⚪',
      label: 'OTC 가능성',
      bg: '#F2F4F6',
      border: '#E2E8F0',
      color: '#6B7684',
    };
  }
  // BTC 온체인 (movementType 없음, chain=bitcoin)
  if (side === '온체인') {
    return {
      emoji: '⚡',
      label: '온체인 이동',
      bg: '#FFF4E6',
      border: '#FFD8A8',
      color: '#FF9500',
    };
  }
  // Upbit 매수
  if (side === '매수') {
    return {
      emoji: '🟢',
      label: '매수',
      bg: '#F0FFF6',
      border: '#C6F6D5',
      color: '#2AC769',
    };
  }
  // Upbit 매도
  return {
    emoji: '🔴',
    label: '매도',
    bg: '#FFF0F1',
    border: '#FFD0D4',
    color: '#F04452',
  };
}

// ─── 금액 포맷 (한국어 + 달러 병기) ────────────────────────────
function fmtAmt(n) {
  if (!n || n === 0) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n / 1e8).toFixed(1)}억`;
  if (n >= 1e4)  return `${(n / 1e4).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

// USD 금액 포맷 (달러)
function fmtUsd(n) {
  if (!n || n === 0) return null;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// 수량 포맷 (소수점 처리)
function fmtVol(vol, symbol) {
  if (vol == null || isNaN(Number(vol))) return null;
  const n = Number(vol);
  const formatted = n % 1 === 0 ? n.toLocaleString('ko-KR') : n.toFixed(3);
  return `${formatted} ${symbol || ''}`;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}

// ─── 이벤트 인사이트 설명 생성 ──────────────────────────────────
function buildInsightText(event) {
  // whale.js가 이미 생성한 insight 필드 우선 사용
  if (event.insight) return event.insight;

  const sym      = event.symbol || '코인';
  const fromKo   = resolveExchangeName(event.fromOwner);
  const toKo     = resolveExchangeName(event.toOwner);
  const fromLabel = fromKo || event.fromOwner || '지갑';
  const toLabel   = toKo   || event.toOwner   || '지갑';

  // 스테이블코인 이벤트: 방향성 반전된 설명 반환
  if (isStablecoin(event.symbol)) {
    switch (event.movementType) {
      case 'exchange_deposit':
        return `💵 ${sym} 거래소 유입 — 매수 대기 자금. 상방 압력 가능성`;
      case 'exchange_withdrawal':
        return `💵 ${sym} 거래소 출금 — 자금 이탈. 매수 여력 감소 신호`;
      default:
        break;
    }
  }

  switch (event.movementType) {
    case 'exchange_deposit':
      return `${sym}을 ${toLabel}으로 이동. 매도 준비 가능성`;
    case 'exchange_withdrawal':
      return `${sym}을 ${fromLabel}에서 출금. 장기 보유 신호`;
    case 'exchange_to_exchange':
      return `${fromLabel}→${toLabel} 거래소간 이동. 차익거래 또는 포지션 이동`;
    case 'wallet_to_wallet':
      return '지갑간 이동. OTC 거래 또는 내부 이동일 수 있음';
    default:
      break;
  }

  // Upbit 체결 fallback
  const amt  = event.tradeAmt || 0;
  const side = event.side;
  if (side === '매수') {
    if (amt >= 5e8) return '기관/대형 투자자 대량 매수 — 단기 상방 압력';
    if (amt >= 1e8) return '세력 유입 의심 — 모멘텀 확인 필요';
    return '대량 단일 체결 — 방향성 주시';
  }
  if (side === '매도') {
    if (amt >= 5e8) return '대규모 차익실현 — 하락 압력 주의';
    if (amt >= 1e8) return '고래 매도 출현 — 추격매수 주의';
    return '대량 단일 체결 — 방향성 주시';
  }
  if (amt >= 5e9) return '거래소 대규모 입금 — 매도 압력 가능성';
  if (amt >= 1e9) return '고래 자산 이동 — 방향성 주시';
  return '대형 지갑 자산 이동 감지';
}

// ─── 거래소 경로 표시 (fromOwner → toOwner) ─────────────────────
function _buildRouteLabel(event) {
  if (event.source !== 'whale-alert') {
    // Upbit 체결은 거래소 이름 표시 없음
    return null;
  }
  const from = resolveExchangeName(event.fromOwner) || event.fromOwner || '지갑';
  const to   = resolveExchangeName(event.toOwner)   || event.toOwner   || '지갑';
  if (!from && !to) return null;
  return `${from} → ${to}`;
}

// ─── 이벤트 카드 컴포넌트 ────────────────────────────────────────
function EventRow({ event, onItemClick, coinMap }) {
  const isHigh      = event.severity === 'high';
  const badge       = getMovementBadge(event.movementType, event.side, event.symbol);
  const grade       = getEventGrade(event); // 'normal' | 'notable' | 'major'
  const routeTitle  = buildRouteTitle(event);   // "바이낸스 → 콜드월렛 (HODLing 신호)"
  const insightText = buildInsightText(event);   // 한 줄 설명

  // 달러 환산: tradeAmt(원화) → USD 역산
  const usdAmt = event.source === 'whale-alert'
    ? fmtUsd(Math.round((event.tradeAmt || 0) / DEFAULT_KRW_RATE))
    : null;

  // 수량 + 심볼 표시
  const volStr = fmtVol(event.volume, event.symbol);

  // 체인/소스 배지
  const chainBadge = event.source === 'whale-alert'
    ? { bg: '#F0F4FF', color: '#3182F6', text: (event.chain || 'CHAIN').toUpperCase() }
    : event.source === 'binance'
    ? { bg: '#FFF8E1', color: '#F0B90B', text: 'BINANCE' }
    : event.source === 'bithumb'
    ? { bg: '#FFF0F6', color: '#E91E8C', text: '빗썸' }
    : event.chain === 'bitcoin'
    ? { bg: '#FFF4E6', color: '#FF9500', text: 'BTC 온체인' }
    : { bg: '#F2F4F6', color: '#6B7684', text: 'UPBIT' };

  // 코인 맵에서 종목 조회 (심볼 기반)
  const linkedCoin = coinMap?.[event.symbol?.toUpperCase()];

  // 등급별 카드 테두리·배경 스타일
  const gradeCardClass = grade === 'major'
    ? 'border-l-[3px] border-l-[#F04452] bg-gradient-to-r from-[#FFF8F8] to-white'
    : grade === 'notable'
    ? 'border-l-2 border-l-[#FF9500]'
    : '';

  return (
    <div
      className={`px-4 py-3 border-b border-[#F2F4F6] last:border-0 ${gradeCardClass} ${isHigh ? 'bg-[#FFFBF0]' : ''} ${linkedCoin ? 'cursor-pointer hover:bg-[#F7F8FA] active:bg-[#F2F4F6] transition-colors' : ''}`}
      onClick={() => linkedCoin && onItemClick?.(linkedCoin)}
    >
      {/* 1행: 거래소 경로 제목 (크게) + 심볼 배지 + 등급 배지 + HIGH 배지 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[13px] font-bold text-[#191F28] leading-snug flex-1 min-w-0">
          {routeTitle}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[12px] font-bold text-[#191F28]">{event.symbol}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: chainBadge.bg, color: chainBadge.color }}
          >
            {chainBadge.text}
          </span>
          {/* 시그널 강도 배지: 주요/대형만 표시 */}
          {grade === 'major' && (
            <span className="text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] px-1.5 py-0.5 rounded">🚨 대형 이동</span>
          )}
          {grade === 'notable' && (
            <span className="text-[10px] font-bold bg-[#FFF4E6] text-[#FF9500] px-1.5 py-0.5 rounded">⚠️ 주요 이동</span>
          )}
          {isHigh && (
            <span className="text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] px-1.5 py-0.5 rounded">🔥 HIGH</span>
          )}
        </div>
      </div>

      {/* 2행: 신호 강도 배지 + 수량 + 금액 */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {/* 신호 강도 배지 */}
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
          style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}
        >
          {badge.emoji} {badge.label}
        </span>
        {/* 수량 */}
        {volStr && (
          <span className="text-[13px] font-bold text-[#191F28] font-mono tabular-nums">
            {volStr}
          </span>
        )}
        {/* 원화 금액 */}
        <span className="text-[13px] font-bold font-mono tabular-nums" style={{ color: badge.color }}>
          ₩{fmtAmt(event.tradeAmt)}
        </span>
        {/* USD 병기 */}
        {usdAmt && (
          <span className="text-[11px] text-[#8B95A1] font-mono tabular-nums">({usdAmt})</span>
        )}
      </div>

      {/* 3행: 인사이트 설명 — 이동의 의미를 한 줄로 */}
      <div className="text-[11px] text-[#6B7684] leading-snug mb-1">
        {insightText}
      </div>

      {/* 4행: 시간 */}
      <div className="text-[10px] text-[#B0B8C1]">
        {timeAgo(event.timestamp)}
      </div>
    </div>
  );
}

export default function WhalePanel({ isVisible = true, coins = [], onItemClick }) {
  const [onchainEvents,  setOnchainEvents]  = useState([]); // 온체인 자금 이동
  const [btcConnected,     setBtcConnected]     = useState(false);

  // 심볼 → 코인 빠른 조회 맵
  const coinMap = useMemo(() => coins.reduce((m, c) => {
    if (c.symbol) m[c.symbol.toUpperCase()] = c;
    return m;
  }, {}), [coins]);

  // 이벤트 추가 — 온체인만
  const addEvent = (evt) => {
    pushWhaleEvent(evt);
    setOnchainEvents(prev => [evt, ...prev].slice(0, MAX_EVENTS));
  };

  useEffect(() => {
    if (!isVisible) return;

    setBtcConnected(false);

    // ── Blockchain.com BTC 온체인 WebSocket ──────────────────────
    subscribeBtcWhales((evt) => {
      if (evt._connected) { setBtcConnected(true); return; }
      setBtcConnected(true);
      addEvent(evt);
    });

    // ── Whale Alert REST 폴링 (온체인 자금 이동) ─────────────────
    startWhaleAlertPolling((evt) => {
      addEvent(evt);
    });

    return () => {
      unsubscribeBtcWhales();
      stopWhaleAlertPolling();
      setBtcConnected(false);
    };
  }, [isVisible]);

  // 고래 연속 패턴 감지 → 시그널 엔진에 추가 (60초 간격)
  useEffect(() => {
    if (!isVisible) return;
    const detectAndPush = () => {
      if (onchainEvents.length === 0) return;
      const patterns = detectWhalePatterns(onchainEvents);
      for (const p of patterns) {
        // 패턴 타입 → 시그널 타입 매핑
        const typeMap = {
          consecutive_deposit: SIGNAL_TYPES.WHALE_EXCHANGE_INFLOW,
          consecutive_withdrawal: SIGNAL_TYPES.WHALE_EXCHANGE_OUTFLOW,
          bidirectional: SIGNAL_TYPES.WHALE_EXCHANGE_INFLOW,
          large_single: SIGNAL_TYPES.WHALE_LARGE_SINGLE,
        };
        const sig = createSignal({
          type: typeMap[p.type] || SIGNAL_TYPES.WHALE_EXCHANGE_INFLOW,
          symbol: p.symbol,
          name: p.symbol,
          market: 'crypto',
          direction: p.direction,
          strength: p.strength,
          title: p.title,
          meta: { patternType: p.type, count: p.count, totalAmt: p.totalAmt },
        });
        addSignal(sig);
      }
    };
    detectAndPush();
    const iv = setInterval(detectAndPush, PATTERN_SCAN_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [isVisible, onchainEvents]);

  // ── 소스 6: Blockchair 온체인 폴링 (BTC/ETH $1M+, 5분 간격) ──
  const seenChainIds = useRef(new Set()).current;
  useEffect(() => {
    if (!isVisible) return;
    const poll = async () => {
      try {
        const data = await fetchWhaleChain('all', 1_000_000);
        for (const tx of (data.transactions || [])) {
          if (seenChainIds.has(tx.id)) continue;
          seenChainIds.add(tx.id);
          if (seenChainIds.size > 200) {
            const iter = seenChainIds.values();
            for (let i = 0; i < 100; i++) seenChainIds.delete(iter.next().value);
          }
          const fromKnown = tx.fromLabel ? `${tx.fromFlag || ''} ${tx.fromLabel}` : null;
          const toKnown   = tx.toLabel   ? `${tx.toFlag   || ''} ${tx.toLabel}`   : null;
          addEvent({
            id:          tx.id,
            symbol:      tx.symbol,
            chain:       tx.chain,
            side:        '온체인',
            tradeAmt:    Math.round((tx.amountUsd || 0) * DEFAULT_KRW_RATE), // KRW 변환 (온체인 USD 기준)
            tradeUsd:    tx.amountUsd,
            volume:      tx.volume,
            severity:    tx.amountUsd >= 5_000_000 ? 'high' : 'normal',
            timestamp:   tx.time ? new Date(tx.time).getTime() : Date.now(),
            txHash:      tx.hash,
            source:      'blockchair',
            movementType: (() => {
              if (tx.fromType === 'exchange' && tx.toType !== 'exchange') return 'exchange_to_wallet';
              if (tx.fromType !== 'exchange' && tx.toType === 'exchange') return 'wallet_to_exchange';
              if (fromKnown || toKnown) return 'wallet_to_wallet';
              return undefined;
            })(),
            fromOwner:   tx.fromLabel || null,
            toOwner:     tx.toLabel   || null,
            insight:     fromKnown
              ? `${fromKnown} → ${toKnown || '지갑'} 온체인 이동 $${(tx.amountUsd / 1e6).toFixed(0)}M`
              : `${tx.symbol} 온체인 대형 이동 $${(tx.amountUsd / 1e6).toFixed(0)}M`,
            label:       fromKnown
              ? `${fromKnown} → ${toKnown || '지갑'}`
              : `${tx.symbol} 온체인`,
          });
        }
      } catch { /* 실패 무시, 다음 폴링에 재시도 */ }
    };
    poll();
    const timer = setInterval(poll, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isVisible]);

  const isAnyConnected = btcConnected;

  // ─── 일간 고래 통계 요약 계산 ─────────────────────────────────
  const dailySummary = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();

    // 온체인 이벤트 중 오늘 이벤트 필터
    const todayEvents = onchainEvents.filter(e => e.timestamp >= todayTs);

    let totalInflow = 0;  // 거래소 입금(매도 압력) 합산
    let totalOutflow = 0; // 거래소 출금(HODLing) 합산

    for (const e of todayEvents) {
      const amt = e.tradeAmt || 0;
      const stable = isStablecoin(e.symbol);

      if (stable) {
        // 스테이블코인: 입금 = 유입(bullish), 출금 = 이탈
        if (e.movementType === 'exchange_deposit') totalOutflow += amt;
        else if (e.movementType === 'exchange_withdrawal') totalInflow += amt;
      } else {
        // 일반 코인: 입금 = 유입(inflow, bearish), 출금 = 유출(outflow, bullish)
        if (e.movementType === 'exchange_deposit' || e.side === '매도') totalInflow += amt;
        else if (e.movementType === 'exchange_withdrawal' || e.side === '매수') totalOutflow += amt;
        else continue; // 방향 불명확한 이벤트는 통계 제외
      }
    }

    const total = totalInflow + totalOutflow;
    const inflowPct = total > 0 ? Math.round((totalInflow / total) * 100) : 0;

    return { todayCount: todayEvents.length, totalInflow, totalOutflow, inflowPct };
  }, [onchainEvents]);

  // 원화 금액 단축 포맷 (일간 요약 전용)
  function fmtKrw(n) {
    if (!n || n === 0) return '0';
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
    if (n >= 1e8)  return `${(n / 1e8).toFixed(1)}억`;
    if (n >= 1e4)  return `${(n / 1e4).toFixed(0)}만`;
    return n.toLocaleString('ko-KR');
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[15px]">🐋</span>
        <span className="text-[14px] font-bold text-[#191F28]">고래 알림 · 온체인</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAnyConnected ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
          <span className="text-[10px] text-[#B0B8C1]">
            {btcConnected ? 'BTC온체인' : '연결 중...'}
          </span>
        </div>
      </div>

      {/* 일간 고래 요약 — 오늘 이벤트 집계 */}
      <div className="px-4 py-2 bg-[#FAFBFC] border-b border-[#F2F4F6]">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#8B95A1]">오늘 {dailySummary.todayCount}건</span>
          <div className="flex items-center gap-2">
            <span className="text-[#2AC769]">유출 ₩{fmtKrw(dailySummary.totalOutflow)}</span>
            <span className="text-[#F04452]">유입 ₩{fmtKrw(dailySummary.totalInflow)}</span>
          </div>
        </div>
        {/* 유입/유출 비율 바 */}
        <div className="h-1 bg-[#E5E8EB] rounded-full mt-1 overflow-hidden">
          <div
            className="h-full bg-[#F04452] rounded-full transition-all duration-500"
            style={{ width: `${dailySummary.inflowPct}%` }}
          />
        </div>
      </div>

      {/* 설명 */}
      <div className="px-4 py-2 text-[10px] text-[#FF9500] bg-[#FFFBF5]">
        블록체인 15 BTC+ 이동 / 글로벌 500K USD+ 자금 흐름
      </div>

      {/* 이벤트 목록 */}
      <div className="max-h-[400px] overflow-y-auto">
        {onchainEvents.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="text-[22px] mb-2">🔗</div>
            <div className="text-[13px] text-[#B0B8C1] mb-1">
              {!isAnyConnected ? '연결 중...' : '온체인 자금 이동 감지 중...'}
            </div>
            <div className="text-[11px] text-[#C9CDD2]">
              15 BTC 이상 이동 / 대형 자금 흐름 발생 시 표시
            </div>
          </div>
        ) : (
          onchainEvents.map((evt, i) => (
            <EventRow
              key={`${evt.id || evt.symbol}-${evt.timestamp}-${i}`}
              event={evt}
              coinMap={coinMap}
              onItemClick={onItemClick}
            />
          ))
        )}
      </div>

      {/* 온체인 범례 */}
      <div className="px-4 py-2.5 border-t border-[#F2F4F6] bg-[#FAFBFC]">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-[10px] text-[#C9CDD2]">🔴 거래소 입금 = 매도 압력</span>
          <span className="text-[10px] text-[#C9CDD2]">🟢 거래소 출금 = HODLing</span>
          <span className="text-[10px] text-[#C9CDD2]">🟡 거래소간 이동 = 차익거래?</span>
          <span className="text-[10px] text-[#C9CDD2]">⚪ 지갑간 이동 = OTC</span>
        </div>
      </div>

      {/* ETF 자금 흐름 위젯 */}
      <div className="p-4 border-t border-[#F2F4F6]">
        <EtfFlowWidget />
      </div>
    </div>
  );
}
