// 뉴스 제목에서 투자 시그널 태그 추출 — BreakingNewsPanel NewsItem에서 사용

const SIGNAL_RULES = [
  {
    tag: '강세', color: '#2AC769', bg: '#F0FFF6',
    keywords: ['급등','폭등','신고가','서프라이즈','호재','상승','돌파','승인','허가','상장','흑자','계약','수주'],
  },
  {
    tag: '약세', color: '#F04452', bg: '#FFF0F1',
    keywords: ['급락','폭락','신저가','악재','하락','붕괴','파산','청산','적자','손실','제재','금지','조사','소송'],
  },
  {
    tag: '실적', color: '#8B5CF6', bg: '#F5F0FF',
    keywords: ['실적','매출','영업이익','EPS','어닝','분기','연간','가이던스'],
  },
  {
    tag: '금리', color: '#3182F6', bg: '#EDF4FF',
    keywords: ['금리','기준금리','FOMC','연준','Fed','인상','인하','긴축','완화','피벗'],
  },
  {
    tag: '규제', color: '#F59E0B', bg: '#FFFBEB',
    keywords: ['규제','법안','SEC','소송','청문','입법'],
  },
  {
    tag: '유가', color: '#FF9500', bg: '#FFF4E6',
    keywords: ['유가','WTI','브렌트','OPEC','원유','석유'],
  },
  {
    tag: 'AI', color: '#14B8A6', bg: '#F0FDFA',
    keywords: ['AI','인공지능','GPT','LLM','반도체','엔비디아','Nvidia','HBM'],
  },
];

/**
 * extractNewsSignals(title)
 * 뉴스 제목에서 매칭되는 시그널 태그를 최대 2개 반환
 * @param {string} title
 * @returns {{ tag: string, color: string, bg: string }[]}
 */
export function extractNewsSignals(title) {
  if (!title) return [];
  const lower = title.toLowerCase();
  const matched = [];
  for (const rule of SIGNAL_RULES) {
    if (matched.length >= 2) break;
    const hit = rule.keywords.some(kw => lower.includes(kw.toLowerCase()));
    if (hit) matched.push({ tag: rule.tag, color: rule.color, bg: rule.bg });
  }
  return matched;
}
