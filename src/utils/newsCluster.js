// 뉴스 클러스터링 — Jaccard 유사도 기반 중복 제거
// 같은 사건에 대한 여러 보도를 하나로 묶어 대표 1건만 표시

// 한국어 불용어
const STOPWORDS = new Set([
  '은','는','이','가','을','를','의','에','도','로','와','과','한','된','인','할',
  '등','및','그','이번','오늘','내일','관련','대한','위해','통해','따라','지난','올해','현재',
]);

// 제목에서 토큰 추출 (2자+ 한글/영문 단어)
function tokenize(title) {
  if (!title) return new Set();
  const words = title
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w));
  return new Set(words);
}

// Jaccard 유사도
function jaccard(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  return inter / (setA.size + setB.size - inter);
}

/**
 * 뉴스 클러스터링 메인 함수
 * @param {Array} newsItems - 뉴스 배열 (title, pubDate 필수)
 * @param {number} threshold - Jaccard 유사도 임계값 (기본 0.4)
 * @param {number} maxTimeGapMs - 최대 시간차 (기본 6시간)
 * @returns {Array<{lead: object, related: object[]}>} 클러스터 배열
 */
export function clusterNews(newsItems, threshold = 0.4, maxTimeGapMs = 6 * 3600000) {
  // 각 뉴스 토큰화
  const tokenized = newsItems.map(n => ({ ...n, _tokens: tokenize(n.title) }));
  const clusters = []; // [{lead: item, related: [item, ...]}]
  const assigned = new Set();

  for (let i = 0; i < tokenized.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = { lead: tokenized[i], related: [] };
    assigned.add(i);

    for (let j = i + 1; j < tokenized.length; j++) {
      if (assigned.has(j)) continue;
      // 시간차 체크
      const timeA = tokenized[i].pubDate ? new Date(tokenized[i].pubDate).getTime() : NaN;
      const timeB = tokenized[j].pubDate ? new Date(tokenized[j].pubDate).getTime() : NaN;
      if (isNaN(timeA) || isNaN(timeB)) continue; // pubDate 파싱 실패 방어
      const timeDiff = Math.abs(timeA - timeB);
      if (timeDiff > maxTimeGapMs) continue;
      // 유사도 체크
      if (jaccard(tokenized[i]._tokens, tokenized[j]._tokens) >= threshold) {
        cluster.related.push(tokenized[j]);
        assigned.add(j);
      }
    }
    // 내부 토큰 필드 제거 (외부 노출 방지)
    delete cluster.lead._tokens;
    cluster.related.forEach(r => delete r._tokens);
    clusters.push(cluster);
  }
  return clusters;
}
