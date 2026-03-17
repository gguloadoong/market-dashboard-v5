import { useState, useEffect, useRef, useMemo } from 'react';
import { fmtPrice, fmtPct, fmt, fmtLarge, getPct, arrow, barPos } from '../utils/format';
import { fetchCandles } from '../api/chart';
import { fetchAllNews } from '../api/news';
import { getRelatedAssets, MARKET_FLAG } from '../data/relatedAssets';

const PERIODS = ['1주', '1달', '3달', '1년'];

// ─── 종목별 한국어 키워드 매핑 ────────────────────────────────
const KR_KEYWORD_MAP = {
  // 코인
  BTC:    ['비트코인', '비트', 'BTC'],
  ETH:    ['이더리움', '이더', 'ETH'],
  SOL:    ['솔라나', 'SOL'],
  XRP:    ['리플', 'XRP'],
  BNB:    ['바이낸스코인', 'BNB'],
  DOGE:   ['도지코인', '도지', 'DOGE'],
  ADA:    ['카르다노', 'ADA'],
  AVAX:   ['아발란체', 'AVAX'],
  LINK:   ['체인링크', 'LINK'],
  DOT:    ['폴카닷', 'DOT'],
  MATIC:  ['폴리곤', 'MATIC'],
  SHIB:   ['시바이누', 'SHIB'],
  ARB:    ['아비트럼', 'ARB'],
  OP:     ['옵티미즘', 'OP'],
  ATOM:   ['코스모스', 'ATOM'],
  APT:    ['앱토스', 'APT'],
  // 미국 주식
  NVDA:   ['엔비디아', 'NVIDIA', 'NVDA'],
  AAPL:   ['애플', 'Apple', 'AAPL'],
  TSLA:   ['테슬라', 'Tesla', 'TSLA'],
  MSFT:   ['마이크로소프트', 'Microsoft', 'MSFT'],
  GOOGL:  ['구글', '알파벳', 'Google', 'Alphabet'],
  AMZN:   ['아마존', 'Amazon', 'AMZN'],
  META:   ['메타', '페이스북', 'Meta', 'Facebook'],
  AMD:    ['AMD', '에이엠디'],
  TSM:    ['TSMC', '대만반도체'],
  COIN:   ['코인베이스', 'Coinbase'],
  MSTR:   ['마이크로스트래티지', 'MicroStrategy'],
  INTC:   ['인텔', 'Intel', 'INTC'],
  NFLX:   ['넷플릭스', 'Netflix', 'NFLX'],
  QCOM:   ['퀄컴', 'Qualcomm', 'QCOM'],
  AVGO:   ['브로드컴', 'Broadcom', 'AVGO'],
  // 국내 주식
  '005930': ['삼성전자', '삼성'],
  '000660': ['SK하이닉스', '하이닉스'],
  '035420': ['네이버', 'NAVER'],
  '035720': ['카카오'],
  '207940': ['삼성바이오로직스'],
  '068270': ['셀트리온'],
  '005380': ['현대차', '현대자동차'],
  '000270': ['기아'],
  '373220': ['LG에너지솔루션', 'LG엔솔'],
  '006400': ['삼성SDI'],
  '051910': ['LG화학'],
  '247540': ['에코프로비엠', '에코프로'],
};

