// 섹터 이상치 제한 유틸 — 비정상적 등락률을 ±cap% 범위로 클램핑
export const clampPct = (pct, cap = 50) => Math.max(-cap, Math.min(cap, pct));
