#!/usr/bin/env bash
# update-project-docs.sh — PR 완료 후 프로젝트 문서 자동 현행화
#
# 호출: create-pr.sh Step 5 (PR 생성 직후 자동), 또는 단독 실행
# 업데이트 대상:
#   1. THINKING.md     — 의사결정 케이스 초안 자동 추가
#   2. ai-coding-pitfalls.md — 리뷰에서 발견된 신규 패턴 감지
#   3. README.md       — feat: 커밋 포함 시 기능 표 검토 알림

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BRANCH=$(git rev-parse --abbrev-ref HEAD)
SAFE_BRANCH="${BRANCH//\//-}"
REVIEW_FILE=".tmp/code-review-${SAFE_BRANCH}.md"

echo ""
echo -e "${BLUE}[docs] 프로젝트 문서 현행화 시작${NC}"

# ── 기본 정보 수집 ───────────────────────────────────────────────
COMMITS=$(git log origin/main..HEAD --oneline 2>/dev/null | head -10 || echo "(커밋 없음)")
HAS_FEAT=$(echo "$COMMITS" | grep -c "^[a-f0-9]* feat:" || true)
HAS_FIX=$(echo "$COMMITS" | grep -c "^[a-f0-9]* fix:" || true)
LAST_CASE=$(grep "^## Case" THINKING.md 2>/dev/null | grep -oE "Case [0-9]+" | tail -1 | grep -oE "[0-9]+" || echo "0")
NEXT_CASE=$((LAST_CASE + 1))

# ── 1. THINKING.md — 의사결정 케이스 초안 자동 생성 ──────────────
echo -e "${BLUE}[docs] THINKING.md 케이스 초안 생성 중...${NC}"

if command -v claude &>/dev/null; then
  OPUS_SUMMARY=""
  [ -f "$REVIEW_FILE" ] && OPUS_SUMMARY=$(grep -m3 "\[HIGH\]\|\[CRITICAL\]\|VERDICT" "$REVIEW_FILE" 2>/dev/null | head -3 | sed 's/^/  /' || true)

  THINKING_PROMPT="당신은 PM 이준혁입니다. 아래 개발 활동을 바탕으로 THINKING.md의 의사결정 케이스 초안을 작성하세요.

## 이번 브랜치 커밋
${COMMITS}

## Opus 리뷰 주요 지적 (있는 경우)
${OPUS_SUMMARY:-없음}

## 작성 규칙
- Case ${NEXT_CASE}. \"[제목]\" 형식
- 핵심 판단 한 줄, 문제 인식, 내 판단, PM으로서 배운 것 섹션 필수
- 200자 이내 간결하게
- 오늘 날짜: $(date '+%Y-%m-%d')
- 마지막 줄: DRAFT_DONE

케이스가 기록할 만한 의사결정이 없으면(단순 fix 등) 'SKIP'만 출력"

  THINKING_TMP=$(mktemp)
  printf '%s' "$THINKING_PROMPT" > "$THINKING_TMP"
  THINKING_RESULT=$(claude --print < "$THINKING_TMP" 2>/dev/null || echo "SKIP")
  rm -f "$THINKING_TMP"

  if echo "$THINKING_RESULT" | grep -q "DRAFT_DONE"; then
    # DRAFT_DONE 이전 내용만 추출해서 THINKING.md에 추가
    DRAFT=$(echo "$THINKING_RESULT" | sed '/DRAFT_DONE/d')
    echo "" >> THINKING.md
    echo "$DRAFT" >> THINKING.md
    echo -e "${GREEN}[docs] THINKING.md Case ${NEXT_CASE} 초안 추가됨 (검토 후 편집 권장)${NC}"
  elif echo "$THINKING_RESULT" | grep -q "SKIP"; then
    echo -e "${YELLOW}[docs] THINKING.md — 기록할 의사결정 없음 (SKIP)${NC}"
  else
    echo -e "${YELLOW}[docs] THINKING.md — claude 응답 파싱 실패, 수동 기록 권장${NC}"
  fi
else
  echo -e "${YELLOW}[docs] claude CLI 없음 — THINKING.md 수동 업데이트 권장${NC}"
fi

# ── 2. ai-coding-pitfalls.md — 신규 패턴 감지 ───────────────────
echo -e "${BLUE}[docs] ai-coding-pitfalls.md 패턴 검토 중...${NC}"

if [ -f "$REVIEW_FILE" ] && command -v claude &>/dev/null; then
  PITFALL_PROMPT="아래 코드 리뷰 결과를 보고, .project/ai-coding-pitfalls.md에 추가할 만한 **신규 AI 코딩 패턴**이 있는지 판단하세요.

## 리뷰 결과 요약
$(tail -30 "$REVIEW_FILE" 2>/dev/null)

## 기존 패턴 목록 (중복 방지)
$(grep "^### [0-9]" .project/ai-coding-pitfalls.md 2>/dev/null || echo "없음")

신규 패턴이 있으면: PATTERN_FOUND: [패턴 제목 한 줄]
없으면: NO_NEW_PATTERN"

  PITFALL_TMP=$(mktemp)
  printf '%s' "$PITFALL_PROMPT" > "$PITFALL_TMP"
  PITFALL_RESULT=$(claude --print < "$PITFALL_TMP" 2>/dev/null || echo "NO_NEW_PATTERN")
  rm -f "$PITFALL_TMP"

  if echo "$PITFALL_RESULT" | grep -q "PATTERN_FOUND:"; then
    PATTERN=$(echo "$PITFALL_RESULT" | grep "PATTERN_FOUND:" | sed 's/PATTERN_FOUND: //')
    echo -e "${YELLOW}[docs] 신규 패턴 감지: ${PATTERN}${NC}"
    echo -e "${YELLOW}[docs] .project/ai-coding-pitfalls.md 수동 추가 권장${NC}"
  else
    echo -e "${GREEN}[docs] ai-coding-pitfalls.md — 신규 패턴 없음${NC}"
  fi
fi

# ── 3. README.md — feat: 커밋 시 기능 표 검토 알림 ──────────────
if [ "$HAS_FEAT" -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}[docs] ⚠️  feat: 커밋 ${HAS_FEAT}건 감지 — README.md 기능 표 검토 필요${NC}"
  echo -e "${YELLOW}[docs] 신규 기능이 README Features 표에 반영되었는지 확인하세요${NC}"
  echo -e "${YELLOW}[docs] 확인: README.md ## Features 섹션${NC}"
fi

echo ""
echo -e "${GREEN}[docs] 문서 현행화 완료${NC}"
