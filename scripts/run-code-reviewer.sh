#!/usr/bin/env bash
# run-code-reviewer.sh — claude --print으로 독립 코드리뷰 실행 후 artifact 저장
# 사용법: bash scripts/run-code-reviewer.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BRANCH=$(git rev-parse --abbrev-ref HEAD)
SAFE_BRANCH="${BRANCH//\//-}"
REVIEW_DIR=".tmp"
REVIEW_FILE="${REVIEW_DIR}/code-review-${SAFE_BRANCH}.md"
DIFF_FILE="$(mktemp)"
trap 'rm -f "$DIFF_FILE"' EXIT

# claude CLI 확인
if ! command -v claude &>/dev/null; then
  echo -e "${RED}[code-reviewer] claude CLI 미설치${NC}"
  echo -e "${RED}[code-reviewer] Claude Code CLI 설치 필요${NC}"
  exit 1
fi

mkdir -p "$REVIEW_DIR"

# diff 생성
git diff origin/main...HEAD > "$DIFF_FILE"
if [ ! -s "$DIFF_FILE" ]; then
  echo -e "${YELLOW}[code-reviewer] origin/main과 diff 없음 — 리뷰 불필요${NC}"
  exit 1
fi

DIFF_LINES=$(wc -l < "$DIFF_FILE")
echo -e "${GREEN}[code-reviewer] diff: ${DIFF_LINES} lines — claude Opus 리뷰 시작${NC}"

# claude --print으로 비대화형 실행
REVIEW_OUTPUT=$(claude --print "다음 git diff를 code-reviewer (Opus 수준) 관점에서 리뷰해주세요.

규칙:
- 크리티컬 버그/로직 오류: [CRITICAL] 태그
- 높은 우선순위 수정 필요: [HIGH] 태그
- 보안 문제: [SEC] 태그
- 성능: [PERF] 태그
- 스타일/제안: [STYLE] 태그
- 마지막 줄 반드시: VERDICT: PASS 또는 VERDICT: BLOCK

diff:
$(cat "$DIFF_FILE")" 2>&1 || true)

if [ -z "$REVIEW_OUTPUT" ]; then
  echo -e "${RED}[code-reviewer] claude 응답 없음${NC}"
  exit 1
fi

# artifact 저장 (커밋 해시 포함 — create-pr.sh 최신성 검증용)
{
  echo "# Code Review: ${BRANCH}"
  echo "- date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- commit: $(git rev-parse HEAD)"
  echo "- diff_lines: ${DIFF_LINES}"
  echo ""
  echo "$REVIEW_OUTPUT"
} > "$REVIEW_FILE"

echo -e "${GREEN}[code-reviewer] 저장: ${REVIEW_FILE}${NC}"

# VERDICT 파싱
if grep -qiE 'VERDICT:[[:space:]]*BLOCK' "$REVIEW_FILE"; then
  echo -e "${RED}[code-reviewer] VERDICT: BLOCK — 지적사항 수정 후 재실행${NC}"
  grep -E '^\s*-?\s*\[(CRITICAL|HIGH|SEC)\]' "$REVIEW_FILE" || true
  exit 1
fi

echo -e "${GREEN}[code-reviewer] VERDICT: PASS${NC}"
exit 0
