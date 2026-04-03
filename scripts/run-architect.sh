#!/usr/bin/env bash
# run-architect.sh — architect(Claude Opus) 설계 리뷰
#
# 알고리즘/비즈니스로직 파일 수정 전 설계 단계 강제 실행
# 결과: .tmp/architect-review-{BRANCH}.md 저장
# create-pr.sh가 이 artifact를 체크해 없으면 PR 차단

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BRANCH=$(git rev-parse --abbrev-ref HEAD)
HEAD_COMMIT=$(git rev-parse HEAD)
ARTIFACT_DIR=".tmp"
mkdir -p "$ARTIFACT_DIR"
ARTIFACT_FILE="${ARTIFACT_DIR}/architect-review-${BRANCH}.md"

echo -e "${GREEN}[architect] branch: ${BRANCH}${NC}"
echo -e "${GREEN}[architect] commit: ${HEAD_COMMIT:0:8}${NC}"
echo ""

# diff 생성 (origin/main 대비)
DIFF=$(git diff "$(git merge-base origin/main HEAD)" HEAD -- \
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
  2>/dev/null || true)

DIFF_LINES=$(echo "$DIFF" | wc -l | tr -d ' ')
echo -e "${GREEN}[architect] 알고리즘 diff: ${DIFF_LINES}줄${NC}"

if [ "$DIFF_LINES" -lt 3 ]; then
  echo -e "${YELLOW}[architect] 알고리즘 파일 변경 없음 — 리뷰 불필요${NC}"
  # artifact에 "불필요" 기록
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

# Claude Opus architect 프롬프트
PROMPT=$(cat <<'PROMPT_EOF'
당신은 시니어 소프트웨어 아키텍트입니다.
아래 diff를 보고 설계 관점에서 리뷰하세요.

## 리뷰 기준
1. **설계 일관성**: 변경이 기존 아키텍처 패턴과 일관성이 있는가?
2. **엣지 케이스**: 커버 안 된 시나리오가 있는가?
3. **데이터 흐름**: 변경이 연결된 시스템에 예상치 못한 영향을 주는가?
4. **동기화 문제**: 여러 파일/상수가 동기화되어야 하는데 누락된 게 있는가?
5. **성능**: 반복 계산, 불필요한 재렌더링 가능성이 있는가?

## 출력 형식
- VERDICT: PASS | BLOCK
- [BLOCK] 항목: 반드시 수정 후 진행
- [WARN] 항목: 권고사항 (PR 진행 가능)
- 각 항목에 구체적 파일명·라인 번호 명시

## Diff
PROMPT_EOF
)

FULL_PROMPT="${PROMPT}

\`\`\`diff
${DIFF}
\`\`\`"

# Claude CLI로 Opus 호출
REVIEW=$(echo "$FULL_PROMPT" | claude --model claude-opus-4-6 --max-tokens 2000 -p "" 2>/dev/null || echo "")

if [ -z "$REVIEW" ]; then
  # claude CLI 없거나 실패 시 수동 입력 요청
  echo -e "${YELLOW}[architect] Claude CLI 호출 실패 — 수동 리뷰 입력${NC}"
  echo -e "${YELLOW}[architect] diff를 보고 설계 이슈를 직접 입력 (VERDICT: PASS/BLOCK 포함):${NC}"
  echo "$DIFF" | head -50
  echo ""
  echo -n "[architect] 리뷰 입력 (한 줄): "
  read -r MANUAL_REVIEW
  REVIEW="VERDICT: PASS
commit: ${HEAD_COMMIT}
(수동 리뷰) ${MANUAL_REVIEW}"
fi

# VERDICT 추출
VERDICT=$(echo "$REVIEW" | grep -oE 'VERDICT:[[:space:]]*(PASS|BLOCK|NOT_REQUIRED)' | awk '{print $2}' | head -1 || echo "UNKNOWN")

{
  echo "VERDICT: ${VERDICT}"
  echo "commit: ${HEAD_COMMIT}"
  echo ""
  echo "$REVIEW"
} > "$ARTIFACT_FILE"

echo ""
echo -e "${GREEN}[architect] 저장: ${ARTIFACT_FILE}${NC}"
echo -e "${GREEN}[architect] VERDICT: ${VERDICT}${NC}"

if [ "$VERDICT" = "BLOCK" ]; then
  echo -e "${RED}[architect] BLOCK — 설계 이슈 수정 후 재실행하세요${NC}"
  exit 1
fi

echo -e "${GREEN}[architect] 설계 리뷰 완료. npm run pr 진행 가능${NC}"
