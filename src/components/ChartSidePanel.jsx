// 종목 상세 차트 사이드 패널 — lightweight-charts 사용
import { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { fetchCandles } from '../api/chart';
import { fetchAllNews } from '../api/news';

const PERIODS = ['1W', '1M', '3M', '1Y'];
const PERIOD_LABEL = { '1W': '1주', '1M': '1달', '3M': '3달', '1Y': '1년' };
const PERIOD_MAP   = { '1W': '1주', '1M': '1달', '3M': '3달', '1Y': '1년' };

function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtKrwPrice(item, krwRate) {
  if (item.id) {
    const p = item.priceKrw || item.priceUsd * krwRate;
    if (!p) return '—';
    if (p < 1) return `₩${p.toFixed(6)}`;
    if (p < 100) return `₩${fmt(p, 2)}`;
    return `₩${fmt(Math.round(p))}`;
  }
  if (item.market === 'kr') return `₩${fmt(item.price)}`;
  if (item.market === 'us') return `₩${fmt(Math.round(item.price * krwRate))}`;
  return `₩${fmt(item.price)}`;
}

function getPct(item) {
  return item.id ? (item.change24h ?? 0) : (item.changePct ?? 0);
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ─── 차트 컴포넌트 ──────────────────────────────────────────
function LightweightChart({ candles, loading, type }) {
  const containerRef    = useRef(null);
  const chartRef        = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 기존 차트 제거
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    if (!candles || candles.length === 0) return;

    // 차트 생성
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#B0B8C1',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#F2F4F6' },
        horzLines: { color: '#F2F4F6' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#E5E8EB' },
      timeScale: {
        borderColor: '#E5E8EB',
        timeVisible: false,
      },
      width:  containerRef.current.clientWidth,
      height: 300,
    });
    chartRef.current = chart;

    // 가격 시리즈
    if (type === 'candle') {
      const candleSeries = chart.addCandlestickSeries({
        upColor:       '#F04452',
        downColor:     '#1764ED',
        borderVisible: false,
        wickUpColor:   '#F04452',
        wickDownColor: '#1764ED',
      });
      candleSeries.setData(candles);
      candleSeriesRef.current = candleSeries;
    } else {
      const isOverallUp = candles.length > 1 && candles[candles.length - 1].close >= candles[0].close;
      const lineColor   = isOverallUp ? '#F04452' : '#1764ED';
      const lineSeries  = chart.addLineSeries({
        color:       lineColor,
        lineWidth:   2,
        crosshairMarkerVisible: true,
      });
      lineSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
      // 면적 그라디언트
      const areaSeries = chart.addAreaSeries({
        topColor:    lineColor + '22',
        bottomColor: lineColor + '00',
        lineColor:   'transparent',
        lineWidth:   0,
      });
      areaSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
    }

    // 볼륨 시리즈
    if (candles[0]?.volume != null) {
      const volumeSeries = chart.addHistogramSeries({
        color: '#E5E8EB',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volumeSeries.setData(candles.map(c => ({
        time:  c.time,
        value: c.volume ?? 0,
        color: (c.close ?? 0) >= (c.open ?? 0) ? '#F0445222' : '#1764ED22',
      })));
      volumeSeriesRef.current = volumeSeries;
    }

    chart.timeScale().fitContent();

    // 리사이즈 대응
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, type]);

  if (loading) {
    return (
      <div ref={containerRef} className="w-full h-[300px] flex items-center justify-center bg-[#FAFBFC] rounded-xl">
        <div className="text-[13px] text-[#B0B8C1]">차트 로딩 중...</div>
      </div>
    );
  }
  if (!candles || candles.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-[300px] flex items-center justify-center bg-[#FAFBFC] rounded-xl">
        <div className="text-[13px] text-[#B0B8C1]">차트 데이터 없음</div>
      </div>
    );
  }
  return <div ref={containerRef} className="w-full" />;
}

// ─── 메인 패널 ──────────────────────────────────────────────
export default function ChartSidePanel({ item, krwRate = 1466, onClose }) {
  const [period,  setPeriod]  = useState('1M');
  const [candles, setCandles] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartType, setChartType] = useState('candle');
  const [news,    setNews]    = useState([]);

  const pct    = item ? getPct(item) : 0;
  const isUp   = pct > 0;
  const isDown = pct < 0;

  // ESC 닫기
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 차트 데이터 로드
  useEffect(() => {
    if (!item) return;
    setChartLoading(true);
    setCandles([]);
    fetchCandles(item, PERIOD_MAP[period])
      .then(data => setCandles(data))
      .catch(() => {
        // 스파크라인 데이터로 fallback
        const spark = item.sparkline ?? [];
        const today = new Date();
        const fake  = spark.map((close, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (spark.length - 1 - i));
          return {
            time:  d.toISOString().split('T')[0],
            open:  spark[i - 1] ?? close,
            high:  close * 1.005,
            low:   close * 0.995,
            close,
          };
        });
        setCandles(fake);
      })
      .finally(() => setChartLoading(false));
  }, [item?.symbol, item?.id, period]);

  // 관련 뉴스 로드
  useEffect(() => {
    if (!item) return;
    fetchAllNews()
      .then(all => {
        const kws = [item.name, item.symbol, item.nameEn].filter(Boolean).map(k => k.toLowerCase());
        const filtered = all.filter(n =>
          kws.some(k => n.title.toLowerCase().includes(k))
        );
        setNews(filtered.length > 0 ? filtered.slice(0, 4) : all.slice(0, 4));
      })
      .catch(() => setNews([]));
  }, [item?.symbol, item?.id]);

  if (!item) return null;

  const isCoin = !!item.id;
  const high   = isCoin ? item.high24h : item.high52w;
  const low    = isCoin ? item.low24h  : item.low52w;
  const volume = isCoin ? item.volume24h : item.volume;
  const mcap   = item.marketCap;

  const infoRows = [
    { label: '거래량',   value: volume ? `${(volume / 1e6).toFixed(2)}M` : '—' },
    { label: '시가총액', value: mcap ? (mcap >= 1e12 ? `${(mcap / 1e12).toFixed(1)}조` : `${(mcap / 1e8).toFixed(0)}억`) : '—' },
    isCoin
      ? { label: '24h 고가', value: high ? `$${Number(high).toFixed(2)}` : '—' }
      : { label: '52주 고가', value: high ? fmtKrwPrice({ ...item, price: high }, krwRate) : '—' },
    isCoin
      ? { label: '24h 저가', value: low ? `$${Number(low).toFixed(2)}` : '—' }
      : { label: '52주 저가', value: low ? fmtKrwPrice({ ...item, price: low }, krwRate) : '—' },
    item.sector && { label: '섹터', value: item.sector },
    item.nameEn && { label: '영문명', value: item.nameEn },
  ].filter(Boolean);

  return (
    <>
      {/* 딤 오버레이 (클릭 시 닫기) */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* 패널 */}
      <div
        className="fixed top-[56px] right-0 z-50 bg-white shadow-2xl flex flex-col"
        style={{
          width: 'min(600px, 45vw)',
          height: 'calc(100vh - 56px)',
          borderLeft: '1px solid #E5E8EB',
          animation: 'slideInRight 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-[#F2F4F6]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[20px] font-bold text-[#191F28]">{item.name}</span>
                <span className="text-[12px] text-[#B0B8C1] bg-[#F2F4F6] px-2 py-0.5 rounded-full">{item.symbol}</span>
                {item.sector && <span className="text-[11px] text-[#B0B8C1] bg-[#F2F4F6] px-2 py-0.5 rounded-full">{item.sector}</span>}
              </div>
              <div className="flex items-baseline gap-3 mt-1.5">
                <span className="text-[26px] font-bold text-[#191F28] tabular-nums font-mono">
                  {fmtKrwPrice(item, krwRate)}
                </span>
                <span className={`text-[16px] font-semibold tabular-nums font-mono ${isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#6B7684]'}`}>
                  {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(pct).toFixed(2)}%
                </span>
              </div>
              {item.market === 'us' && item.price && (
                <div className="text-[13px] text-[#B0B8C1] mt-0.5">${fmt(item.price, 2)} USD</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-[#B0B8C1] hover:text-[#191F28] text-xl p-1 mt-1 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto">
          {/* 기간 + 차트 타입 */}
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex gap-1.5">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                    period === p ? 'bg-[#191F28] text-white' : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]'
                  }`}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {['candle', 'line'].map(t => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                    chartType === t ? 'bg-[#191F28] text-white' : 'bg-[#F2F4F6] text-[#6B7684]'
                  }`}
                >
                  {t === 'candle' ? '캔들' : '라인'}
                </button>
              ))}
            </div>
          </div>

          {/* 차트 */}
          <div className="px-4 pb-2">
            <LightweightChart candles={candles} loading={chartLoading} type={chartType} />
          </div>

          {/* 종목 정보 그리드 */}
          <div className="mx-5 mb-4 border border-[#F2F4F6] rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-[#F2F4F6]">
              {infoRows.map((row, i) => (
                <div
                  key={row.label}
                  className={`px-4 py-3 ${i % 4 < 2 ? 'bg-[#F8F9FA]' : 'bg-white'}`}
                >
                  <div className="text-[11px] text-[#B0B8C1] mb-0.5">{row.label}</div>
                  <div className="text-[14px] font-semibold text-[#191F28] tabular-nums font-mono">{row.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 관련 뉴스 */}
          {news.length > 0 && (
            <div className="mx-5 mb-6">
              <div className="text-[13px] font-semibold text-[#191F28] mb-2">📰 관련 뉴스</div>
              <div className="border border-[#F2F4F6] rounded-xl overflow-hidden">
                {news.map((n, i) => {
                  const isBreaking = (Date.now() - new Date(n.pubDate)) < 3600000;
                  return (
                    <a
                      key={n.id || i}
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 px-4 py-3 border-b border-[#F2F4F6] last:border-0 hover:bg-[#FAFBFC] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {isBreaking && (
                            <span className="text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] px-1.5 py-0.5 rounded">🔴 속보</span>
                          )}
                          <span className="text-[11px] text-[#B0B8C1]">{n.source} · {n.timeAgo}</span>
                        </div>
                        <div className="text-[13px] font-medium text-[#191F28] line-clamp-2">{n.title}</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
