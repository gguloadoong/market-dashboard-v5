#!/usr/bin/env bash
# create-pr.sh — PR 생성 전 전체 절차 자동 실행
# 사용법: npm run pr -- "PR 제목"
# 또는: bash scripts/create-pr.sh "PR 제목"
set -euo pipefail

TITLE="${1:-}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$TITLE" ]; then
  echo -e "${RED}[pr] PR 제목을 입력하세요: bash scripts/create-pr.sh \"PR 제목\"${NC}"
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
# 브랜치명 / → - 치환 (artifact 경로 오류 방지, feature/xxx 대응)
SAFE_BRANCH="${BRANCH//\//-}"
if [ "$BRANCH" = "main" ]; then
  echo -e "${RED}[pr] main 브랜치에서는 PR을 생성할 수 없습니다.${NC}"
  exit 1
fi

echo -e "${GREEN}[pr] === 1/5 빌드 확인 ===${NC}"
npm run build || { echo -e "${RED}[pr] 빌드 실패${NC}"; exit 1; }

# ─── 1.5/5 architect 게이트 — 알고리즘 파일 변경 시 설계 리뷰 필수 ────────
echo ""
echo -e "${GREEN}[pr] === 1.5/5 architect 게이트 ===${NC}"

# .algo-files에서 패턴 동적 로드 — run-architect.sh와 단일 소스 유지
ALGO_FILES_CONFIG="$(dirname "$0")/../.algo-files"
if [ ! -f "$ALGO_FILES_CONFIG" ]; then
  echo -e "${RED}[pr] .algo-files 없음: ${ALGO_FILES_CONFIG}${NC}"
  exit 1
fi
ALGO_PATTERN=$(grep -v '^#' "$ALGO_FILES_CONFIG" | grep -v '^$' | tr '\n' '|' | sed 's/|$//')

# [HIGH FIX] merge-base 실패 시 명시적 오류 (silent pass 방지)
MERGE_BASE=$(git merge-base origin/main HEAD 2>/dev/null) || {
  echo -e "${RED}[pr] origin/main fetch 필요: git fetch origin main${NC}"
  exit 1
}
# 테스트·스펙 파일 제외 — signalThresholds.test.js 등 오탐 방지
ALGO_FILES_CHANGED=$(git diff "$MERGE_BASE" HEAD --name-only 2>/dev/null \
  | grep -E "$ALGO_PATTERN" \
  | grep -vE '\.(test|spec)\.(js|ts|jsx|tsx)$' \
  || true)

if [ -n "$ALGO_FILES_CHANGED" ]; then
  echo -e "${YELLOW}[pr] 알고리즘 파일 변경 감지:${NC}"
  echo "$ALGO_FILES_CHANGED" | sed 's/^/    /'

  ARCHITECT_FILE=".tmp/architect-review-${SAFE_BRANCH}.md"

  if [ ! -f "$ARCHITECT_FILE" ]; then
    echo ""
    echo -e "${RED}[pr] ⛔ architect 리뷰 artifact 없음${NC}"
    echo -e "${RED}[pr]    알고리즘 파일 변경 시 설계 리뷰 필수${NC}"
    echo -e "${YELLOW}[pr]    실행: npm run architect${NC}"
    exit 1
  fi

  # commit 일치 확인
  ARCHITECT_COMMIT=$(grep -oE 'commit: [a-f0-9]+' "$ARCHITECT_FILE" | awk '{print $2}' | head -1 || echo "")
  HEAD_COMMIT_CHECK=$(git rev-parse HEAD)
  if [ "$ARCHITECT_COMMIT" != "$HEAD_COMMIT_CHECK" ]; then
    echo -e "${RED}[pr] architect 리뷰가 현재 HEAD와 불일치${NC}"
    echo -e "${YELLOW}[pr]    리뷰 기준: ${ARCHITECT_COMMIT:-없음}${NC}"
    echo -e "${YELLOW}[pr]    현재 HEAD: ${HEAD_COMMIT_CHECK}${NC}"
    echo -e "${YELLOW}[pr]    재실행: npm run architect${NC}"
    exit 1
  fi

  # BLOCK 체크 — 첫 줄만 검사 (본문 내 BLOCK 언급 오탐 방지)
  if head -1 "$ARCHITECT_FILE" | grep -qiE 'VERDICT:[[:space:]]*BLOCK'; then
    echo -e "${RED}[pr] architect VERDICT: BLOCK — 설계 이슈 수정 후 재실행${NC}"
    exit 1
  fi

  # [CRITICAL FIX] fallback PASS 하드코딩 제거 — VERDICT 없으면 명시적 차단 (첫 줄만)
  ARCHITECT_VERDICT=$(head -1 "$ARCHITECT_FILE" | grep -oE 'VERDICT:[[:space:]]*(PASS|NOT_REQUIRED)')
  if [ -z "$ARCHITECT_VERDICT" ]; then
    echo -e "${RED}[pr] architect artifact에 유효한 VERDICT 없음 — npm run architect 재실행${NC}"
    exit 1
  fi
  echo -e "${GREEN}[pr] architect 리뷰 ${ARCHITECT_VERDICT} ✓${NC}"
