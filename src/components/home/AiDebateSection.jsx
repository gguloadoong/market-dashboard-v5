// AI 종목토론 섹션 — "살 이유 vs 조심할 이유" 2줄 요약 + 확신도 바 + 아코디언 근거
// Phase 8B 개편: 3라운드 채팅 → 핵심 판단 중심 컴팩트 UI
// D안: 아코디언 확장형 — 근거 보기 펼침
import { useState, useCallback, useMemo } from 'react';
import { fetchAiDebate } from '../../api/_gateway';
import { useTopSignals } from '../../hooks/useSignals';
import TickerLogo from './TickerLogo';

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

// 기본 4종목 칩 (목업 기준)
const DEFAULT_SYMBOLS = [
  { symbol: '005930', name: '삼성전자', market: 'kr' },
  { symbol: '000660', name: 'SK하이닉스', market: 'kr' },
  { symbol: 'NVDA', name: 'NVIDIA', market: 'us' },
  { symbol: 'BTC', name: '비트코인', market: 'crypto' },
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

export default function AiDebateSection({ watchedItems = [], usStocks = [], allItems = [] }) {
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
      setCached(item.symbol, data);
      setResult(data);
    } catch (e) {
      setError(e.message?.includes('503') ? 'AI 기능 미설정' : e.message);
    } finally {
      setLoading(false);
    }
  }, [usStocks]);

  // 자동 로드 제거 — 사용자가 종목 선택 시에만 토론 시작

  // 아코디언 근거 보기 상태
  const [showEvidence, setShowEvidence] = useState(false);

  // 선택된 종목의 관련 시그널 (useTopSignals에서 필터)
  const topSignals = useTopSignals(20);
  const relatedSignals = useMemo(() => {
    if (!selected) return [];
    return topSignals.filter(s => s.symbol === selected.symbol).slice(0, 3);
  }, [topSignals, selected]);

  const summary = extractSummary(result);
  const confPct = Math.round((summary?.confidence ?? 0.5) * 100);

  return (
    <div className="bg-white rounded-2xl p-5">
      {/* 헤더 */}
      <div className="mb-3">
        <h2 className="text-[19px] font-bold text-[#191F28] tracking-tight">AI 종목토론</h2>
      </div>

      {/* 종목 선택 칩 (TickerLogo 포함) */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {symbolList.map(s => {
          // allItems에서 매칭하여 로고 표시용 item 구성
          const logoItem = allItems.find(i => i.symbol === s.symbol || i.id === s.symbol) || { symbol: s.symbol, name: s.name, _market: s.market === 'kr' ? 'KR' : s.market === 'us' ? 'US' : s.market === 'crypto' ? 'COIN' : '' };
          return (
            <button
              key={s.symbol}
              onClick={() => {
                setSelected(s);
                setResult(null);
                runDebate(s);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all ${
                selected?.symbol === s.symbol
                  ? 'bg-[#191F28] text-white border-[#191F28]'
                  : 'bg-white text-[#4E5968] border-[#F2F3F5] hover:border-[#B0B8C1]'
              }`}
            >
              <TickerLogo item={logoItem} size={18} />
              {s.name}
            </button>
          );
        })}
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

      {/* 살 이유 / 조심할 이유 + 아코디언 근거 보기 */}
      {summary && !error && (
        <div className="space-y-2.5">
          <div className="rounded-xl px-[18px] py-4" style={{ background: 'rgba(240,68,82,0.03)' }}>
            <div className="text-[13px] font-bold text-[#F04452] mb-2">살 이유</div>
            <div className="text-[14px] text-[#4E5968] leading-relaxed">{summary.bull || '분석 중...'}</div>
          </div>
          <div className="rounded-xl px-[18px] py-4" style={{ background: 'rgba(23,100,237,0.03)' }}>
            <div className="text-[13px] font-bold text-[#1764ED] mb-2">조심할 이유</div>
            <div className="text-[14px] text-[#4E5968] leading-relaxed">{summary.bear || '분석 중...'}</div>
          </div>

          {/* 근거 보기 아코디언 */}
          {relatedSignals.length > 0 && (
            <div>
              <button
                onClick={() => setShowEvidence(v => !v)}
                className="flex items-center gap-1 text-[12px] font-semibold text-[#8B95A1] hover:text-[#4E5968] transition-colors py-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  className={`transition-transform duration-200 ${showEvidence ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
                근거 보기
              </button>
              {showEvidence && (
                <div className="mt-1.5 rounded-lg bg-[#F7F8FA] px-3 py-2.5 space-y-2">
                  <div className="text-[11px] font-bold text-[#4E5968] mb-1">관련 시그널</div>
                  {relatedSignals.map((sig, i) => {
                    const isBull = sig.direction === 'bullish';
                    return (
                      <div key={sig.id || `ev-${i}`} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: isBull ? '#FFF0F1' : '#EDF4FF', color: isBull ? '#F04452' : '#1764ED' }}>
                          {isBull ? '강세' : '약세'}
                        </span>
                        <span className="text-[12px] text-[#191F28] font-medium truncate flex-1">{sig.name || sig.symbol}</span>
                        <div className="flex gap-[2px] flex-shrink-0">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <i key={j} className="block w-[4px] h-[4px] rounded-full" style={{ background: isBull ? '#F04452' : '#1764ED', opacity: j < (sig.strength || 0) ? 1 : 0.15 }} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 확신도 바 */}
          <div className="flex items-center gap-2.5 mt-3.5">
            <span className="text-[13px] font-bold tabular-nums" style={{ color: '#F04452' }}>
              매수 {confPct}%
            </span>
            <div className="flex-1 h-1.5 rounded-[3px] overflow-hidden" style={{ background: 'rgba(23,100,237,0.10)' }}>
              <div
                className="h-full rounded-[3px] transition-all duration-400"
                style={{ width: `${confPct}%`, background: '#F04452' }}
              />
            </div>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: '#1764ED' }}>
              관망 {100 - confPct}%
            </span>
          </div>

          {/* AI 종합 의견 */}
          {summary.verdict && (
            <div className="bg-[#F7F8FA] rounded-lg p-2.5 mt-1">
              <span className="text-[10px] text-[#8B95A1]">AI 종합: </span>
              <span className="text-[11px] text-[#191F28] font-medium">{summary.verdict}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
