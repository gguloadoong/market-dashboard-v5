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

// 워런트/특수단위 — 하이픈/점 접미사 + WS/WT 꼬리
// 예: DAL.W, XYZ-WS, FUND.UN (접미사 W, L, P, U, T 단일자)
const WARRANT_RE = /[-.][WLPUT]$|W[ST]$/;
// 시리즈/우선주 표기 — 캐럿(^), `.PR.`, `-PR.`, `PRA~PRZ` 명시 접미사
const SERIES_RE = /\^|[-.]PR\./;
// 명시적 우선주 클래스 — `-A~-Z`, `.A~.Z` 구분자 포함된 단일 알파벳 접미사
// (듀얼클래스 보통주 BRK-B, BRK.B, FOXA 등은 화이트리스트로 예외 처리)
const CLASS_SUFFIX_RE = /[-.][A-Z]$/;

// 우선주/특수클래스 식별 — 보통주 복귀 위해 화이트리스트 선행
// 정책: 구분자(`-`/`.`) 없는 3~6글자 티커(AAPL/ORCL/META 등)는 절대 필터 안 함
export function isPreferredOrSpecial(sym) {
  if (!sym || typeof sym !== 'string') return false;
  const up = sym.toUpperCase();
  if (US_DUAL_CLASS_WHITELIST.has(up)) return false;
  if (WARRANT_RE.test(up)) return true;
  if (SERIES_RE.test(up)) return true;
  if (CLASS_SUFFIX_RE.test(up)) return true;
  return false;
}
