// ─── 코인 고래 알림 API ────────────────────────────────────────
//
// 【결론: WhaleAlert RSS는 클라이언트 사이드에서 불가】
//
// 사유:
//   - whale-alert.io RSS: CORS 헤더 없음 → 브라우저에서 직접 불가
//   - allorigins 경유 가능하나 whale-alert.io가 봇 차단 → 빈 응답 多
//   - WhaleAlert 공식 API: 유료 (Free 플랜은 REST API, 15분 지연)
//   - CryptoCompare Large TX: 유료 플랜만 지원
//   - Upbit 대량 거래 공개 API: 없음
//
// 【채택 대안: CoinGecko 가격 급등 + Upbit 거래량 급증 감지】
//
// 설계:
//   1. 이전 스냅샷 vs 현재 스냅샷 비교
//   2. 가격 1분 내 ±2% 이상 변동 → 급변 알림
//   3. 거래량 전일 대비 500% 이상 급증 → 대량 매매 의심 알림
//   4. Upbit의 acc_trade_price_24h (24h 거래대금) 전 주기 대비 급증 → 고래 의심
//
// 한계:
//   - 실제 온체인 고래 TX 추적은 불가
//   - 가격/거래량 이상 징후 감지로 대체 (간접 지표)

// ─── 스냅샷 저장소 ────────────────────────────────────────────
// { coinId: { priceKrw, volume24h, timestamp } }
let prevSnapshot = {};

// ─── 고래 이벤트 타입 ─────────────────────────────────────────
// type: 'price_surge' | 'price_crash' | 'volume_spike' | 'whale_suspect'
// severity: 'high' | 'medium'

/**
 * detectWhaleEvents(currentCoins)
 *
 * @param {Array} currentCoins - fetchCoins() 또는 fetchCoinsUpbitOnly() 반환값
 * @returns {Array} 이벤트 배열
 *   [{ id, symbol, type, severity, message, pctChange, timestamp }]
 */
export function detectWhaleEvents(currentCoins) {
  const now    = Date.now();
  const events = [];

  for (const coin of currentCoins) {
    const prev = prevSnapshot[coin.id];
    if (!prev) continue; // 첫 스냅샷 — 비교 불가

    const elapsed = (now - prev.timestamp) / 1000; // 초
    if (elapsed < 5) continue; // 너무 짧은 간격은 무시

    // ─ 가격 변동률 계산 ──────────────────────────────────────
    const pricePct = prev.priceKrw > 0
      ? ((coin.priceKrw - prev.priceKrw) / prev.priceKrw) * 100
      : 0;

    // 1분 이내 ±2% 이상 급변 → 이상 징후
    if (elapsed <= 90 && Math.abs(pricePct) >= 2) {
      events.push({
        id:        coin.id,
        symbol:    coin.symbol,
        type:      pricePct > 0 ? 'price_surge' : 'price_crash',
        severity:  Math.abs(pricePct) >= 5 ? 'high' : 'medium',
        message:   `${coin.symbol} ${pricePct > 0 ? '급등' : '급락'} ${pricePct.toFixed(1)}% (${Math.round(elapsed)}초)`,
        pctChange: pricePct,
        priceKrw:  coin.priceKrw,
        timestamp: now,
      });
    }

    // ─ 거래량 급증 ───────────────────────────────────────────
    // volume24h는 USD 기준 총 24h 거래량
    // 전 주기 대비 급증은 24h 볼륨이므로 의미 있는 단위 변화 필요
    // 현실적 임계값: 전 주기 대비 +30% 이상 (24h 롤링 윈도우이므로 점진적)
    if (prev.volume24h > 0) {
      const volPct = ((coin.volume24h - prev.volume24h) / prev.volume24h) * 100;
      if (volPct >= 30) {
        events.push({
          id:        coin.id,
          symbol:    coin.symbol,
          type:      'volume_spike',
          severity:  volPct >= 100 ? 'high' : 'medium',
          message:   `${coin.symbol} 거래량 급증 +${volPct.toFixed(0)}%`,
          pctChange: volPct,
          priceKrw:  coin.priceKrw,
          timestamp: now,
        });
      }
    }
  }

  // ─ 스냅샷 갱신 ───────────────────────────────────────────
  for (const coin of currentCoins) {
    prevSnapshot[coin.id] = {
      priceKrw:  coin.priceKrw,
      volume24h: coin.volume24h,
      timestamp: now,
    };
  }

  // severity high 우선, 같으면 pctChange 절대값 내림차순
  return events.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return Math.abs(b.pctChange) - Math.abs(a.pctChange);
  });
}

