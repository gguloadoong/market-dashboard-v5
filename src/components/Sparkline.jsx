// SVG 스파크라인 컴포넌트

export default function Sparkline({ data = [], width = 80, height = 32, positive }) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} />;
  }

  const valid = data.filter(v => v != null && !isNaN(v));
  if (valid.length < 2) return <svg width={width} height={height} />;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const pts = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const color = positive === true ? '#FF4136' : positive === false ? '#1A73E8' : '#8B95A1';
  const polyline = pts.join(' ');

  // 영역 채우기용 path
  const firstPt = pts[0].split(',');
  const lastPt = pts[pts.length - 1].split(',');
  const areaPath = `M ${firstPt[0]} ${height} L ${polyline.replace(/(\d+\.\d+),(\d+\.\d+)/g, '$1 $2')} L ${lastPt[0]} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.slice(1)})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