else
  echo -e "${GREEN}[pr] 알고리즘 파일 변경 없음 — architect 게이트 스킵${NC}"
fi

# ─── 2/5 code-reviewer artifact 검증 ──────────────────────────────────────
echo ""
echo -e "${GREEN}[pr] === 2/5 code-reviewer 검증 ===${NC}"

REVIEW_FILE=".tmp/code-review-${SAFE_BRANCH}.md"

if [ ! -f "$REVIEW_FILE" ]; then
  echo -e "${RED}[pr] code-review artifact 없음: ${REVIEW_FILE}${NC}"
  echo -e "${RED}[pr] 먼저 실행: npm run review:code${NC}"
  exit 1
fi

# 커밋 해시 최신성 검증
REVIEW_COMMIT=$(grep -oE 'commit: [a-f0-9]+' "$REVIEW_FILE" | awk '{print $2}' || echo "")
HEAD_COMMIT=$(git rev-parse HEAD)

if [ "$REVIEW_COMMIT" != "$HEAD_COMMIT" ]; then
  echo -e "${RED}[pr] code-review가 현재 HEAD와 불일치${NC}"
  echo -e "${YELLOW}[pr] 리뷰 기준 커밋: ${REVIEW_COMMIT:-없음}${NC}"
  echo -e "${YELLOW}[pr] 현재 HEAD:       ${HEAD_COMMIT}${NC}"
  echo -e "${RED}[pr] 재실행: npm run review:code${NC}"
  exit 1
fi

# BLOCK 재확인
if grep -qiE 'VERDICT:[[:space:]]*BLOCK' "$REVIEW_FILE"; then
  echo -e "${RED}[pr] code-review VERDICT: BLOCK — 수정 후 재실행 필요${NC}"
  exit 1
fi

# PR 본문용 추출 (있으면 표시)
CODE_REVIEWER_RESULT=$(grep -E '^\s*-?\s*\[(CRITICAL|HIGH|SEC|PERF|STYLE)\]' "$REVIEW_FILE" 2>/dev/null | head -10 || echo "지적사항 없음 (PASS)")
echo -e "${GREEN}[pr] code-review PASS (커밋: ${HEAD_COMMIT:0:8})${NC}"
echo -e "${YELLOW}[pr] 주요 지적: ${CODE_REVIEWER_RESULT}${NC}"

# ─── 3/5 Codex gate ──────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}[pr] === 3/5 Codex gate ===${NC}"
CODEX_STATUS="SKIPPED (codex CLI 미설치)"
CODEX_ISSUES_DECISION=""

