// 시그널 라벨 유틸리티 — SignalSummaryWidget에서 추출
import { TYPE_META } from '../engine/signalTypes';

// 시그널에서 표시 이름 추출
export function extractName(signal) {
  return signal.name || signal.symbol || signal.sector || signal.label || TYPE_META[signal.type]?.easyLabel || signal.type || '';
}

// 시그널의 easyLabel 가져오기 (TYPE_META 단일 소스)
// easyLabel이 함수인 경우 signal.meta를 전달하여 동적 라벨 생성
export function getEasyLabel(signal) {
  const label = TYPE_META[signal.type]?.easyLabel;
  if (typeof label === 'function') return label(signal.meta || {});
  return label || signal.type;
}
