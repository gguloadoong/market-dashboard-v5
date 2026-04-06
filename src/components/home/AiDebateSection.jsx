// AI 종목토론 섹션 — "살 이유 vs 조심할 이유" 2줄 요약 + 확신도 바
// Phase 8B 개편: 3라운드 채팅 → 핵심 판단 중심 컴팩트 UI
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

// 메시지 배열에서 핵심 요약 추출 (Bull 1줄 + Bear 1줄 + verdict)
function extractSummary(result) {
  if (!result) return null;
  const messages = Array.isArray(result.messages) ? result.messages : [];
  const bullMsg = messages.find(m => m.side === 'bull')?.text || '';
  const bearMsg = messages.find(m => m.side === 'bear')?.text || '';
  return {
    bull: bullMsg,
    bear: bearMsg,
    verdict: result.verdict || '',
    confidence: result.confidence ?? 0.5,
  };
}

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
    if (cached) {
      // 구 형식 호환
      if (!cached.messages && (cached.bull || cached.bear)) {
        cached.messages = [
          ...(cached.bull ? [{ side: 'bull', text: cached.bull }] : []),
          ...(cached.bear ? [{ side: 'bear', text: cached.bear }] : []),
        ];
      }
      setResult(cached);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const stock = usStocks.find(s => s.symbol === item.symbol);
      const ctx = { name: item.name, price: stock?.price, changePct: stock?.changePct, market: item.market };
      const data = await fetchAiDebate(item.symbol, ctx);
      if (data?.error) {
        setError(data.error === 'GROQ_API_KEY not configured' ? 'AI 기능 미설정' : data.error);
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

  // 자동 로드 제거 — 사용자가 종목 선택 시에만 토론 시작

  const summary = extractSummary(result);
  const confPct = Math.round((summary?.confidence ?? 0.5) * 100);
  const confLabel = confPct >= 60 ? '매수 우세' : confPct <= 40 ? '매도 우세' : '팽팽';

  return (
    <div className="bg-white rounded-xl border border-[#ECEEF1] p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#191F28]">{selected?.name} 사도 될까?</span>
          <span className="text-[11px] text-[#8B95A1]">AI 분석</span>
        </div>
        <select
          value={selected?.symbol || ''}
          onChange={e => {
            const item = symbolList.find(s => s.symbol === e.target.value);
            if (item) { setSelected(item); setResult(null); runDebate(item); }
          }}
          className="text-[11px] border border-[#E5E8EB] rounded-lg px-2 py-1 text-[#191F28] bg-white"
        >
          {symbolList.map(s => (
            <option key={s.symbol} value={s.symbol}>{s.name} ({s.symbol})</option>
          ))}
        </select>
      </div>

      {/* 로딩 / 에러 / 시작 전 */}
      {!result && !loading && (
        <div className="space-y-2">
          {error && (
            <div className="text-[11px] text-[#F04452] bg-[#FFF0F1] rounded-lg p-2">{error}</div>
          )}
          <button
            onClick={() => { setError(null); runDebate(selected); }}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white bg-[#3182F6] hover:bg-[#2272E6] transition-colors"
          >
            {error ? '다시 시도하기' : 'AI에게 물어보기'}
          </button>
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-4 gap-2">
          <div className="w-4 h-4 border-2 border-[#3182F6] border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-[#8B95A1]">AI가 분석하고 있어요...</span>
        </div>
      )}

      {/* 2줄 요약 (기본 상태) */}
      {summary && !error && (
        <div className="space-y-3">
          {/* 살 이유 / 조심할 이유 */}
          <div className="space-y-2">
            <div className="flex items-start gap-2 bg-[#FFF0F1] rounded-lg px-3 py-2.5">
              <span className="text-[12px] flex-shrink-0 mt-0.5">🔴</span>
              <div>
                <span className="text-[11px] font-bold text-[#F04452]">살 이유</span>
                <p className="text-[12px] text-[#191F28] mt-0.5 leading-relaxed">{summary.bull || '분석 중...'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-[#EDF4FF] rounded-lg px-3 py-2.5">
              <span className="text-[12px] flex-shrink-0 mt-0.5">🔵</span>
              <div>
                <span className="text-[11px] font-bold text-[#1764ED]">조심할 이유</span>
                <p className="text-[12px] text-[#191F28] mt-0.5 leading-relaxed">{summary.bear || '분석 중...'}</p>
              </div>
            </div>
          </div>

          {/* 확신도 바 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#1764ED] w-6">매도</span>
            <div className="flex-1 h-2 bg-[#F2F4F6] rounded-full overflow-hidden relative">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${confPct}%`,
                  background: confPct >= 60 ? '#F04452' : confPct <= 40 ? '#1764ED' : '#FF9500',
                }}
              />
            </div>
            <span className="text-[10px] text-[#F04452] w-6 text-right">매수</span>
            <span className="text-[11px] font-bold ml-1 tabular-nums" style={{
              color: confPct >= 60 ? '#F04452' : confPct <= 40 ? '#1764ED' : '#FF9500',
            }}>
              {confPct}% {confLabel}
            </span>
          </div>

          {/* AI 종합 의견 */}
          {summary.verdict && (
            <div className="bg-[#F7F8FA] rounded-lg p-2.5">
              <span className="text-[10px] text-[#8B95A1]">AI 종합: </span>
              <span className="text-[11px] text-[#191F28] font-medium">{summary.verdict}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
