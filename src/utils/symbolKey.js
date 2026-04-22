// 크로스마켓 심볼 충돌 해소 + US 우선주/특수클래스 식별 (#183)
// - 주 목적: META(Meta Platforms) vs META(Metadium) 등 크로스마켓 심볼 충돌 해소
// - 우선주/워런트 필터는 서버 `update-us` 크론이 1차 책임. 클라이언트는 명시적 패턴만 방어.
import { US_DUAL_CLASS_WHITELIST } from '../data/usDualClass';

// 마켓:심볼 복합키 — allItems dedup/React key 공통
// `_market`은 대문자로 정규화 (home/index.jsx 'US' vs GlobalSearch.jsx 'us' 불일치 흡수)
export const itemKey = (i) => {
  const mkt = (i._market || 'US').toString().toUpperCase();
  const sym = (i.symbol || i.id || '').toString().toUpperCase();
  return `${mkt}:${sym}`;
};

// 워런트/권리 — `WS`/`WT` 꼬리만 확정 매치 (e.g., XYZWS, ABCWT)
const WARRANT_RE = /W[ST]$/;
// 시리즈/우선주 — 캐럿(`^`) 또는 `.PR.`/`-PR.` 명시 토큰
const SERIES_RE = /\^|[-.]PR\./;

// 우선주/워런트 식별 — 클라이언트는 명시 토큰만 잡음.
// 정책: 듀얼클래스 `-A`/`-B`/`.A`/`.B` 패턴은 서버 `update-us` 크론이 1차 책임.
// 클라이언트가 일반 구분자 접미사를 필터하면 CWEN-A, MOG-A, LGF-B 등 보통주 오탐 발생.
export function isPreferredOrSpecial(sym) {
  if (!sym || typeof sym !== 'string') return false;
  const up = sym.toUpperCase();
  if (US_DUAL_CLASS_WHITELIST.has(up)) return false;
  if (WARRANT_RE.test(up)) return true;
  if (SERIES_RE.test(up)) return true;
  return false;
}