/**
 * resetWhaleSnapshot()
 * 스냅샷 초기화 — 탭 전환 또는 오랜 비활성 후 재활성화 시 사용
 */
export function resetWhaleSnapshot() {
  prevSnapshot = {};
}

// ─────────────────────────────────────────────────────────────
// [보완] Upbit 실시간 거래 체결 WebSocket (고래 대량 단일 주문 감지)
//
// Upbit은 WebSocket으로 실시간 체결 데이터 제공 (인증 불필요)
// 단일 체결 기준 억 단위 이상 → 고래 의심
// ─────────────────────────────────────────────────────────────

let whaleWs        = null;
let whaleHandler   = null;
let whaleSymbols   = null;
let reconnectTimer = null;
let destroyed      = false;

// 원화 금액 포맷
function fmtKrw(n) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n / 1e8).toFixed(1)}억`;
  if (n >= 1e4)  return `${(n / 1e4).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

function connectWs() {
  if (destroyed || !whaleSymbols || !whaleHandler) return;

  const THRESHOLD_KRW = 100_000_000; // 1억 원 (BTC 1개 기준)
  const HIGH_KRW      = 500_000_000; // 5억 원
  const markets = whaleSymbols.map(s => `KRW-${s}`);

  try {
    const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    whaleWs = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify([
        { ticket: `whale-${Date.now()}` },
        { type: 'trade', codes: markets },
        { format: 'DEFAULT' },
      ]));
      // 연결 성공 콜백 (연결 상태 알림용 특수 이벤트)
      whaleHandler?.({ _connected: true });
    };

    ws.onmessage = async (evt) => {
      let text;
      if (evt.data instanceof Blob)        text = await evt.data.text();
      else if (evt.data instanceof ArrayBuffer) text = new TextDecoder().decode(evt.data);
      else text = evt.data;

      try {
        const data = JSON.parse(text);
        if (data.type !== 'trade') return;

        const price    = data.trade_price ?? 0;
        const volume   = data.trade_volume ?? 0;
        const tradeAmt = price * volume;
        if (tradeAmt < THRESHOLD_KRW) return;

        const symbol = (data.code || '').replace('KRW-', '');
        const side   = data.ask_bid === 'ASK' ? '매도' : '매수';

        whaleHandler?.({
          symbol,
          type:      'whale_trade',
          severity:  tradeAmt >= HIGH_KRW ? 'high' : 'medium',
          price,
          volume,
          tradeAmt,
          side,
          message:   `${symbol} ${side} ${fmtKrw(tradeAmt)}원 (${volume % 1 === 0 ? volume : volume.toFixed(4)})`,
          timestamp: Date.now(),
        });
      } catch {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      whaleWs = null;
      if (!destroyed) {
        // 5초 후 자동 재연결
        reconnectTimer = setTimeout(connectWs, 5000);
      }
    };
  } catch {
    if (!destroyed) reconnectTimer = setTimeout(connectWs, 5000);
  }
}

/**
 * subscribeUpbitWhaleTrades(symbols, onEvent)
 * @param {string[]} symbols - ['BTC','ETH',...]
 * @param {Function} onEvent - 이벤트 수신 콜백
 *   onEvent({ _connected: true }) → 연결 성공 알림
 *   onEvent({ symbol, type, severity, tradeAmt, side, message, timestamp })
 */
export function subscribeUpbitWhaleTrades(symbols, onEvent) {
  destroyed      = false;
  whaleSymbols   = symbols;
  whaleHandler   = onEvent;

  if (whaleWs) { try { whaleWs.close(); } catch {} whaleWs = null; }
  clearTimeout(reconnectTimer);
  connectWs();
}

/**
 * unsubscribeUpbitWhaleTrades()
 * WebSocket 연결 해제 — 컴포넌트 언마운트 시 호출
 */
export function unsubscribeUpbitWhaleTrades() {
  destroyed    = true;
  whaleHandler = null;
  whaleSymbols = null;
  clearTimeout(reconnectTimer);
  if (whaleWs) { try { whaleWs.close(); } catch {} whaleWs = null; }
}