if command -v codex &>/dev/null; then
  # Codex gate 실행 및 출력 캡처
  set +e
  CODEX_OUTPUT=$(npm run review:gate < /dev/null 2>&1)
  CODEX_EXIT=$?
  set -e
  echo "$CODEX_OUTPUT"

  # BLOCK 체크
  if [ "$CODEX_EXIT" -ne 0 ] || echo "$CODEX_OUTPUT" | grep -q "BLOCK"; then
    if [ "${SKIP_CODEX_REVIEW:-0}" = "1" ]; then
      echo -e "${YELLOW}[pr] Codex gate BLOCK → SKIP_CODEX_REVIEW=1 우회 (PR 본문에 사유 기록 필수)${NC}"
      CODEX_STATUS="BLOCK → SKIP_CODEX_REVIEW=1 우회"
    else
      echo -e "${YELLOW}[pr] Codex gate BLOCK — 수정 후 재실행하세요${NC}"
      exit 1
    fi
  fi

  # P1/P2/HIGH/CRITICAL 이슈 추출
  CODEX_ISSUES=$(echo "$CODEX_OUTPUT" | grep -E '^\s*-\s*\[P[12]\]|\[HIGH\]|\[CRITICAL\]' || true)

  if [ -n "$CODEX_ISSUES" ]; then
    echo ""
    echo -e "${RED}[pr] ══════════════════════════════════════════${NC}"
    echo -e "${RED}[pr] ⛔ Codex 지적사항 발견 — PR 생성 전 처리 결정 필수  ⛔${NC}"
    echo -e "${RED}[pr] ══════════════════════════════════════════${NC}"
    echo -e "${YELLOW}[pr] 발견된 지적사항:${NC}"
    echo "$CODEX_ISSUES"
    echo ""
    echo -e "${YELLOW}[pr] 각 항목에 대해 채택(수정 완료) 또는 기각(사유)을 입력하세요.${NC}"
    echo -e "${YELLOW}[pr] 예: [채택] xxx 수정 완료 / [기각] yyy — 현재 범위 밖, 백로그 등록${NC}"
    echo -e "${YELLOW}[pr] 빈 입력 시 PR 생성 중단됩니다.${NC}"
    echo -n "[pr] Codex 지적사항 처리 결과 입력: "
    read -r CODEX_ISSUES_DECISION

    if [ -z "$CODEX_ISSUES_DECISION" ]; then
      echo -e "${RED}[pr] 처리 결과 미입력 — PR 생성 중단${NC}"
      exit 1
    fi

    CODEX_STATUS="PASS (지적사항 처리: ${CODEX_ISSUES_DECISION})"
  else
    # SKIP_CODEX_REVIEW=1 우회 상태를 덮어쓰지 않도록 — 이미 우회 기록이 있으면 유지
    if [[ "$CODEX_STATUS" != *"우회"* ]]; then
      CODEX_STATUS="PASS"
    fi
  fi
else
  echo -e "${YELLOW}[pr] Codex CLI 미설치 — 스킵${NC}"
fi

# ─── 4/5 PR 생성 ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}[pr] === 4/5 PR 생성 ===${NC}"

REVIEW_BODY="## 독립 리뷰 결과

### code-reviewer (Claude Opus)
${CODE_REVIEWER_RESULT}

### Codex gate (OpenAI)
- ${CODEX_STATUS}

---
> ⚠️ PR 후 봇 리뷰 채택/기각 기준: 위 두 리뷰에서 이미 검토된 항목과 일치하면 채택, 상충하면 재검토 후 판단 (사전 승인 결과 원복 방지)

---
🤖 Generated by Claude Code [claude-sonnet-4-6]"

PR_URL=$(gh pr create --title "$TITLE" --body "$REVIEW_BODY" 2>&1 | grep "https://")

echo -e "${GREEN}[pr] PR 생성: $PR_URL${NC}"

PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')
REPO="gguloadoong/market-dashboard-v2"

# ─── 5/5 봇 리뷰 폴링 (Copilot 필수 + 1 other) ──────────────────────────
echo ""
echo -e "${GREEN}[pr] === 5/5 봇 리뷰 폴링 (최대 15분) ===${NC}"
echo -e "${YELLOW}[pr] 필수 조건: Copilot 도착 + Gemini·CodeRabbit 중 1명${NC}"
echo -e "${YELLOW}[pr] PR 전 검토 결과 참고: .tmp/code-review-${SAFE_BRANCH}.md${NC}"

MAX_ITER=30
INTERVAL=30
COPILOT_ARRIVED=0
OTHER_ARRIVED=0

