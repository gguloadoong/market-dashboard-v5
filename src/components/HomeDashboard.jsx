// 홈 대시보드 — 시장 전체 한눈에 보기
// PM 기획: 트레이더가 앱 열자마자 오늘 시장을 파악할 수 있는 지휘 센터
// 디자이너: 숫자 중심, 카드형 레이아웃, 섹터 히트맵, 빠른 코인 시세
import { useState, useEffect, useMemo } from 'react';
import Sparkline from './Sparkline';
import { fetchAllNews } from '../api/news';

function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtLarge(n) {
  if (!n || n <= 0) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n / 1e8).toFixed(0)}억`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(1)}M`;
  return String(Math.round(n));
}

// ─── 지수 히어로 카드 ─────────────────────────────────────────
function IndexHeroCard({ idx }) {
  const isUp   = (idx.changePct ?? 0) > 0;
  const isDown = (idx.changePct ?? 0) < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const flag   = { KOSPI: '🇰🇷', KOSDAQ: '🇰🇷', SPX: '🇺🇸', NDX: '🇺🇸', DJI: '🇺🇸', DXY: '🌐' }[idx.id] || '';

  return (
    <div className={`bg-white rounded-2xl px-5 py-4 flex flex-col gap-1 border-t-[3px] shadow-sm transition-transform hover:-translate-y-0.5`}
      style={{ borderTopColor: color }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[14px]">{flag}</span>
        <span className="text-[12px] font-semibold text-[#8B95A1]">{idx.name}</span>
      </div>
      <div className="flex items-baseline gap-2.5 mt-0.5">
        <span className="text-[22px] font-bold text-[#191F28] tabular-nums font-mono">
          {fmt(idx.value, idx.id === 'DXY' ? 2 : 2)}
        </span>
        <span className="text-[14px] font-bold tabular-nums font-mono" style={{ color }}>
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(idx.changePct ?? 0).toFixed(2)}%
        </span>
      </div>
      {idx.change != null && (
        <div className="text-[12px] tabular-nums font-mono" style={{ color }}>
          {isUp ? '+' : ''}{fmt(idx.change, 2)}
        </div>
      )}
    </div>
  );
}

