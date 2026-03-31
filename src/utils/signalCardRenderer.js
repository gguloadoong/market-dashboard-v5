// 시그널 카드 이미지 렌더러 — Canvas API 직접 사용 (외부 의존성 없음)
// Web Share API에서 이미지 공유에 사용

// 모서리 둥근 사각형 그리기 (roundRect 미지원 브라우저 폴백)
function drawRoundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  } else {
    // 폴백: 일반 사각형
    ctx.fillRect(x, y, w, h);
  }
}

export async function renderSignalCard(signal) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');

  // 배경
  ctx.fillStyle = '#FFFFFF';
  drawRoundRect(ctx, 0, 0, 600, 320, 16);

  // 그림자 효과 (배경 위 약간의 테두리)
  ctx.strokeStyle = '#E5E8EB';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 600, 320);

  // 방향 색상
  const isBullish = signal.direction === 'bullish';
  const dirColor = isBullish ? '#2AC769' : '#F04452';
  const dirEmoji = signal.direction === 'bullish' ? '▲' : signal.direction === 'bearish' ? '▼' : '—';
  const neutralColor = '#FF9500';

  // 상단 방향 바
  ctx.fillStyle = signal.direction === 'bullish' ? '#E8F8EE' : signal.direction === 'bearish' ? '#FFF0F1' : '#FFF5E6';
  drawRoundRect(ctx, 0, 0, 600, 60, 0);

  // 방향 아이콘
  ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = signal.direction === 'neutral' ? neutralColor : dirColor;
  ctx.fillText(dirEmoji, 24, 40);

  // 종목명
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, Pretendard, sans-serif';
  ctx.fillStyle = '#191F28';
  ctx.fillText(signal.title || signal.name || '', 56, 40);

  // 상세 설명
  ctx.font = '14px -apple-system, BlinkMacSystemFont, Pretendard, sans-serif';
  ctx.fillStyle = '#8B95A1';
  const detail = signal.detail || signal.meta?.currentZoneKo || '';
  // 긴 텍스트 잘라내기
  const maxWidth = 552;
  let displayDetail = detail;
  while (ctx.measureText(displayDetail).width > maxWidth && displayDetail.length > 0) {
    displayDetail = displayDetail.slice(0, -1);
  }
  if (displayDetail.length < detail.length) displayDetail += '…';
  ctx.fillText(displayDetail, 24, 100);

  // 강도 바 (1~5)
  ctx.font = '12px -apple-system, BlinkMacSystemFont, Pretendard, sans-serif';
  ctx.fillStyle = '#B0B8C1';
  ctx.fillText('강도', 24, 145);

  const strength = signal.strength || 0;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < strength
      ? (signal.direction === 'neutral' ? neutralColor : dirColor)
      : '#E5E8EB';
    drawRoundRect(ctx, 64 + i * 24, 132, 14, 20, 4);
  }

  // 시장 정보
  if (signal.market || signal.symbol) {
    ctx.font = '13px -apple-system, BlinkMacSystemFont, Pretendard, sans-serif';
    ctx.fillStyle = '#B0B8C1';
    const marketText = [signal.market, signal.symbol].filter(Boolean).join(' · ');
    ctx.fillText(marketText, 24, 190);
  }

  // 타입 배지
  if (signal.type) {
    const typeLabel = signal.type.replace(/_/g, ' ');
    ctx.font = '11px -apple-system, BlinkMacSystemFont, Pretendard, sans-serif';
    ctx.fillStyle = '#3182F6';
    const badgeWidth = ctx.measureText(typeLabel).width + 16;
    ctx.fillStyle = '#EDF4FF';
    drawRoundRect(ctx, 24, 205, badgeWidth, 22, 6);
    ctx.fillStyle = '#3182F6';
    ctx.fillText(typeLabel, 32, 220);
  }

  // 구분선
  ctx.strokeStyle = '#F2F4F6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 260);
  ctx.lineTo(576, 260);
  ctx.stroke();

  // 워터마크
  ctx.font = '12px -apple-system, BlinkMacSystemFont, Pretendard, sans-serif';
  ctx.fillStyle = '#B0B8C1';
  ctx.fillText('마켓레이더 — marketradar.app', 24, 290);

  // 날짜
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, 576, 290);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}
