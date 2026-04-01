// AI 종목토론 섹션 — Bull vs Bear 토론
import { useState, useCallback } from 'react';
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

  const runDebate = useCallback(async (item) => {
    if (!item) return;
    const cached = getCached(item.symbol);
    if (cached) { setResult(cached); return; }

    setLoading(true);
    setError(null);
    setResult(null);
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
        setError(data.error === 'ANTHROPIC_API_KEY not configured' ? 'AI 기능 미설정 (ANTHROPIC_API_KEY 필요)' : data.error);
      } else {
        setCached(item.symbol, data);
        setResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [usStocks]);

  const confidence = result?.confidence ?? 0.5;
  const confColor = confidence > 0.6 ? '#2AC769' : confidence < 0.4 ? '#F04452' : '#FF9500';

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#191F28]">AI 종목토론</span>
          <span className="text-[10px] text-[#B0B8C1]">Bull vs Bear</span>
        </div>
        {/* 종목 선택 */}
        <select
          value={selected?.symbol || ''}
          onChange={e => {
            const item = symbolList.find(s => s.symbol === e.target.value);
            if (item) setSelected(item);
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

          <div className="grid grid-cols-2 gap-2">
            {/* Bull 카드 */}
            <div className="bg-[#F0FFF6] rounded-xl p-3">
              <div className="text-[11px] font-bold text-[#2AC769] mb-1.5">강세론</div>
              <p className="text-[11px] text-[#191F28] leading-relaxed whitespace-pre-wrap">
                {result.bull?.replace(/• /g, '\n• ').trim()}
              </p>
            </div>
            {/* Bear 카드 */}
            <div className="bg-[#FFF0F1] rounded-xl p-3">
              <div className="text-[11px] font-bold text-[#F04452] mb-1.5">약세론</div>
              <p className="text-[11px] text-[#191F28] leading-relaxed whitespace-pre-wrap">
                {result.bear?.replace(/• /g, '\n• ').trim()}
              </p>
            </div>
          </div>

          {/* 종합 의견 */}
          {result.verdict && (
            <div className="bg-[#F8F9FA] rounded-xl p-3">
              <span className="text-[10px] text-[#8B95A1]">종합 의견: </span>
              <span className="text-[11px] text-[#191F28] font-medium">{result.verdict}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