// ─── 급등/급락 TOP5 종목 행 ───────────────────────────────────
function MoverRow({ item, rank, krwRate, onClick }) {
  const pct    = item.id ? (item.change24h ?? 0) : (item.changePct ?? 0);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';

  // 로고 URL들
  const logoUrls = item.image ? [item.image]
    : item.market === 'us' ? [`https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`, `https://static.toss.im/png-icons/securities/icn-sec-fill-${item.symbol}.png`]
    : item.market === 'kr' ? [`https://static.toss.im/png-icons/securities/icn-sec-fill-${item.symbol}.png`]
    : [];
  const [logoIdx, setLogoIdx] = useState(0);
  const PALETTE = ['#3182F6','#F04452','#FF9500','#2AC769','#8B5CF6','#EC4899','#14B8A6','#F59E0B'];
  const bg = PALETTE[(item.symbol || '').split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) % PALETTE.length] || '#8B95A1';

  const price = item.id
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item.market === 'kr' ? `₩${fmt(item.price)}`
    : item.market === 'us' ? `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`
    : `₩${fmt(item.price ?? 0)}`;

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F7F8FA] cursor-pointer transition-colors group"
    >
      <span className="text-[12px] text-[#C9CDD2] w-4 text-center tabular-nums flex-shrink-0">{rank}</span>
      {logoIdx < logoUrls.length ? (
        <img src={logoUrls[logoIdx]} alt={item.symbol} onError={() => setLogoIdx(i => i + 1)}
          className="w-7 h-7 rounded-full object-contain bg-white border border-[#F2F4F6] flex-shrink-0 p-0.5" />
      ) : (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
          style={{ background: bg }}>
          {(item.symbol || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#191F28] truncate">{item.name}</div>
        <div className="text-[10px] font-bold text-[#8B95A1] font-mono">{item.symbol}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[13px] font-bold tabular-nums font-mono" style={{ color }}>
          {isUp ? '▲' : '▼'}{Math.abs(pct).toFixed(2)}%
        </div>
        <div className="text-[11px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
      </div>
    </div>
  );
}

// ─── 코인 빠른 시세 카드 ──────────────────────────────────────
function CoinCard({ coin, krwRate, onClick }) {
  const pct   = coin.change24h ?? 0;
  const isUp  = pct > 0;
  const color = isUp ? '#F04452' : '#1764ED';
  const priceKrw = coin.priceKrw || (coin.priceUsd ?? 0) * krwRate;
  const [err, setErr] = useState(false);

  return (
    <div
      onClick={() => onClick?.(coin)}
      className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5 border border-[#F2F4F6]"
    >
      {coin.image && !err ? (
        <img src={coin.image} alt={coin.symbol} onError={() => setErr(true)}
          className="w-9 h-9 rounded-full flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[#F7AE00] flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
          {coin.symbol.slice(0, 2)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-[#191F28]">{coin.symbol}</span>
          <span className="text-[11px] font-bold tabular-nums font-mono" style={{ color }}>
            {isUp ? '▲' : '▼'}{Math.abs(pct).toFixed(2)}%
          </span>
        </div>
        <div className="text-[12px] font-semibold text-[#191F28] tabular-nums font-mono mt-0.5">
          {priceKrw >= 1000 ? `₩${fmt(Math.round(priceKrw))}` : priceKrw >= 1 ? `₩${fmt(priceKrw, 2)}` : `₩${priceKrw.toFixed(4)}`}
        </div>
      </div>
      <Sparkline data={coin.sparkline} width={60} height={28} positive={isUp} />
    </div>
  );
}

// ─── 섹터 퍼포먼스 ───────────────────────────────────────────
function SectorBar({ sector, pct }) {
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const bg     = isUp ? '#FFF0F1' : isDown ? '#F0F4FF' : '#F2F4F6';
  const width  = Math.min(Math.abs(pct) * 8, 100);

  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="text-[12px] text-[#6B7684] w-20 flex-shrink-0">{sector}</span>
      <div className="flex-1 h-1.5 bg-[#F2F4F6] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="text-[12px] font-bold tabular-nums w-14 text-right" style={{ color }}>
        {isUp ? '+' : ''}{pct.toFixed(2)}%
      </span>
    </div>
  );
}

// ─── 뉴스 카드 ────────────────────────────────────────────────
const CAT_STYLE = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: 'US'   },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: 'KR'   },
};

function NewsCard({ item }) {
  const isBreaking = (Date.now() - new Date(item.pubDate)) < 3600000;
  const cat = CAT_STYLE[item.category] || { bg: '#F2F4F6', color: '#8B95A1', label: 'NEWS' };

  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer"
      className="bg-white rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition-all hover:-translate-y-0.5 border border-[#F2F4F6] cursor-pointer min-w-0"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {isBreaking && (
          <span className="text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] px-1.5 py-0.5 rounded-full flex-shrink-0">🔴 속보</span>
        )}
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
        <span className="text-[11px] text-[#B0B8C1] truncate">{item.source}</span>
        <span className="text-[11px] text-[#B0B8C1] flex-shrink-0 ml-auto">{item.timeAgo}</span>
      </div>
      <div className="text-[13px] font-semibold text-[#191F28] leading-snug line-clamp-3">{item.title}</div>
    </a>
  );
}

// ─── 메인 홈 대시보드 ─────────────────────────────────────────
export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [],
  krwRate = 1466, onItemClick,
}) {
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    fetchAllNews()
      .then(all => setNews(all.slice(0, 6)))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, []);

  // 급등 TOP5 (전체 종목 통합)
  const topGainers = useMemo(() => {
    const all = [
      ...krStocks,
      ...usStocks,
      ...coins,
    ];
    return all
      .filter(i => {
        const p = i.id ? (i.change24h ?? 0) : (i.changePct ?? 0);
        return p > 0;
      })
      .sort((a, b) => {
        const pa = a.id ? (a.change24h ?? 0) : (a.changePct ?? 0);
        const pb = b.id ? (b.change24h ?? 0) : (b.changePct ?? 0);
        return pb - pa;
      })
      .slice(0, 5);
  }, [krStocks, usStocks, coins]);

  // 급락 TOP5
  const topLosers = useMemo(() => {
    const all = [...krStocks, ...usStocks, ...coins];
    return all
      .filter(i => {
        const p = i.id ? (i.change24h ?? 0) : (i.changePct ?? 0);
        return p < 0;
      })
      .sort((a, b) => {
        const pa = a.id ? (a.change24h ?? 0) : (a.changePct ?? 0);
        const pb = b.id ? (b.change24h ?? 0) : (b.changePct ?? 0);
        return pa - pb;
      })
      .slice(0, 5);
  }, [krStocks, usStocks, coins]);

  // 섹터 평균 등락률
  const sectorPerf = useMemo(() => {
    const map = {};
    [...krStocks, ...usStocks].forEach(s => {
      if (!s.sector) return;
      if (!map[s.sector]) map[s.sector] = [];
      map[s.sector].push(s.changePct ?? 0);
    });
    return Object.entries(map)
      .map(([sector, vals]) => ({ sector, pct: vals.reduce((a, b) => a + b, 0) / vals.length }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [krStocks, usStocks]);

  // 주요 코인 TOP6
  const topCoins = useMemo(() =>
    coins.slice(0, 6),
  [coins]);

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="space-y-4">
      {/* ── 오늘 날짜 + 마켓 상태 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#191F28]">마켓 오버뷰</h2>
          <p className="text-[12px] text-[#8B95A1] mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-[#F2F4F6]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
          <span className="text-[11px] text-[#6B7684] font-medium">실시간 업데이트</span>
        </div>
      </div>

      {/* ── 지수 카드 그리드 ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {indices.length > 0
          ? indices.slice(0, 4).map(idx => <IndexHeroCard key={idx.id} idx={idx} />)
          : [1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-2xl px-5 py-4 space-y-2 shadow-sm">
              <div className="h-3 bg-[#F2F4F6] rounded w-16 animate-pulse" />
              <div className="h-7 bg-[#F2F4F6] rounded w-24 animate-pulse" />
            </div>
          ))
        }
      </div>

      {/* ── 메인 2열 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 급등/급락 */}
        <div className="space-y-3">
          {/* 급등 TOP5 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[15px]">🔥</span>
              <span className="text-[14px] font-bold text-[#191F28]">급등 TOP 5</span>
              <span className="text-[11px] text-[#B0B8C1] ml-1">전체 종목 기준</span>
            </div>
            <div className="space-y-0.5">
              {topGainers.length > 0
                ? topGainers.map((item, i) => (
                    <MoverRow
                      key={item.id || item.symbol}
                      item={item}
                      rank={i + 1}
                      krwRate={krwRate}
                      onClick={onItemClick}
                    />
                  ))
                : Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#F2F4F6] animate-pulse" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-[#F2F4F6] rounded w-24 animate-pulse" />
                        <div className="h-2.5 bg-[#F2F4F6] rounded w-12 animate-pulse" />
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>

          {/* 급락 TOP5 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[15px]">🧊</span>
              <span className="text-[14px] font-bold text-[#191F28]">급락 TOP 5</span>
            </div>
            <div className="space-y-0.5">
              {topLosers.length > 0
                ? topLosers.map((item, i) => (
                    <MoverRow
                      key={item.id || item.symbol}
                      item={item}
                      rank={i + 1}
                      krwRate={krwRate}
                      onClick={onItemClick}
                    />
                  ))
                : Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#F2F4F6] animate-pulse" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-[#F2F4F6] rounded w-24 animate-pulse" />
                        <div className="h-2.5 bg-[#F2F4F6] rounded w-12 animate-pulse" />
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>

        {/* 코인 + 섹터 */}
        <div className="space-y-3">
          {/* 코인 그리드 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[15px]">🪙</span>
              <span className="text-[14px] font-bold text-[#191F28]">코인 시세</span>
              <span className="text-[11px] text-[#B0B8C1] ml-auto font-mono">Upbit 기준</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {topCoins.length > 0
                ? topCoins.map(c => (
                    <CoinCard key={c.id} coin={c} krwRate={krwRate} onClick={onItemClick} />
                  ))
                : Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-[#F8F9FA] rounded-xl h-16 animate-pulse" />
                  ))
              }
            </div>
          </div>

          {/* 섹터 퍼포먼스 */}
          {sectorPerf.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[15px]">🏭</span>
                <span className="text-[14px] font-bold text-[#191F28]">섹터 퍼포먼스</span>
              </div>
              <div className="space-y-0.5">
                {sectorPerf.map(s => (
                  <SectorBar key={s.sector} sector={s.sector} pct={s.pct} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 주요 뉴스 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[15px]">📰</span>
          <span className="text-[14px] font-bold text-[#191F28]">주요 뉴스</span>
        </div>
        {newsLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 h-28 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {news.map(n => <NewsCard key={n.id} item={n} />)}
          </div>
        )}
      </div>
    </div>
  );
}
