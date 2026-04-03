#!/usr/bin/env bash
# run-architect.sh — architect(Claude Opus) 설계 리뷰
#
# 알고리즘/비즈니스로직 파일 수정 전 설계 단계 강제 실행
# 결과: .tmp/architect-review-{SAFE_BRANCH}.md 저장
# create-pr.sh가 이 artifact를 체크해 없으면 PR 차단

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# claude CLI 확인
if ! command -v claude &>/dev/null; then
  echo -e "${RED}[architect] claude CLI 미설치 — brew install claude-code 또는 npm i -g @anthropic-ai/claude-code${NC}"
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
# [HIGH FIX] 브랜치명 / → - 치환 (artifact 경로 오류 방지)
SAFE_BRANCH="${BRANCH//\//-}"
HEAD_COMMIT=$(git rev-parse HEAD)
ARTIFACT_DIR=".tmp"
mkdir -p "$ARTIFACT_DIR"
ARTIFACT_FILE="${ARTIFACT_DIR}/architect-review-${SAFE_BRANCH}.md"

echo -e "${GREEN}[architect] branch: ${BRANCH}${NC}"
echo -e "${GREEN}[architect] commit: ${HEAD_COMMIT:0:8}${NC}"
echo ""

# [HIGH FIX] merge-base 실패 시 명시적 오류 (silent pass 방지)
MERGE_BASE=$(git merge-base origin/main HEAD 2>/dev/null) || {
  echo -e "${RED}[architect] origin/main fetch 필요: git fetch origin main${NC}"
  exit 1
}

# diff를 임시 파일로 (PERF: 대형 diff 변수 적재 회피)
DIFF_FILE=$(mktemp)
trap 'rm -f "$DIFF_FILE"' EXIT

# [HIGH FIX] || true 제거 — git diff 실패 시 명시적 오류
git diff "$MERGE_BASE" HEAD -- \
  'src/engine/' \
  'src/constants/signalThresholds.js' \
  'src/utils/marketHours.js' \
  'src/utils/newsAlias.js' \
  'src/utils/newsTopicMap.js' \
  'src/utils/newsSignal.js' \
  'src/utils/signalCardRenderer.js' \
  'src/data/relatedAssets.js' \
  'src/hooks/useSignals.js' \
  'src/hooks/useDerivativeSignals.js' \
  'src/hooks/useInvestorSignals.js' \
  > "$DIFF_FILE" 2>&1 || {
  echo -e "${RED}[architect] git diff 실패 — git 상태 확인 필요${NC}"
  exit 1
}

DIFF_LINES=$(wc -l < "$DIFF_FILE" | tr -d ' ')
echo -e "${GREEN}[architect] 알고리즘 diff: ${DIFF_LINES}줄${NC}"

# [HIGH FIX] 임계값 0으로 하향 — 1줄 변경도 리뷰 필수
if [ "$DIFF_LINES" -eq 0 ]; then
  echo -e "${YELLOW}[architect] 알고리즘 파일 변경 없음 — 리뷰 불필요${NC}"
  {
    echo "VERDICT: NOT_REQUIRED"
    echo "commit: ${HEAD_COMMIT}"
    echo "reason: 알고리즘 파일 변경 없음"
  } > "$ARTIFACT_FILE"
  echo -e "${GREEN}[architect] 저장: ${ARTIFACT_FILE}${NC}"
  exit 0
fi

echo -e "${GREEN}[architect] claude Opus 설계 리뷰 시작${NC}"
echo ""

# [CRITICAL FIX] claude --print 방식으로 통일 (run-code-reviewer.sh 와 동일)
# [PERF FIX] max-tokens 4000으로 상향
REVIEW_OUTPUT=$(claude --print "당신은 시니어 소프트웨어 아키텍트입니다.
아래 diff를 보고 설계 관점에서 리뷰하세요.

## 리뷰 기준
1. 설계 일관성: 변경이 기존 아키텍처 패턴과 일관성이 있는가?
2. 엣지 케이스: 커버 안 된 시나리오가 있는가?
3. 데이터 흐름: 변경이 연결된 시스템에 예상치 못한 영향을 주는가?
4. 동기화 문제: 여러 파일/상수가 동기화되어야 하는데 누락된 게 있는가?
5. 성능: 반복 계산, 불필요한 재렌더링 가능성이 있는가?

## 출력 형식 (반드시 준수)
- 첫 줄 반드시: VERDICT: PASS 또는 VERDICT: BLOCK
- [BLOCK] 항목: 반드시 수정 후 진행
- [WARN] 항목: 권고사항 (PR 진행 가능)
- 각 항목에 구체적 파일명·라인 번호 명시

## Diff
$(cat "$DIFF_FILE")" 2>&1 || true)

if [ -z "$REVIEW_OUTPUT" ]; then
  # [HIGH FIX] 수동 입력 — VERDICT 하드코딩 제거, 사용자가 직접 VERDICT 포함해 입력
  echo -e "${YELLOW}[architect] Claude 응답 없음 — 수동 리뷰 입력${NC}"
  echo -e "${YELLOW}[architect] diff 요약 (상위 50줄):${NC}"
  head -50 "$DIFF_FILE"
  echo ""
  echo -e "${YELLOW}[architect] 설계 검토 후 리뷰를 입력하세요.${NC}"
  echo -e "${YELLOW}[architect] 반드시 'VERDICT: PASS' 또는 'VERDICT: BLOCK' 포함 후 Enter 두 번:${NC}"
  REVIEW_OUTPUT=""
  while IFS= read -r line; do
    [ -z "$line" ] && break
    REVIEW_OUTPUT="${REVIEW_OUTPUT}${line}
"
  done
fi

# VERDICT 추출 — head -1은 항상 exit 0이므로 || echo "UNKNOWN" 대신 명시적 빈값 검사
VERDICT=$(echo "$REVIEW_OUTPUT" | grep -oE 'VERDICT:[[:space:]]*(PASS|BLOCK|NOT_REQUIRED)' | awk '{print $2}' | head -1)
if [ -z "$VERDICT" ]; then VERDICT="UNKNOWN"; fi

if [ "$VERDICT" = "UNKNOWN" ]; then
  echo -e "${RED}[architect] VERDICT를 파싱할 수 없습니다. 'VERDICT: PASS' 또는 'VERDICT: BLOCK'을 포함해야 합니다.${NC}"
  exit 1
fi

{
  echo "VERDICT: ${VERDICT}"
  echo "commit: ${HEAD_COMMIT}"
  echo ""
  echo "$REVIEW_OUTPUT"
} > "$ARTIFACT_FILE"

echo ""
echo -e "${GREEN}[architect] 저장: ${ARTIFACT_FILE}${NC}"
echo -e "${GREEN}[architect] VERDICT: ${VERDICT}${NC}"

if [ "$VERDICT" = "BLOCK" ]; then
  echo -e "${RED}[architect] BLOCK — 설계 이슈 수정 후 재실행하세요${NC}"
  exit 1
fi

echo -e "${GREEN}[architect] 설계 리뷰 완료. npm run pr 진행 가능${NC}"
