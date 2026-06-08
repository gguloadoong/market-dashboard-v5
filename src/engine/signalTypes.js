// 시그널 타입 상수 — 시그널 엔진 전체에서 공유

// 스테이블코인 심볼 집합 — 투자자 시그널 스테이블코인 필터링
export const STABLECOIN_SYMBOLS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD']);

export const SIGNAL_TYPES = {
  VOLUME_ANOMALY: 'volume_anomaly',
  COMPOSITE_SCORE: 'composite_score',
  SUPPORT_RESISTANCE_BREAK: 'support_resistance_break',
  DOUBLE_BOTTOM: 'double_bottom',
};

// ── 시그널 도메인(kind) 단일 소스 — type → 'stock' | 'market' (#343) ──
// 모든 시그널 타입은 종목(stock)이거나 시장 지표(market) 중 하나로 분류된다.
// stock: 개별 종목 단위 — 종목 카드/클릭/차트 라우팅 대상.
// market: 시장 전체/섹터/거시 단위 — symbol 필드에 'crypto'/'MARKET'/'USDKRW' 등이 들어가지만
//         종목 클릭/카드 변환 금지. 시그널 보드 정보 행 + 봇 성적표 추적 + 교차 참조용.
// createSignal/loadSignals가 이 맵으로 signal.kind를 자동 주입한다 (단일 소스).
export const SIGNAL_KIND = {
  // ── stock (개별 종목) ──
  [SIGNAL_TYPES.VOLUME_ANOMALY]: 'stock',
  [SIGNAL_TYPES.COMPOSITE_SCORE]: 'stock',          // 종목 복합 점수
  [SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK]: 'stock',
  [SIGNAL_TYPES.DOUBLE_BOTTOM]: 'stock',
};

// SIGNAL_KIND 완전성 런타임 검증 (#343)
// ⚠️ `vite build`는 이 IIFE를 실행하지 않아 누락을 잡지 못한다.
// 발견/차단 경로:
//   ① npm run test (vitest) — signalTypes import 순간 throw → 테스트 실패.
//      개발 중 + `npm run ship`(lint && test && build && gate) 체인에서 차단된다.
//      ⚠️ 단 배포 게이트 pre-deploy-consensus.sh(L95-100)는 test 실패를 "경고만" 하고
//      배포를 막지 않는다 → 자동 배포 차단은 보장되지 않음 (게이트 강화는 별도 이슈). [Copilot PR#348 반영]
//   ② 런타임 모듈 로드 시 즉시 크래시 (fail-fast) — "가짜 종목 카드 = 신뢰 위반 = P0"
//      철학상 의도적 설계. 누락된 채로 서비스가 뜨는 상황을 원천 차단한다.
// 신규 시그널 타입 추가 시 SIGNAL_KIND에 등록 필수.
(function assertSignalKindComplete() {
  const missing = [];
  const invalid = [];
  for (const type of Object.values(SIGNAL_TYPES)) {
    const kind = SIGNAL_KIND[type];
    if (kind === undefined) missing.push(type);
    else if (kind !== 'stock' && kind !== 'market') invalid.push(`${type}=${kind}`);
  }
  if (missing.length || invalid.length) {
    throw new Error(
      `[#343] SIGNAL_KIND 불완전 — 모든 시그널 타입은 'stock' 또는 'market'으로 분류돼야 합니다.\n` +
      (missing.length ? `  누락: ${missing.join(', ')}\n` : '') +
      (invalid.length ? `  잘못된 값: ${invalid.join(', ')}\n` : '') +
      `  해결: src/engine/signalTypes.js의 SIGNAL_KIND 맵에 위 타입을 추가하세요.`,
    );
  }
})();

/** 시그널 타입의 도메인(kind) 조회 — 미등록 타입은 'stock' 기본 (#343) */
export function getSignalKind(type) {
  return SIGNAL_KIND[type] === 'market' ? 'market' : 'stock';
}

// 시장 지표 시그널 타입 집합 — SIGNAL_KIND에서 파생 (수동 관리 종료, 하위호환 export 유지) (#343)
// 종목이 아닌 시장 전체/섹터/거시 단위 지표 (#341). 종목 클릭/카드로 변환 금지.
export const MARKET_INDICATOR_TYPES = new Set(
  Object.entries(SIGNAL_KIND)
    .filter(([, kind]) => kind === 'market')
    .map(([type]) => type),
);

/**
 * 시그널이 시장 지표(종목 아님)인지 검사 — 종목 클릭 핸들러에서 차단용 (#341, #343)
 * kind 필드가 있으면 우선 사용(signal.kind==='market'), 없으면 type 기반 레거시 fallback.
 */
export function isMarketIndicatorSignal(signal) {
  if (!signal) return false;
  if (signal.kind === 'market') return true;
  if (signal.kind === 'stock') return false;
  return MARKET_INDICATOR_TYPES.has(signal.type);
}

// 시그널 방향
export const DIRECTIONS = {
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  NEUTRAL: 'neutral',
};

// 시그널 만료 시간 (ms) — 미등록 타입은 기본 2시간
const DEFAULT_TTL = 2 * 3600000;

