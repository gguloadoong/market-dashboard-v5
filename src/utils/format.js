// 숫자 포맷 유틸리티

export function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(pct) {
  if (pct == null || isNaN(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${Number(pct).toFixed(2)}%`;
}

export function fmtPrice(stock, coinUnit = 'usd') {
  const isCoin = !!stock.id;
  const isKr = stock.market === 'kr';
  if (isCoin) {
    const p = coinUnit === 'usd' ? stock.priceUsd : stock.priceKrw;
    const sym = coinUnit === 'usd' ? '$' : '₩';
    if (!p) return '—';
    if (p < 0.0001) return `${sym}${p.toFixed(8)}`;
    if (p < 0.01) return `${sym}${p.toFixed(6)}`;
    if (p < 1) return `${sym}${p.toFixed(4)}`;
    if (p < 100) return `${sym}${fmt(p, 2)}`;
    return `${sym}${fmt(p, 0)}`;
  }
  if (isKr) return `${fmt(stock.price)}원`;
  return `$${fmt(stock.price, 2)}`;
}

export function fmtChangeAmt(stock) {
  if (!stock.change || stock.id) return '';
  const abs = Math.abs(stock.change);
  const sign = stock.change >= 0 ? '+' : '-';
  return stock.market === 'kr' ? `${sign}${fmt(abs)}원` : `${sign}$${abs.toFixed(2)}`;
}

export function fmtLarge(n) {
  if (!n) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export function barPos(cur, low, high) {
  if (high <= low) return 50;
  return Math.max(2, Math.min(98, ((cur - low) / (high - low)) * 100));
}

export function dirClass(val) {
  if (val > 0) return 'c-up';
  if (val < 0) return 'c-down';
  return 'c-neutral';
}

export function arrow(val) {
  if (val > 0) return '▲';
  if (val < 0) return '▼';
  return '—';
}

export function getPct(stock) {
  return stock.id ? stock.change24h : stock.changePct;
}

export function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}