// 섹터별 뉴스 키워드
const SECTOR_KEYWORDS = {
  '반도체':   ['반도체', 'HBM', 'AI칩', '파운드리'],
  '배터리':   ['배터리', '전기차', 'EV', '리튬'],
  '바이오':   ['바이오', '신약', '임상'],
  '플랫폼':   ['플랫폼', 'AI', '인터넷'],
  '빅테크':   ['AI', '인공지능', '빅테크', '클라우드'],
  '테크':     ['AI', '인공지능', '반도체', '클라우드'],
  '금융':     ['금리', '은행', '증권'],
  'EV':       ['전기차', 'EV', '자동차', '배터리'],
  '자동차':   ['자동차', '전기차', 'EV'],
  '2차전지소재': ['배터리', '양극재', '전기차', 'EV'],
  '화학':     ['화학', '배터리', '소재'],
  '밈코인':   ['밈코인', '도지', 'DOGE', 'SHIB'],
  '레이어2':  ['레이어2', '이더리움', 'ETH'],
  'DeFi':     ['디파이', 'DeFi', '이더리움'],
};

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
        {/* 격자선 */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f}
            x1={PAD.left} y1={PAD.top + innerH * f}
            x2={width - PAD.right} y2={PAD.top + innerH * f}
            stroke="#F2F4F6" strokeWidth={0.8}
          />
        ))}

        {/* 캔들 */}
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
                fill={col} rx={0.5} />
            </g>
          );
        })}

        {/* X축 레이블 */}
        {candles.map((c, i) => i % labelStep === 0 && (
          <text key={i}
            x={toX(i)} y={H - 4}
            textAnchor="middle"
            fontSize={10} fill="#B0B8C1"
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
      {/* 범례 */}
      <div className="flex gap-3 px-4 py-2 text-[11px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3182F6]" />외국인</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00B493]" />기관</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F04452]" />개인</span>
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div style={{ minWidth: `${flows.length * 28}px` }} className="px-2">
          {/* 바 영역 */}
          <div className="flex items-end gap-0.5" style={{ height: 120 }}>
            {flows.map((f, i) => {
              const toH = v => Math.max(2, (Math.abs(v) / maxAbs) * 56);
              return (
                <div key={i} className="flex flex-col items-center gap-0" style={{ flex: 1 }}>
                  {/* 상단 (양수) */}
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
                  {/* 중앙선 */}
                  <div style={{ width: '100%', height: 1, background: '#E5E8EB' }} />
                  {/* 하단 (음수) */}
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
          {/* X 레이블 */}
          <div className="flex gap-0.5 mt-1">
            {flows.map((f, i) => (
              <div key={i} style={{ flex: 1 }} className="text-center text-[10px] text-text3">
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

// ─── 연관종목 그룹 헤더 레이블 ────────────────────────────────
const TYPE_LABEL = {
  etf:    'ETF',
  stock:  '관련 주식',
  coin:   '관련 코인',
  sector: '동일 섹터',
  index:  '관련 지수',
};

// ─── 연관종목 탭 컴포넌트 ─────────────────────────────────────
function RelatedTab({ item, onRelatedClick }) {
  const sym = item?.symbol || item?.id || '';
  // 심볼 대문자 우선, 한글명도 시도
  const related = useMemo(() => {
    const r = getRelatedAssets(sym.toUpperCase()) || getRelatedAssets(sym);
    if (r.length) return r;
    // 국장 종목코드 조회 시도
    return getRelatedAssets(sym);
  }, [sym]);

  if (!related.length) {
    return (
      <div className="px-5 py-10 text-center text-[13px] text-text3">
        연관종목 데이터 없음
      </div>
    );
  }

  // 타입별 그룹화
  const groups = related.reduce((acc, r) => {
    const key = r.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  // 표시 순서: etf → stock → coin → sector → index
  const ORDER = ['etf', 'stock', 'coin', 'sector', 'index'];

  return (
    <div className="py-2">
      {ORDER.filter(t => groups[t]?.length).map(type => (
        <div key={type} className="mb-1">
          {/* 그룹 헤더 */}
          <div className="px-5 py-2">
            <span className="text-[11px] font-bold text-text3 uppercase tracking-wide">
              {TYPE_LABEL[type] || type}
            </span>
          </div>
          {/* 종목 목록 */}
          {groups[type].map((r, i) => {
            const flag = MARKET_FLAG[r.market] || '';
            return (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-3 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] active:bg-[#F2F4F6] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[15px] flex-shrink-0">{flag}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-text1">{r.symbol}</span>
                    </div>
                    <div className="text-[12px] text-text3 truncate mt-0.5">{r.reason}</div>
                  </div>
                </div>
                <button
                  onClick={() => onRelatedClick && onRelatedClick(r.symbol, r.market)}
                  className="flex-shrink-0 ml-3 text-[12px] text-[#3182F6] font-medium px-2.5 py-1 rounded-lg hover:bg-[#EEF4FF] active:bg-[#D9EAFF] transition-colors"
                >
                  상세보기 →
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── 기본정보 탭 컴포넌트 ─────────────────────────────────────
function InfoTab({ item, isCoin, coinUnit }) {
  const rows = [];

  if (isCoin) {
    // 코인 전용 정보
    rows.push(
      { label: '24h 거래량',    value: fmtLarge(item.volume24h) },
      { label: '시가총액',      value: fmtLarge(item.marketCap) },
      item.priceKrw && { label: 'KRW 환산', value: `₩${fmt(Math.round(item.priceKrw))}` },
      { label: '24h 고가',      value: item.high24h ? `$${Number(item.high24h).toFixed(2)}` : '—' },
      { label: '24h 저가',      value: item.low24h  ? `$${Number(item.low24h).toFixed(2)}`  : '—' },
      item.circulatingSupply != null && {
        label: '유통 공급량',
        value: fmtLarge(item.circulatingSupply),
      },
      item.totalSupply != null && {
        label: '총 공급량',
        value: fmtLarge(item.totalSupply),
      },
      item.maxSupply != null && {
        label: '최대 공급량',
        value: fmtLarge(item.maxSupply),
      },
      item.marketCapRank != null && {
        label: '코인 순위',
        value: `#${item.marketCapRank}`,
      },
      item.volume24hKrw != null && {
        label: '24h 거래대금',
        value: `₩${fmtLarge(item.volume24hKrw)}`,
      },
      item.priceChange1h != null && {
        label: '1시간 등락',
        value: `${item.priceChange1h > 0 ? '+' : ''}${Number(item.priceChange1h).toFixed(2)}%`,
      },
    );
  } else {
    // 주식 공통 정보
    rows.push(
      { label: '거래량',        value: fmtLarge(item.volume) },
      { label: '시가총액',      value: fmtLarge(item.marketCap) },
      { label: '52주 고가',     value: item.high52w ? fmtPrice({ ...item, price: item.high52w }, coinUnit) : '—' },
      { label: '52주 저가',     value: item.low52w  ? fmtPrice({ ...item, price: item.low52w  }, coinUnit) : '—' },
      item.open != null && {
        label: '시가',
        value: fmtPrice({ ...item, price: item.open }, coinUnit),
      },
      item.prevClose != null && {
        label: '전일 종가',
        value: fmtPrice({ ...item, price: item.prevClose }, coinUnit),
      },
      item.per != null && {
        label: 'PER',
        value: `${Number(item.per).toFixed(1)}x`,
      },
      item.pbr != null && {
        label: 'PBR',
        value: `${Number(item.pbr).toFixed(2)}x`,
      },
      item.dividendYield != null && {
        label: '배당률',
        value: `${Number(item.dividendYield).toFixed(2)}%`,
      },
      item.tradeValue != null && {
        label: '거래대금',
        value: fmtLarge(item.tradeValue),
      },
      item.sector && { label: '섹터',   value: item.sector },
      item.nameEn && { label: '영문명', value: item.nameEn },
    );
  }

  const validRows = rows.filter(Boolean);

  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-4">
      {validRows.map(row => (
        <div key={row.label} className="bg-[#F7F8FA] rounded-xl px-3 py-2.5">
          <div className="text-[11px] text-text3 mb-0.5">{row.label}</div>
          <div className="text-[13px] font-semibold text-text1 tabular-nums">{row.value || '—'}</div>
        </div>
      ))}
    </div>
  );
}

// ─── 메인 모달 ────────────────────────────────────────────────
export default function StockModal({ item, coinUnit = 'usd', onClose, onRelatedClick }) {
  const [tab,     setTab]     = useState('차트');
  const [period,  setPeriod]  = useState('1달');
  const [candles, setCandles] = useState([]);
  const [candleLoading, setCandleLoading] = useState(false);
  const [modalNews, setModalNews]       = useState([]);
  const [newsLoading, setNewsLoading]   = useState(false);

  const isKr   = item?.market === 'kr';
  const isCoin = !!item?.id;
  const flows  = useMemo(() => isKr && item ? genInvestorFlow(item.symbol, 20) : [], [item?.symbol, isKr]);
  const analysis = useMemo(() => analyzeFlow(flows), [flows]);

  // 탭 목록: KR = [차트, 투자자동향, 연관종목, 기본정보, 뉴스]
  //          US/코인 = [차트, 연관종목, 기본정보, 뉴스]
  const TABS = isKr
    ? ['차트', '투자자동향', '연관종목', '기본정보', '뉴스']
    : ['차트', '연관종목', '기본정보', '뉴스'];

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  // 아이템 변경 시 탭 초기화
  useEffect(() => {
    setTab('차트');
  }, [item?.symbol, item?.id]);

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

  // 뉴스 탭 선택 시 관련 뉴스 로드 (개선된 키워드 매칭)
  useEffect(() => {
    if (tab !== '뉴스' || !item) return;
    setNewsLoading(true);
    fetchAllNews()
      .then(all => {
        const sym = item.symbol || item.id || '';
        // 한국어 키워드 매핑 조회 (대문자, 원본 둘 다 시도)
        const extraKeywords = KR_KEYWORD_MAP[sym.toUpperCase()] || KR_KEYWORD_MAP[sym] || [];
        // 전체 키워드 집합 (중복 제거, 소문자 정규화)
        const allKeywords = [...new Set([
          item.name,
          item.symbol,
          item.nameEn,
          item.id,
          ...extraKeywords,
        ].filter(Boolean).map(k => k.toLowerCase()))];

        const filtered = all.filter(n =>
          allKeywords.some(k =>
            n.title.toLowerCase().includes(k) ||
            (n.description || '').toLowerCase().includes(k)
          )
        );

        if (filtered.length === 0) {
          // 섹터 키워드로 재시도
          const secKws = SECTOR_KEYWORDS[item.sector] || [];
          if (secKws.length > 0) {
            const sectorFiltered = all.filter(n =>
              secKws.some(k => n.title.toLowerCase().includes(k.toLowerCase()))
            );
            setModalNews(sectorFiltered.slice(0, 6));
          } else {
            // 완전히 매칭 없으면 빈 배열 (무관련 뉴스 노출 안 함)
            setModalNews([]);
          }
        } else {
          setModalNews(filtered.slice(0, 15));
        }
      })
      .catch(() => setModalNews([]))
      .finally(() => setNewsLoading(false));
  }, [tab, item?.symbol, item?.id]);

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
                {item.symbol}
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
        <div className="flex border-b border-[#F2F4F6] px-5 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2.5 mr-4 text-[13px] font-medium border-b-2 transition-colors flex-shrink-0 ${
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

          {/* ── 연관종목 탭 ── */}
          {tab === '연관종목' && (
            <RelatedTab item={item} onRelatedClick={onRelatedClick} />
          )}

          {/* ── 기본정보 탭 ── */}
          {tab === '기본정보' && (
            <InfoTab item={item} isCoin={isCoin} coinUnit={coinUnit} />
          )}

          {/* ── 뉴스 탭 ── */}
          {tab === '뉴스' && (
            <div>
              {newsLoading && (
                <div className="space-y-0">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex gap-3 px-5 py-3.5 border-b border-[#F2F4F6]">
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-[#F2F4F6] rounded w-1/4 animate-pulse" />
                        <div className="h-3.5 bg-[#F2F4F6] rounded animate-pulse" />
                        <div className="h-3.5 bg-[#F2F4F6] rounded w-5/6 animate-pulse" />
                      </div>
                      <div className="w-14 h-14 bg-[#F2F4F6] rounded-xl flex-shrink-0 animate-pulse" />
                    </div>
                  ))}
                </div>
              )}
              {!newsLoading && modalNews.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <div className="text-[32px] mb-3">📭</div>
                  <div className="text-[14px] font-medium text-text2 mb-1">관련 뉴스가 없습니다</div>
                  <div className="text-[12px] text-text3">현재 이 종목과 관련된 최신 뉴스를 찾을 수 없습니다.</div>
                </div>
              )}
              {!newsLoading && modalNews.map((news, i) => {
                const isBreaking = (Date.now() - new Date(news.pubDate)) < 3600000;
                return (
                  <a
                    key={news.id || i}
                    href={news.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 px-5 py-3.5 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] transition-colors active:bg-[#F2F4F6]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {isBreaking && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: '#FEF0F1', color: '#F04452' }}>
                            🔴 속보
                          </span>
                        )}
                        <span className="text-[11px] text-text3 truncate">{news.source}</span>
                        <span className="text-[11px] text-text3">·</span>
                        <span className="text-[11px] text-text3 flex-shrink-0">{news.timeAgo}</span>
                      </div>
                      <div className="text-[14px] font-medium text-text1 leading-snug line-clamp-2">{news.title}</div>
                      {news.description && (
                        <div className="text-[12px] text-text3 mt-1 line-clamp-2 leading-relaxed">{news.description}</div>
                      )}
                    </div>
                    {news.image && (
                      <img
                        src={news.image}
                        alt=""
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