for i in $(seq 1 $MAX_ITER); do
  sleep $INTERVAL
  ELAPSED=$((i * INTERVAL))

  # Copilot
  COPILOT_COUNT=$(gh api "repos/${REPO}/pulls/${PR_NUM}/reviews" \
    --jq '[.[] | select(.user.login == "copilot-pull-request-reviewer")] | length' \
    2>/dev/null || echo "0")

  # Gemini (review)
  GEMINI_COUNT=$(gh api "repos/${REPO}/pulls/${PR_NUM}/reviews" \
    --jq '[.[] | select(.user.login | test("gemini"; "i"))] | length' \
    2>/dev/null || echo "0")

  # CodeRabbit (issue comment)
  CR_COUNT=$(gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
    --jq '[.[] | select(.user.login | test("coderabbit"; "i")) | select(.body | contains("review in progress") | not)] | length' \
    2>/dev/null || echo "0")

  [ "$COPILOT_COUNT" -gt 0 ] && COPILOT_ARRIVED=1
  [ "$((GEMINI_COUNT + CR_COUNT))" -gt 0 ] && OTHER_ARRIVED=1

  echo "[pr] ${ELAPSED}s — Copilot:${COPILOT_ARRIVED} | Gemini:${GEMINI_COUNT} CodeRabbit:${CR_COUNT}"

  if [ "$COPILOT_ARRIVED" -eq 1 ] && [ "$OTHER_ARRIVED" -eq 1 ]; then
    echo -e "\n${GREEN}[pr] 필수 봇 리뷰 조건 충족!${NC}"
    break
  fi
done

# 타임아웃 처리
if [ "$COPILOT_ARRIVED" -eq 0 ] && [ "$OTHER_ARRIVED" -eq 0 ]; then
  echo -e "${YELLOW}[pr] 봇 미응답 — 독립 리뷰 결과만으로 머지 가능${NC}"
  gh pr comment "$PR_NUM" --body "봇 미응답 (15분 대기 초과). 독립 리뷰 결과만으로 머지 가능." 2>/dev/null || true
elif [ "$COPILOT_ARRIVED" -eq 0 ]; then
  echo -e "${YELLOW}[pr] Copilot 미도착 — 수동 확인 필요${NC}"
  gh pr comment "$PR_NUM" --body "Copilot 리뷰 미도착. 머지 전 수동 확인 필요." 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}[pr] ─── 봇 리뷰 상세 내용 ───${NC}"

gh api "repos/${REPO}/pulls/${PR_NUM}/reviews" --jq '.[] | "[\(.user.login)] \(.state)\n\(.body | .[0:400])\n---"' 2>/dev/null || true

gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
  --jq '[.[] | select(.user.login | contains("coderabbit"))] | .[] | "[\(.user.login)]\n\(.body | .[0:600])\n---"' 2>/dev/null || true

INLINE_COUNT=$(gh api "repos/${REPO}/pulls/${PR_NUM}/comments" --jq 'length' 2>/dev/null || echo "0")
if [ "$INLINE_COUNT" -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}[pr] 인라인 코멘트 ${INLINE_COUNT}건:${NC}"
  gh api "repos/${REPO}/pulls/${PR_NUM}/comments" \
    --jq '.[] | "[\(.user.login)] \(.path):\(.line // "?") — \(.body | .[0:200])\n---"' 2>/dev/null || true
fi

echo ""
echo -e "${RED}[pr] ══════════════════════════════════════════${NC}"
echo -e "${RED}[pr] ⚠️  봇 리뷰 응답 필수 — 지금 즉시 처리하세요  ⚠️${NC}"
echo -e "${RED}[pr] ══════════════════════════════════════════${NC}"
echo -e "${YELLOW}[pr] HIGH/CRITICAL → 코드 수정 후 push${NC}"
echo -e "${YELLOW}[pr] MEDIUM/LOW → 채택/기각 판단 후 PR 코멘트 작성${NC}"
echo -e "${YELLOW}[pr] 응답 없이 머지 금지 (CLAUDE.md 규칙)${NC}"
echo -e "${GREEN}[pr] PR: $PR_URL${NC}"
