// 내러티브 빌더 — 시그널 + 관련 데이터 → "왜 발화했는가" 1문장 (규칙 기반, AI 없이)
// 우선순위: 뉴스+플로우 > 뉴스+섹터 > 뉴스 > 섹터 > null

const MAX_LEN = 60;
const SECTOR_MIN_PEERS = 2; // 섹터 동반 최소 종목 수

// 길이 초과 시 자르고 ... 부착
function truncate(text, max = MAX_LEN) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// 외인/기관 플로우 라벨 ("외인" / "기관" / null) — 대소문자 무관 매칭
function flowLabel(signal) {
  const t = (signal?.type || '').toLowerCase();
  if (t.includes('foreign')) return '외인';
  if (t.includes('institutional')) return '기관';
  return null;
}

/**
 * 내러티브 1문장 생성 — 매칭 부족 시 null 반환
 * @param {object} ctx { signal, relatedNews, sectorPeers, flowData }
 * @returns {string|null}
 */
export function buildNarrative({ signal, relatedNews = [], sectorPeers = 0, flowData = null } = {}) {
  if (!signal?.symbol) return null;
  const name = signal.name || signal.symbol;
  const sector = signal.meta?.sector;
  const direction = signal.direction === 'bullish' ? '상승' : signal.direction === 'bearish' ? '하락' : '변동';
  const news = Array.isArray(relatedNews) ? relatedNews : [];
  const newsHead20 = news[0]?.title?.slice(0, 20) || '';
  const newsHead30 = news[0]?.title?.slice(0, 30) || '';
  const flow = flowData || flowLabel(signal);

  // 1. 뉴스 + 외인플로우 동시
  if (news.length > 0 && flow) {
    const action = signal.direction === 'bearish' ? '순매도' : signal.direction === 'bullish' ? '순매수' : '순매수/도';
    return truncate(`${name} ${flow} ${action} + '${newsHead20}' 뉴스`);
  }
  // 2. 뉴스 + 섹터 동조
  if (news.length > 0 && sector && sectorPeers >= SECTOR_MIN_PEERS) {
    return truncate(`${name} '${newsHead20}' + ${sector}섹터 ${sectorPeers}개 동반 ${direction}`);
  }
  // 3. 뉴스만
  if (news.length > 0) {
    return truncate(`관련 뉴스 ${news.length}건 집중 — ${newsHead30}`);
  }
  // 4. 섹터 동조만
  if (sector && sectorPeers >= SECTOR_MIN_PEERS) {
    return truncate(`${sector}섹터 ${sectorPeers}개 종목 동반 ${direction} — 수급 이동 감지`);
  }
  // 5. 매칭 없음
  return null;
}
