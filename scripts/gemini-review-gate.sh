#!/usr/bin/env bash
# gemini-review-gate.sh — Gemini Pro로 diff를 리뷰하고 PASS/BLOCK 판정
# 사용법: bash scripts/gemini-review-gate.sh [strict|warn] [base-branch]
set -euo pipefail

MODE="${1:-strict}"
BASE_BRANCH="${2:-origin/main}"
GEMINI_MODEL="gemini-2.5-pro"
GEMINI_TIMEOUT=${GEMINI_TIMEOUT:-120}

# ── Gemini CLI 확인 ──
if ! command -v gemini &>/dev/null; then
  if [ "$MODE" = "strict" ]; then
    echo "[gemini-gate] gemini CLI 미설치. strict 모드 → 중단." >&2
    echo "[gemini-gate] 설치: npm i -g @google/gemini-cli" >&2
    exit 1
  fi
  echo "[gemini-gate] gemini CLI 미설치 — warn 모드 스킵."
  exit 0
fi

# ── diff 생성 ──
MERGE_BASE=$(git merge-base "$BASE_BRANCH" HEAD 2>/dev/null) || {
  echo "[gemini-gate] merge-base 조회 실패 — git fetch 후 재실행" >&2
  exit 1
}

DIFF=$(git diff "$MERGE_BASE"...HEAD 2>/dev/null)

if [ -z "$DIFF" ]; then
  echo "[gemini-gate] 변경사항 없음 — PASS"
  echo "DECISION: PASS"
  exit 0
fi

DIFF_LINES=$(echo "$DIFF" | wc -l | tr -d ' ')
echo "[gemini-gate] ${BASE_BRANCH} 기준 Gemini (${GEMINI_MODEL}) 리뷰 실행 중... (diff ${DIFF_LINES}줄)"

PROMPT="당신은 시니어 엔지니어입니다. 아래 git diff를 엄격하게 코드 리뷰하세요.

## 검토 항목
- 버그, 로직 오류, 엣지케이스 누락
- 보안 취약점 (SQL injection, XSS, 키 하드코딩, 인증 우회 등)
- 성능 문제 (N+1 쿼리, 메모리 누수, 불필요한 루프 등)
- 심각한 코드 품질 문제 (null 미체크, 타입 오류, 경쟁조건 등)

## 판정 기준
- PASS: 문제 없음 또는 P2/P3 수준 마이너 이슈만 존재
- BLOCK: P0/P1 수준 버그·보안·성능 문제 발견

## 출력 형식
발견한 주요 이슈를 간결하게 나열 후, 반드시 마지막 줄에:
DECISION: PASS
또는
DECISION: BLOCK

## Git Diff"

# ── Gemini 리뷰 실행 (최대 2회 재시도) ──
_run_with_timeout() {
  if command -v timeout &>/dev/null; then
    timeout "$1" "${@:2}"
  elif command -v gtimeout &>/dev/null; then
    gtimeout "$1" "${@:2}"
  else
    perl -e 'alarm shift; exec @ARGV' "$@"
  fi
}

GEMINI_OK=false
REVIEW_TEXT=""
for attempt in 1 2; do
  set +e
  REVIEW_TEXT=$(echo "$DIFF" | _run_with_timeout "$GEMINI_TIMEOUT" \
    gemini -m "$GEMINI_MODEL" -p "$PROMPT" --output-format text 2>/dev/null)
  EXIT_CODE=$?
  set -e

  if [ "$EXIT_CODE" -eq 0 ] && [ -n "$REVIEW_TEXT" ]; then
    GEMINI_OK=true
    break
  fi

  if [ "$EXIT_CODE" -eq 124 ]; then
    echo "[gemini-gate] Gemini 타임아웃 (${GEMINI_TIMEOUT}초 초과, 시도 ${attempt}/2)"
  else
    echo "[gemini-gate] Gemini 실행 실패 exit=${EXIT_CODE} (시도 ${attempt}/2)"
  fi
  [ "$attempt" -lt 2 ] && sleep 3
done

if [ "$GEMINI_OK" = false ]; then
  echo "[gemini-gate] Gemini 리뷰 2회 연속 실패."
  if [ "$MODE" = "strict" ]; then
    echo "[gemini-gate] strict 모드 — SKIP_GEMINI_REVIEW=1로 우회 가능"
    exit 1
  fi
  exit 0
fi

echo "$REVIEW_TEXT"
echo ""

# ── DECISION 파싱 ──
DECISION_LINE="$(echo "$REVIEW_TEXT" | grep -iE 'DECISION:[[:space:]]*(PASS|BLOCK)' || true)"

if [ -n "$DECISION_LINE" ]; then
  if echo "$DECISION_LINE" | grep -iqE 'DECISION:[[:space:]]*BLOCK'; then
    VERDICT="BLOCK"
  else
    VERDICT="PASS"
  fi
else
  echo "[gemini-gate] DECISION 키워드 없음 — fallback 파서 사용"
  if echo "$REVIEW_TEXT" | grep -qiE '\bBLOCK\b|심각|critical|P0|P1'; then
    VERDICT="BLOCK"
  else
    VERDICT="PASS"
  fi
fi

if [ "$VERDICT" = "PASS" ]; then
  echo "[gemini-gate] ✅ PASS"
  exit 0
fi

echo "[gemini-gate] ❌ BLOCK"
if [ "$MODE" = "warn" ]; then
  echo "[gemini-gate] warn 모드 — 계속 진행"
  exit 0
fi
exit 1
