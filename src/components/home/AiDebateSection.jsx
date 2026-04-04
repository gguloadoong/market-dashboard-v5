// AI 종목토론 섹션 — 채팅 버블 UI (Bull vs Bear 3라운드)
import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchAiDebate } from '../../api/_gateway';

// sessionStorage 캐시 (30분)
const CACHE_TTL = 30 * 60 * 1000;
function getCached(symbol) {
  try {
    const raw = sessionStorage.getItem(`debate_${symbol}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}
function setCached(symbol, data) {
  try {
    sessionStorage.setItem(`debate_${symbol}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// 인기 종목 기본 목록
const DEFAULT_SYMBOLS = [
  { symbol: 'NVDA', name: 'NVIDIA', market: 'us' },
  { symbol: 'AAPL', name: 'Apple', market: 'us' },
  { symbol: 'TSLA', name: 'Tesla', market: 'us' },
  { symbol: 'MSFT', name: 'Microsoft', market: 'us' },
  { symbol: 'BTC', name: 'Bitcoin', market: 'crypto' },
];

export default function AiDebateSection({ watchedItems = [], usStocks = [] }) {
  const [selected, setSelected] = useState(DEFAULT_SYMBOLS[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const animTimerRef = useRef(null);

  // watchlist + 기본 목록 합산
  const symbolList = [
    ...DEFAULT_SYMBOLS,
    ...watchedItems
      .filter(w => !DEFAULT_SYMBOLS.some(d => d.symbol === (w.symbol || w)))
      .map(w => {
        const sym = w.symbol || w;
        const stock = usStocks.find(s => s.symbol === sym);
        return { symbol: sym, name: stock?.name || sym, market: w.market || 'us' };
      })
      .slice(0, 5),
  ];

  const messages = Array.isArray(result?.messages) ? result.messages : [];

  // 메시지 애니메이션: visibleCount < messages.length 이면 700ms 후 +1
  useEffect(() => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    if (visibleCount < messages.length) {
      animTimerRef.current = setTimeout(() => {
        setVisibleCount(v => v + 1);
      }, 700);
    }
    return () => { if (animTimerRef.current) clearTimeout(animTimerRef.current); };
  }, [visibleCount, messages.length]);

  // 애니메이션 시작 (데이터 세팅 후 visibleCount 0에서 시작)
  const startAnimation = useCallback((data) => {
    setResult(data);
    setVisibleCount(0);
  }, []);

  const runDebate = useCallback(async (item) => {
    if (!item) return;
    const cached = getCached(item.symbol);
    if (cached) {
      // 구 형식(bull/bear 문자열) → messages 배열로 정규화 (캐시 호환성)
      if (!cached.messages && (cached.bull || cached.bear)) {
        cached.messages = [
          ...(cached.bull ? [{ side: 'bull', text: cached.bull }] : []),
          ...(cached.bear ? [{ side: 'bear', text: cached.bear }] : []),
        ];
      }
      startAnimation(cached);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setVisibleCount(0);
    try {
      const stock = usStocks.find(s => s.symbol === item.symbol);
      const ctx = {
        name: item.name,
        price: stock?.price,
        changePct: stock?.changePct,
        market: item.market,
      };
      const data = await fetchAiDebate(item.symbol, ctx);
      if (data?.error) {
        setError(data.error === 'GROQ_API_KEY not configured' ? 'AI 기능 미설정 (GROQ_API_KEY 필요)' : data.error);
      } else {
        setCached(item.symbol, data);
        startAnimation(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [usStocks, startAnimation]);

  // 마운트 시 첫 종목 자동 토론 — ref로 1회만 실행
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    runDebate(DEFAULT_SYMBOLS[0]);
  }, [runDebate]);

  const confidence = result?.confidence ?? 0.5;
  const confColor = confidence > 0.6 ? '#2AC769' : confidence < 0.4 ? '#F04452' : '#FF9500';
  const allShown = visibleCount >= messages.length && messages.length > 0;

  return (
    <div className="bg-white rounded-xl border border-[#ECEEF1] p-4">
      {/* 헤더: 선택된 종목 이름 + 드롭다운 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-[#191F28]">AI 종목토론</span>
            <span className="text-[10px] text-[#B0B8C1]">Bull vs Bear</span>
          </div>
          {selected && (
            <div className="text-[16px] font-bold text-[#191F28] mt-0.5">
              {selected.name} <span className="text-[12px] text-[#8B95A1] font-normal">{selected.symbol}</span>
            </div>
          )}
        </div>
        <select
          value={selected?.symbol || ''}
          onChange={e => {
            const item = symbolList.find(s => s.symbol === e.target.value);
            if (item) { setSelected(item); setResult(null); setVisibleCount(0); }
          }}
          className="text-[11px] border border-[#F2F4F6] rounded-lg px-2 py-1 text-[#191F28] bg-white"
        >
          {symbolList.map(s => (
            <option key={s.symbol} value={s.symbol}>{s.name} ({s.symbol})</option>
          ))}
        </select>
      </div>

      {/* 분석 버튼 */}
      <button
        onClick={() => runDebate(selected)}
        disabled={loading}
        className="w-full py-2 rounded-xl text-[12px] font-bold text-white bg-[#3182F6] hover:bg-[#2272E6] disabled:bg-[#B0B8C1] transition-colors mb-3"
      >
        {loading ? '분석 중...' : `${selected?.name} 토론 시작`}
      </button>

      {error && (
        <div className="text-[11px] text-[#F04452] bg-[#FFF0F1] rounded-lg p-2">{error}</div>
      )}

      {result && !error && (
        <div className="space-y-2">
          {/* 확신도 바 */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-[#8B95A1] w-8">약세</span>
            <div className="flex-1 h-2 bg-[#F2F4F6] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${confidence * 100}%`, background: confColor }}
              />
            </div>
            <span className="text-[10px] text-[#8B95A1] w-8 text-right">강세</span>
          </div>

          {/* 채팅 버블 영역 */}
          <div className="space-y-2">
            {messages.filter(msg => msg.text?.trim()).slice(0, visibleCount).map((msg, i) => {
              const isBull = msg.side === 'bull';
              return (
                <div
                  key={i}
                  className="flex animate-[fadeIn_0.3s_ease-out]"
                  style={{ justifyContent: isBull ? 'flex-start' : 'flex-end' }}
                >
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2"
                    style={{
                      background: isBull ? '#F0FFF6' : '#FFF0F1',
                      borderLeft: isBull ? '3px solid #2AC769' : 'none',
                      borderRight: isBull ? 'none' : '3px solid #F04452',
                    }}
                  >
                    <div
                      className="text-[10px] font-bold mb-0.5"
                      style={{ color: isBull ? '#2AC769' : '#F04452' }}
                    >
                      {isBull ? '🟢 강세파' : '🔴 약세파'}
                    </div>
                    <p className="text-[12px] text-[#191F28] leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* verdict 카드 — 모든 메시지 표시 후에만 등장 */}
          {allShown && result.verdict && (
            <div className="bg-[#F8F9FA] rounded-xl p-3 animate-[fadeIn_0.3s_ease-out]">
              <span className="text-[10px] text-[#8B95A1]">종합 의견: </span>
              <span className="text-[11px] text-[#191F28] font-medium">{result.verdict}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
