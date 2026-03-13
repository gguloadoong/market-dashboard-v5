import { useState, useEffect, useRef, useMemo } from 'react';
import { fmtPrice, fmtPct, fmt, fmtLarge, getPct, arrow, barPos } from '../utils/format';
import { fetchCandles } from '../api/chart';

const PERIODS = ['1주', '1달', '3달', '1년'];

// ─── SVG 캔들차트 ──────────────────────────────────────────────
function CandleChart({ candles, loading }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(340);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setWidth(e[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (loading) {
    return (
      <div ref={containerRef} className="w-full h-44 flex items-center justify-center">
        <div className="text-[12px] text-text3">차트 로딩 중...</div>
      </div>
    );
  }
  if (!candles?.length) {
    return (
      <div ref={containerRef} className="w-full h-44 flex items-center justify-center">
        <div className="text-[12px] text-text3">차트 데이터 없음</div>
      </div>
    );
  }

  const H = 160;
  const PAD = { top: 8, bottom: 24, left: 4, right: 4 };
  const innerH = H - PAD.top - PAD.bottom;
  const innerW = width - PAD.left - PAD.right;

  const highs  = candles.map(c => c.high  ?? c.close);
  const lows   = candles.map(c => c.low   ?? c.close);
  const minP   = Math.min(...lows)   * 0.9995;
  const maxP   = Math.max(...highs)  * 1.0005;
  const range  = maxP - minP || 1;

  const toY = v => PAD.top + (1 - (v - minP) / range) * innerH;
  const n   = candles.length;
  const step = innerW / n;
  const bodyW = Math.max(2, step * 0.55);
  const toX   = i => PAD.left + (i + 0.5) * step;

  // x-axis labels (show ~5)
  const labelStep = Math.max(1, Math.floor(n / 5));

  return (
    <div ref={containerRef} className="w-full">
      <svg viewBox={`0 0 ${width} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f}
            x1={PAD.left} y1={PAD.top + innerH * f}
            x2={width - PAD.right} y2={PAD.top + innerH * f}
            stroke="#F2F4F6" strokeWidth={0.8}
          />
        ))}

        {/* Candles */}
        {candles.map((c, i) => {
          const x    = toX(i);
          const isUp = (c.close ?? 0) >= (c.open ?? 0);
          const col  = isUp ? '#F04452' : '#1764ED';
          const yHigh  = toY(c.high  ?? c.close);
          const yLow   = toY(c.low   ?? c.close);
          const yOpen  = toY(c.open  ?? c.close);
          const yClose = toY(c.close ?? c.open);
          const bodyY  = Math.min(yOpen, yClose);
          const bodyH  = Math.max(1, Math.abs(yClose - yOpen));

          return (
            <g key={i}>
              <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={col} strokeWidth={0.9} />
              <rect x={x - bodyW / 2} y={bodyY} width={bodyW} height={bodyH}
                fill={isUp ? col : col} rx={0.5} />
            </g>
          );
        })}

        {/* X-axis labels */}
        {candles.map((c, i) => i % labelStep === 0 && (
          <text key={i}
            x={toX(i)} y={H - 4}
            textAnchor="middle"
            fontSize={9} fill="#B0B8C1"
          >{c.time}</text>
        ))}
      </svg>
    </div>
  );
}

// ─── 투자자 자금흐름 시뮬레이션 ───────────────────────────────
function genInvestorFlow(symbol, days = 20) {
  // symbol을 시드로 사용해서 같은 종목은 같은 패턴
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng  = (i) => {
    const x = Math.sin(seed + i) * 43758.5453;
    return x - Math.floor(x);
  };

  const flows = [];
  let foreignBias = (rng(0) - 0.5) * 1.5;
  let instBias    = (rng(1) - 0.5) * 1.5;

  let dayCount = 0;
  for (let i = 0; flows.length < days; i++) {
    const date = new Date('2026-03-13');
    date.setDate(date.getDate() - (days - flows.length) * 1.5 + i * 1);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // 주말 skip

    const r1 = rng(dayCount * 3);
    const r2 = rng(dayCount * 3 + 1);
    const r3 = rng(dayCount * 3 + 2);

    const foreignNet     = Math.round((foreignBias + (r1 - 0.5) * 2.5) * 30) * 1e8;
    const institutionalNet = Math.round((instBias    + (r2 - 0.5) * 2.0) * 20) * 1e8;
    const individualNet  = -(foreignNet + institutionalNet) + Math.round((r3 - 0.5) * 10) * 1e8;

    foreignBias = Math.max(-2, Math.min(2, foreignBias + (rng(dayCount * 5) - 0.5) * 0.4));
    instBias    = Math.max(-2, Math.min(2, instBias    + (rng(dayCount * 5 + 1) - 0.5) * 0.4));

    flows.push({
      date:          `${date.getMonth() + 1}/${date.getDate()}`,
      individual:    individualNet,
      foreign:       foreignNet,
      institutional: institutionalNet,
    });
    dayCount++;
  }
  return flows;
}

function analyzeFlow(flows) {
  if (!flows.length) return '';
  const last5 = flows.slice(-5);
  const foreignSum = last5.reduce((s, f) => s + f.foreign, 0);
  const instSum    = last5.reduce((s, f) => s + f.institutional, 0);

  let foreignConsec = 0;
  const foreignDir = flows[flows.length - 1].foreign > 0;
  for (let i = flows.length - 1; i >= 0; i--) {
    if ((flows[i].foreign > 0) === foreignDir) foreignConsec++;
    else break;
  }

  const fmtBn = v => {
    const abs = Math.abs(v);
    if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}조원`;
    if (abs >= 1e8)  return `${Math.round(v / 1e8)}억원`;
    return `${v}원`;
  };

  const parts = [];
  if (foreignConsec >= 3) {
    parts.push(`외국인이 ${foreignConsec}일 연속 순${foreignDir ? '매수' : '매도'} (최근 5일 합계 ${fmtBn(foreignSum)})`);
  } else {
    parts.push(`외국인 최근 5일간 순${foreignSum > 0 ? '매수' : '매도'} ${fmtBn(foreignSum)}`);
  }

  if (Math.abs(instSum) > 5e9) {
    parts.push(`기관은 ${instSum > 0 ? '매집' : '차익 실현'} 흐름 (${fmtBn(instSum)})`);
  }

  if (foreignSum > 0 && instSum > 0) {
    parts.push('외국인·기관 동반 매수로 단기 상승 모멘텀 우호적');
  } else if (foreignSum < 0 && instSum < 0) {
    parts.push('외국인·기관 동반 매도로 단기 하락 압력 높음. 개인 저가 매수 여부 주시 필요');
  } else if (foreignSum > 0 && instSum < 0) {
    parts.push('외국인 매수에도 기관 차익 실현으로 상승폭 제한적. 기관 매도 소진 여부 관찰 필요');
  } else {
    parts.push('기관의 저가 매집 흐름. 외국인 복귀 시 상승 전환 가능성');
  }

  return parts.join('. ') + '.';
}

// ─── 투자자동향 바 차트 ────────────────────────────────────────
function FlowChart({ flows }) {
  const maxAbs = Math.max(...flows.map(f => Math.max(Math.abs(f.foreign), Math.abs(f.institutional), Math.abs(f.individual))));

  const fmtBn = v => {
    const abs = Math.abs(v);
    if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
    if (abs >= 1e8)  return `${Math.round(v / 1e8)}억`;
    return '0';
  };

  return (
    <div className="space-y-0">
      {/* Legend */}
      <div className="flex gap-3 px-4 py-2 text-[11px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3182F6]" />외국인</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00B493]" />기관</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F04452]" />개인</span>
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div style={{ minWidth: `${flows.length * 28}px` }} className="px-2">
          {/* Bar area */}
          <div className="flex items-end gap-0.5" style={{ height: 120 }}>
            {flows.map((f, i) => {
              const toH = v => Math.max(2, (Math.abs(v) / maxAbs) * 56);
              return (
                <div key={i} className="flex flex-col items-center gap-0" style={{ flex: 1 }}>
                  {/* Upper (positive) */}
                  <div className="flex items-end gap-px" style={{ height: 60 }}>
                    {[
                      { v: f.foreign,       col: '#3182F6' },
                      { v: f.institutional, col: '#00B493' },
                      { v: f.individual,    col: '#F04452' },
                    ].map(({ v, col }, j) => (
                      <div key={j} style={{
                        width: 5,
                        height: v > 0 ? toH(v) : 0,
                        background: col,
                        alignSelf: 'flex-end',
                        borderRadius: '1px 1px 0 0',
                      }} />
                    ))}
                  </div>
                  {/* Center line */}
                  <div style={{ width: '100%', height: 1, background: '#E5E8EB' }} />
                  {/* Lower (negative) */}
                  <div className="flex items-start gap-px" style={{ height: 60 }}>
                    {[
                      { v: f.foreign,       col: '#3182F6' },
                      { v: f.institutional, col: '#00B493' },
                      { v: f.individual,    col: '#F04452' },
                    ].map(({ v, col }, j) => (
                      <div key={j} style={{
                        width: 5,
                        height: v < 0 ? toH(v) : 0,
                        background: col,
                        opacity: 0.55,
                        alignSelf: 'flex-start',
                        borderRadius: '0 0 1px 1px',
                      }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* X labels */}
          <div className="flex gap-0.5 mt-1">
            {flows.map((f, i) => (
              <div key={i} style={{ flex: 1 }} className="text-center text-[8px] text-text3">
                {i % 4 === 0 ? f.date : ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 총계 요약 */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        {[
          { label: '외국인', value: flows.slice(-5).reduce((s, f) => s + f.foreign, 0), col: '#3182F6' },
          { label: '기관',   value: flows.slice(-5).reduce((s, f) => s + f.institutional, 0), col: '#00B493' },
          { label: '개인',   value: flows.slice(-5).reduce((s, f) => s + f.individual, 0), col: '#F04452' },
        ].map(({ label, value, col }) => (
          <div key={label} className="bg-[#F7F8FA] rounded-xl px-3 py-2">
            <div className="text-[10px] text-text3 mb-0.5">{label} (5일)</div>
            <div className="text-[13px] font-semibold tabular-nums" style={{ color: value > 0 ? '#F04452' : value < 0 ? '#1764ED' : '#6B7684' }}>
              {value > 0 ? '+' : ''}{fmtBn(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 메인 모달 ────────────────────────────────────────────────
export default function StockModal({ item, coinUnit = 'usd', onClose }) {
  const [tab,     setTab]     = useState('차트');
  const [period,  setPeriod]  = useState('1달');
  const [candles, setCandles] = useState([]);
  const [candleLoading, setCandleLoading] = useState(false);

  const isKr   = item?.market === 'kr';
  const isCoin = !!item?.id;
  const flows  = useMemo(() => isKr && item ? genInvestorFlow(item.symbol, 20) : [], [item?.symbol, isKr]);
  const analysis = useMemo(() => analyzeFlow(flows), [flows]);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    if (!item || tab !== '차트') return;
    setCandleLoading(true);
    setCandles([]);
    fetchCandles(item, period)
      .then(data => { setCandles(data); setCandleLoading(false); })
      .catch(() => {
        // 실패 시 스파크라인으로 대체 캔들 생성
        const spark = item.sparkline ?? [];
        const fake  = spark.map((close, i) => ({
          time:  `D${i + 1}`,
          open:  spark[i - 1] ?? close,
          high:  close * 1.005,
          low:   close * 0.995,
          close,
        }));
        setCandles(fake);
        setCandleLoading(false);
      });
  }, [item?.symbol ?? item?.id, period, tab]);

  if (!item) return null;

  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const priceColor = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const high   = isCoin ? item.high24h : item.high52w;
  const low    = isCoin ? item.low24h  : item.low52w;
  const curPrice = isCoin
    ? (coinUnit === 'krw' ? item.priceKrw : item.priceUsd)
    : item.price;

  const TABS = isKr ? ['차트', '투자자동향', '기본정보'] : ['차트', '기본정보'];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-2 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[19px] text-text1">{item.name}</span>
              <span className="text-[11px] text-text3 bg-[#F2F4F6] px-2 py-0.5 rounded-full">
                {isCoin ? item.symbol : item.symbol}
              </span>
              {item.sector && (
                <span className="text-[11px] text-text3 bg-[#F2F4F6] px-2 py-0.5 rounded-full">{item.sector}</span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-bold text-[24px] text-text1 tabular-nums">
                {fmtPrice(item, coinUnit)}
              </span>
              <span className="font-semibold text-[14px] tabular-nums" style={{ color: priceColor }}>
                {arrow(pct)} {fmtPct(pct)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-text3 hover:text-text1 text-xl mt-1">✕</button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-[#F2F4F6] px-5">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2.5 mr-5 text-[13px] font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-[#191F28] text-text1'
                  : 'border-transparent text-text3 hover:text-text2'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 160px)' }}>

          {/* ── 차트 탭 ── */}
          {tab === '차트' && (
            <div>
              {/* 기간 선택 */}
              <div className="flex gap-2 px-5 py-3">
                {PERIODS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-colors ${
                      period === p
                        ? 'bg-[#191F28] text-white'
                        : 'bg-[#F2F4F6] text-text2 hover:bg-[#E5E8EB]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* 캔들 차트 */}
              <div className="px-2 pb-2">
                <CandleChart candles={candles} loading={candleLoading} />
              </div>

              {/* 가격 범위 바 */}
              {high && low && (
                <div className="px-5 py-3 border-t border-[#F2F4F6]">
                  <div className="flex justify-between text-[12px] text-text2 mb-1.5">
                    <span className="text-down tabular-nums">
                      {isCoin ? `$${Number(low).toFixed(4)}` : fmtPrice({ ...item, price: low }, coinUnit)}
                    </span>
                    <span className="text-text3 text-[11px]">{isCoin ? '24시간 범위' : '52주 범위'}</span>
                    <span className="text-up tabular-nums">
                      {isCoin ? `$${Number(high).toFixed(4)}` : fmtPrice({ ...item, price: high }, coinUnit)}
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-gray-100 rounded-full">
                    <div className="absolute inset-0 bg-gradient-to-r from-down via-gray-200 to-up rounded-full opacity-30" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full shadow"
                      style={{ borderColor: priceColor, left: `calc(${barPos(curPrice, low, high)}% - 6px)` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 투자자동향 탭 (국장 전용) ── */}
          {tab === '투자자동향' && isKr && (
            <div>
              <div className="px-5 py-3 border-b border-[#F2F4F6]">
                <div className="text-[12px] font-semibold text-text1 mb-0.5">최근 20거래일 수급</div>
                <div className="text-[11px] text-text3">투자자별 순매수/순매도 (억원)</div>
              </div>
              <FlowChart flows={flows} />
              {/* AI 해석 */}
              <div className="mx-4 mb-4 mt-2 bg-[#F0F6FF] border border-[#DCEAFF] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] font-bold text-[#3182F6]">AI 수급 분석</span>
                  <span className="text-[10px] text-text3 bg-[#E8F0FF] px-1.5 py-0.5 rounded-full">시뮬레이션</span>
                </div>
                <p className="text-[13px] text-text1 leading-relaxed">{analysis}</p>
              </div>
            </div>
          )}

          {/* ── 기본정보 탭 ── */}
          {tab === '기본정보' && (
            <div className="grid grid-cols-2 gap-2 px-4 py-4">
              {[
                { label: '거래량',   value: fmtLarge(isCoin ? item.volume24h : item.volume) },
                { label: '시가총액', value: fmtLarge(item.marketCap) },
                isCoin && item.priceKrw && { label: 'KRW 환산', value: `₩${fmt(Math.round(item.priceKrw))}` },
                isCoin && { label: '24h 고가', value: item.high24h ? `$${Number(item.high24h).toFixed(2)}` : '—' },
                isCoin && { label: '24h 저가', value: item.low24h  ? `$${Number(item.low24h).toFixed(2)}`  : '—' },
                !isCoin && { label: '52주 고가', value: item.high52w ? fmtPrice({ ...item, price: item.high52w }, coinUnit) : '—' },
                !isCoin && { label: '52주 저가', value: item.low52w  ? fmtPrice({ ...item, price: item.low52w  }, coinUnit) : '—' },
                item.sector && { label: '섹터', value: item.sector },
                item.nameEn && { label: '영문명', value: item.nameEn },
              ].filter(Boolean).map(row => (
                <div key={row.label} className="bg-[#F7F8FA] rounded-xl px-3 py-2.5">
                  <div className="text-[11px] text-text3 mb-0.5">{row.label}</div>
                  <div className="text-[13px] font-semibold text-text1 tabular-nums">{row.value || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
