// 크로스마켓 심볼 충돌 해소 + US 우선주/특수클래스 식별 (#183)
// - META: US(Meta Platforms) vs COIN(Metadium) 등 심볼 충돌 → `${market}:${symbol}` 복합키로 구분
// - US 우선주/워런트/시리즈 주: 클라이언트에서 2차 방어 필터 (서버 필터 실패 대비)
import { US_DUAL_CLASS_WHITELIST } from '../data/usDualClass';

// 마켓:심볼 복합키 — allItems dedup/React key 공통
export const itemKey = (i) =>
  `${i._market || 'US'}:${(i.symbol || i.id || '').toUpperCase()}`;

// 우선주 접미사 패턴 — 3~4글자 + [LMNOPQ] (예: AGNCM, HBANP)
// AGNC(보통주)는 4글자+C라 미매치. 보통주는 대부분 접미사 규칙에 안 걸림.
const PREFERRED_SUFFIX_RE = /^[A-Z]{3,4}[LMNOPQ]$/;
// 워런트 패턴 — `-W`, `.W`, `-L`, `.L`, `-P`, `.P`, `WS`
const WARRANT_RE = /[-.][WLP]$|WS$/;
// 시리즈 주 — 캐럿(^), `.PR.`, `PRA~PRZ` 접미사
const SERIES_RE = /\^|\.PR\.|PR[A-Z]$/;

// 우선주/특수클래스 식별 — 보통주 복귀 위해 화이트리스트 선행
export function isPreferredOrSpecial(sym) {
  if (!sym) return false;
  const up = sym.toUpperCase();
  if (US_DUAL_CLASS_WHITELIST.has(up)) return false;
  if (WARRANT_RE.test(up)) return true;
  if (SERIES_RE.test(up)) return true;
  if (PREFERRED_SUFFIX_RE.test(up)) return true;
  return false;
}
