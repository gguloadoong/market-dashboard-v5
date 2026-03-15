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

let whaleWs      = null;
let whaleHandler = null;

/**
 * subscribeUpbitWhaleTrades(symbols, onEvent)
 *
 * @param {string[]} symbols  - ['BTC','ETH','XRP']
 * @param {Function} onEvent  - ({ symbol, type: 'whale_trade', price, volume, tradeAmt, message })
 *
 * 단일 체결에서 tradeAmt = price × volume (원화)
 * 임계값: 5억 원 이상 단일 체결 → 고래 의심
 */
export function subscribeUpbitWhaleTrades(symbols, onEvent) {
  // 기존 연결 해제
  if (whaleWs) {
    whaleWs.close();
    whaleWs = null;
  }

  const THRESHOLD_KRW = 500_000_000; // 5억 원
  const markets = symbols.map(s => `KRW-${s}`);

  try {
    whaleWs = new WebSocket('wss://api.upbit.com/websocket/v1');
    whaleHandler = onEvent;

    whaleWs.onopen = () => {
      // Upbit WebSocket 구독 요청 형식
      const payload = JSON.stringify([
        { ticket: 'whale-alert' },
        { type: 'trade', codes: markets, isOnlyRealtime: true },
        { format: 'DEFAULT' },
      ]);
      whaleWs.send(payload);
    };

    whaleWs.onmessage = async (evt) => {
      // Upbit은 ArrayBuffer 또는 Blob으로 전송
      let text;
      if (evt.data instanceof Blob) {
        text = await evt.data.text();
      } else if (evt.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(evt.data);
      } else {
        text = evt.data;
      }

      try {
        const data = JSON.parse(text);
        if (data.type !== 'trade') return;

        const price    = data.trade_price;
        const volume   = data.trade_volume;
        const tradeAmt = price * volume;

        if (tradeAmt < THRESHOLD_KRW) return;

        const symbol  = (data.code || '').replace('KRW-', '');
        const side    = data.ask_bid === 'ASK' ? '매도' : '매수';
        const amtStr  = tradeAmt >= 1_000_000_000
          ? `${(tradeAmt / 1_000_000_000).toFixed(1)}십억`
          : `${(tradeAmt / 100_000_000).toFixed(1)}억`;

        whaleHandler?.({
          symbol,
          type:     'whale_trade',
          severity: tradeAmt >= 2_000_000_000 ? 'high' : 'medium',
          price,
          volume,
          tradeAmt,
          side,
          message:  `🐋 ${symbol} 고래 ${side} ${amtStr}원 (${volume.toFixed(4)})`,
          timestamp: Date.now(),
        });
      } catch {}
    };

    whaleWs.onerror = (err) => {
      console.warn('[whale-ws] 오류:', err.message);
    };

    whaleWs.onclose = () => {
      whaleWs = null;
    };
  } catch (err) {
    console.warn('[whale-ws] WebSocket 연결 실패:', err.message);
  }
}

/**
 * unsubscribeUpbitWhaleTrades()
 * WebSocket 연결 해제 — 컴포넌트 언마운트 시 호출
 */
export function unsubscribeUpbitWhaleTrades() {
  if (whaleWs) {
    whaleWs.close();
    whaleWs     = null;
    whaleHandler = null;
  }
}