export const SIGNAL_TTL = {
  [SIGNAL_TYPES.VOLUME_ANOMALY]: 2 * 3600000,
  [SIGNAL_TYPES.COMPOSITE_SCORE]: 15 * 60000, // 15분 (완화: 10분→15분, 5분 크론 × 3)
  [SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK]: 4 * 3600000, // 4시간 — 지지/저항선 돌파
  [SIGNAL_TYPES.DOUBLE_BOTTOM]: 8 * 3600000,         // 8시간 — 이중바닥 패턴
};

/** 시그널 타입별 TTL 조회 (기본값 2시간) */
export function getTTL(type) {
  return SIGNAL_TTL[type] ?? DEFAULT_TTL;
}

// 시그널 방향별 스타일 매핑 (아이콘/색상/배경/라벨)
export const SIGNAL_STYLE = {
  bullish: { emoji: '🟢', color: '#2AC769', bg: '#F0FFF6', label: '강세' },
  bearish: { emoji: '🔴', color: '#F04452', bg: '#FFF0F1', label: '약세' },
  neutral: { emoji: '🟡', color: '#FF9500', bg: '#FFF4E6', label: '중립' },
};

// ── "우리만의 언어" — 일반 투자자가 3초 안에 이해할 수 있는 시그널 설명 ──
// easyLabel: 한 줄 요약 (행동 힌트 + 이모지 강도)
// easyDesc: (meta) => string — 시그널 meta 객체를 받아 동적 메시지 생성
export const TYPE_META = {
  [SIGNAL_TYPES.VOLUME_ANOMALY]: {
    easyLabel: (m) => {
      const pct = m?.changePct ?? 0;
      if (pct <= -1) return '급락 속 거래 폭발 💥';
      if (pct >= 1) return '급등 속 거래 폭발 🔥';
      return '거래가 평소보다 폭발 💥';
    },
    easyDesc: (m) => {
      const pct = m?.changePct ?? 0;
      if (pct <= -1) return `하락 중 거래량 ${m?.ratio?.toFixed(1) || '?'}배 폭발 — 이상 거래량 감지`;
      if (pct >= 1) return `상승 중 거래량 ${m?.ratio?.toFixed(1) || '?'}배 폭발 — 강한 매수세`;
      return `거래량이 평소의 ${m?.ratio?.toFixed(1) || '?'}배 — 뭔가 일어나고 있어요`;
    },
  },
  [SIGNAL_TYPES.SUPPORT_RESISTANCE_BREAK]: {
    easyLabel: (m) => m?.breakType === 'resistance' ? '저항선 뚫고 올라갔어요 🚀' : '지지선 깨졌어요 ⚠️',
    easyDesc: (m) => m?.breakType === 'resistance'
      ? `${m.name || '종목'} ${m.level?.toLocaleString() || '?'}원 저항선 돌파 — 상승 탄력`
      : `${m.name || '종목'} ${m.level?.toLocaleString() || '?'}원 지지선 이탈 — 추가 하락 주의`,
  },
  [SIGNAL_TYPES.DOUBLE_BOTTOM]: {
    easyLabel: (m) => m?.broken
      ? '바닥 두 번 찍고 돌파 🚀'
      : '바닥 두 번 — 반등 시도 중 📈',
    easyDesc: (m) => `${m.name || '종목'} ${m.bottom1?.toLocaleString() || '?'}원 근처에서 두 번 바닥 형성 — 넥라인 ${m.neckline?.toLocaleString() || '?'}원 ${m.broken ? '돌파됨' : '돌파 시 반등'}`,
  },
  [SIGNAL_TYPES.COMPOSITE_SCORE]: {
    easyLabel: (m) => {
      const s = Math.abs(m?.compositeScore ?? 0);
      const isUp = m?.direction === 'bullish';
      const isDown = m?.direction === 'bearish';
      // score 크기(강도) + direction(방향)으로 라벨 결정 — direction과 easyLabel 모순 방지 (#300)
      if (s >= 70) return isUp ? '여러 지표 동시 강세 🔥' : isDown ? '여러 지표 동시 약세 🚨' : '방향 탐색 중 👀';
      if (s >= 30) return isUp ? '오를 분위기 감지 중 📈' : isDown ? '내릴 분위기 감지 ⚠️' : '방향 탐색 중 👀';
      return '방향 탐색 중 👀';
    },
    easyDesc: (m) => {
      const bd = m?.breakdown;
      const parts = [];
      if (bd?.momentum != null) parts.push(`모멘텀 ${bd.momentum > 0 ? '+' : ''}${Math.round(bd.momentum)}`);
      if (bd?.volumeZ != null) parts.push(`거래량 ${bd.volumeZ > 0 ? '+' : ''}${Math.round(bd.volumeZ)}`);
      if (bd?.relMkt != null) parts.push(`시장대비 ${bd.relMkt > 0 ? '+' : ''}${Math.round(bd.relMkt)}`);
      return `복합 분석 점수 ${(m?.compositeScore ?? 0) > 0 ? '+' : ''}${m?.compositeScore ?? 0}${parts.length ? ` (${parts.join(', ')})` : ''}`;
    },
  },
};
