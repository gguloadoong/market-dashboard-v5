#!/usr/bin/env bash
# codex-review-gate.sh — Codex로 diff를 리뷰하고 PASS/BLOCK 판정
# 사용법: bash scripts/codex-review-gate.sh [strict|warn] [base-branch]
set -euo pipefail

MODE="${1:-strict}"
BASE_BRANCH="${2:-origin/main}"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

# ── codex CLI 확인 ──
if ! command -v codex &>/dev/null; then
  if [ "$MODE" = "strict" ]; then
    echo "[codex-gate] codex CLI 미설치. strict 모드 → 중단." >&2
    echo "[codex-gate] 설치: npm i -g @openai/codex" >&2
    exit 1
  fi
  echo "[codex-gate] codex CLI 미설치 — warn 모드 스킵."
  exit 0
fi

# ── Codex 리뷰 실행 (최대 2회 재시도) ──
echo "[codex-gate] ${BASE_BRANCH} 기준 Codex 리뷰 실행 중..."

CODEX_TIMEOUT=${CODEX_TIMEOUT:-120}  # 기본 2분 타임아웃
CODEX_OK=false
for attempt in 1 2; do
  if timeout "$CODEX_TIMEOUT" codex exec review --base "$BASE_BRANCH" --output-last-message "$TMP_FILE" --full-auto; then
    CODEX_OK=true
    break
  fi
  EXIT_CODE=$?
  if [ "$EXIT_CODE" -eq 124 ]; then
    echo "[codex-gate] Codex 타임아웃 (${CODEX_TIMEOUT}초 초과, 시도 ${attempt}/2)"
  else
    echo "[codex-gate] Codex 실행 실패 exit=${EXIT_CODE} (시도 ${attempt}/2)"
  fi
  [ "$attempt" -lt 2 ] && sleep 3
done

if [ "$CODEX_OK" = false ]; then
  echo "[codex-gate] Codex 리뷰 2회 연속 실패."
  if [ "$MODE" = "strict" ]; then
    echo "[codex-gate] strict 모드 — SKIP_CODEX_REVIEW=1로 우회 가능"
    exit 1
  fi
  exit 0
fi

REVIEW_TEXT="$(cat "$TMP_FILE")"

if [ -z "$REVIEW_TEXT" ]; then
  echo "[codex-gate] 리뷰 텍스트 비어있음."
  if [ "$MODE" = "strict" ]; then exit 1; fi
  exit 0
fi

echo "$REVIEW_TEXT"
echo ""

# ── DECISION 파싱 (POSIX 호환, grep 실패 방지) ──
DECISION_LINE="$(echo "$REVIEW_TEXT" | grep -iE 'DECISION:[[:space:]]*(PASS|BLOCK)' || true)"

if [ -n "$DECISION_LINE" ]; then
  if echo "$DECISION_LINE" | grep -iqE 'DECISION:[[:space:]]*BLOCK'; then
    VERDICT="BLOCK"
  else
    VERDICT="PASS"
  fi
else
  # fallback: [P0]/[P1] 태그 → BLOCK, 그 외 → PASS
  echo "[codex-gate] DECISION 키워드 없음 — fallback 파서 사용"
  if echo "$REVIEW_TEXT" | grep -qE '\[P[01]\]'; then
    VERDICT="BLOCK"
  else
    VERDICT="PASS"
  fi
fi

# ── 판정 ──
if [ "$VERDICT" = "PASS" ]; then
  echo "[codex-gate] ✅ PASS"
  exit 0
fi

echo "[codex-gate] ❌ BLOCK"
if [ "$MODE" = "warn" ]; then
  echo "[codex-gate] warn 모드 — 계속 진행"
  exit 0
fi
exit 1
