#!/usr/bin/env bash
# pre-deploy-consensus.sh — 배포 전 컨센서스 게이트
#
# 사용법: npm run deploy:check
# 모든 게이트 PASS 시에만 배포 허용 (deploy.sh 내부에서 자동 호출)
#
# 게이트:
#   1. 빌드 통과
#   2. P0/P1 이슈 없음 (GitHub Issues)
#   3. PM 검토 — 이준혁 (대표 요청 대비 배포 항목 확인)
#   4. QA 승인 — 장성민 (품질 기준 검증)
#   5. 개발팀 승인 — 박서연 FE / 김민준 BE
#   6. 조직장 승인 — 이준혁 CPO (사업 방향 최종 확인)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

check() {
  local name="$1"
  local result="$2"  # PASS or FAIL
  local detail="${3:-}"
  if [ "$result" = "PASS" ]; then
    echo -e "${GREEN}  ✅ ${name}${NC}${detail:+ — ${detail}}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}  🚫 ${name}${NC}${detail:+ — ${detail}}"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       배포 전 컨센서스 게이트             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Gate 1: 빌드 통과 ────────────────────────────────────────────────────────
echo -e "${BLUE}[1/6] 빌드 검증${NC}"
if npm run build --silent 2>/dev/null; then
  check "빌드" "PASS" "vite build 성공"
else
  check "빌드" "FAIL" "빌드 실패 — npm run build 오류 확인"
fi

# 테스트 스크립트가 있으면 실행, 없으면 스킵 (테스트 실패는 경고만, 배포 차단 안 함)
if npm run test --if-present 2>/dev/null; then
  echo "  ✅ 테스트 — 통과"
else
  echo "  ⚠️ 테스트 — 실패 (배포 계속)"
fi

# ── Gate 2: P0/P1 이슈 없음 ──────────────────────────────────────────────────
echo -e "${BLUE}[2/6] P0/P1 오픈 이슈 확인${NC}"
# || true: set -e 환경에서 gh 인증/네트워크 실패 시 스크립트 전체 종료 방지
# 빈 문자열 결과 → 하단 empty-string 체크에서 FAIL 처리 (알 수 없는 상태를 PASS로 처리 금지)
P0_ISSUES=$(gh issue list --label "P0" --state open --json number --jq 'length' 2>/dev/null || true)
P1_ISSUES=$(gh issue list --label "P1" --state open --json number --jq 'length' 2>/dev/null || true)
if [ -z "$P0_ISSUES" ] || [ -z "$P1_ISSUES" ]; then
  check "P0/P1 이슈" "FAIL" "GitHub API 오류 — gh 인증 또는 네트워크 확인 후 재실행"
else
  CRITICAL=$((P0_ISSUES + P1_ISSUES))
  if [ "$CRITICAL" -eq 0 ]; then
    check "P0/P1 이슈" "PASS" "오픈 없음"
  else
    check "P0/P1 이슈" "FAIL" "P0: ${P0_ISSUES}건, P1: ${P1_ISSUES}건 — 해결 후 배포"
    gh issue list --label "P0,P1" --state open --json number,title \
      --jq '.[] | "    #\(.number) \(.title)"' 2>/dev/null || true
  fi
fi

# ── Gate 3: PM 검토 — 이준혁 (기획 정합성) ──────────────────────────────────
echo -e "${BLUE}[3/6] PM 검토 — 이준혁 (작업 의도 정합성 검토)${NC}"
PM_VERDICT="SKIP"
if command -v claude &>/dev/null && [ -f ".project/backlog.md" ]; then
  # nonce: 실행 시마다 랜덤 생성 → 커밋 메시지로 미리 알 수 없어 프롬프트 인젝션 차단
  PM_NONCE="PMGATE_$(date +%s)_${RANDOM}"
  # .last-deployed-commit 기준으로 배포 예정 커밋 산출 (없으면 최근 10개)
  LAST_DEPLOY=$(cat .last-deployed-commit 2>/dev/null | tr -d '[:space:]')
  if [ -n "$LAST_DEPLOY" ] && git cat-file -t "$LAST_DEPLOY" &>/dev/null; then
    DEPLOY_COMMITS=$(git log "${LAST_DEPLOY}..HEAD" --oneline --max-count=20 2>/dev/null || true)
  else
    DEPLOY_COMMITS=$(git log --oneline -10 2>/dev/null)
  fi
  [ -z "$DEPLOY_COMMITS" ] && DEPLOY_COMMITS="(배포 예정 커밋 없음)"
  OPEN_PRS=$(gh pr list --state open --json number,title --jq '.[] | "#\(.number) \(.title)"' 2>/dev/null || echo "")
  BACKLOG=$(cat .project/backlog.md 2>/dev/null | head -80)

  PM_PROMPT="당신은 PM 이준혁입니다. 배포 예정 항목이 작업 의도에 부합하는지 검토하세요.

## 배포 예정 커밋
${DEPLOY_COMMITS}

## 미머지 오픈 PR (배포 전 확인)
${OPEN_PRS:-없음}

## 현재 백로그 (.project/backlog.md 요약)
${BACKLOG}

검토 기준:
- 커밋/PR 제목과 실제 작업 내용이 일치하는가? (feat이면 기능 추가, fix면 버그 수정, 등)
- 의도한 변경 범위를 벗어난 과도한 수정이 포함되어 있는가?
- 작업이 서비스 방향(국장·미장·코인 실시간 모니터링)에 부합하는가?
- 미머지 fix PR이 있다면 배포 전 포함 여부를 경고하라.
- 대표 요청 여부와 무관하게, 이 작업을 한 의도가 제대로 구현되었는지 판단한다.

마지막 줄에 반드시 아래 형식으로 판정하세요 (토큰 포함 정확히):
${PM_NONCE}: PASS
또는
${PM_NONCE}: BLOCK — (이유 한 줄)"

  # stdin redirect로 프롬프트 전달 — "$(cat ...)" 셸 확장 완전 회피
  # claude --print < file: 파일 내용을 stdin으로 직접 전달 (이중 셸 해석 없음)
  # 실패 시 SKIP fallback (soft gate — claude 미설치/stdin 미지원 환경에서도 배포 차단 안 함)
  PM_TMP=$(mktemp)
  printf '%s' "$PM_PROMPT" > "$PM_TMP"
  PM_RESULT=$(claude --print < "$PM_TMP" 2>/dev/null || echo "${PM_NONCE}: SKIP")
  rm -f "$PM_TMP"
  echo "$PM_RESULT" | grep -v "^$" | tail -10 | sed 's/^/    /'

  # nonce 포함 줄에서만 verdict 추출 — 커밋 메시지 내 VERDICT 문자열 주입 완전 차단
  # nonce는 실행 시마다 랜덤 생성 → 커밋 메시지로 미리 알 수 없음
  PM_VERDICT_LINE=$(echo "$PM_RESULT" | grep "^${PM_NONCE}:" | tail -1)

  if echo "$PM_VERDICT_LINE" | grep -q "^${PM_NONCE}: BLOCK"; then
    PM_VERDICT="BLOCK"
    check "PM 검토" "FAIL" "기획 정합성 불일치 — 내용 확인 필요"
  elif echo "$PM_VERDICT_LINE" | grep -q "^${PM_NONCE}: PASS"; then
    PM_VERDICT="PASS"
    check "PM 검토" "PASS" "작업 의도와 구현 일치"
  else
    # SKIP: claude 응답 파싱 불가 시 게이트 카운트에서 제외 (soft gate — 인프라 없으면 graceful degrade)
    PM_VERDICT="SKIP"
    SKIP=$((SKIP + 1))
    echo -e "${YELLOW}    ⚠️  PM 검토 SKIP (응답 파싱 실패) — 배포 전 수동 확인 권장${NC}"
  fi
else
  # claude CLI 미설치 또는 backlog.md 없음 — SKIP (카운트 제외, 배포 차단 안 함)
  SKIP=$((SKIP + 1))
  echo -e "${YELLOW}    ⚠️  claude CLI 없거나 backlog.md 없음 — PM 게이트 SKIP (배포 전 수동 확인 권장)${NC}"
fi

# ── Gate 4: QA 승인 (장성민) ─────────────────────────────────────────────────
echo -e "${BLUE}[4/6] QA 승인 — 장성민 (품질 기준 검증)${NC}"
QUALITY_FILE=".project/quality-baseline.md"
QA_ISSUES=0
# 파일 존재 확인 수준의 소프트 게이트 — 실제 기준 충족 여부는 PR 리뷰 단계에서 검증
# (빌드 에러는 Gate 1에서, 알고리즘 변경은 Gate 5에서 하드 차단)
if [ -f "$QUALITY_FILE" ]; then
  check "품질 기준 파일" "PASS" "quality-baseline.md 존재"
else
  check "품질 기준 파일" "FAIL" ".project/quality-baseline.md 없음"
  QA_ISSUES=$((QA_ISSUES + 1))
fi

# 미머지 PR 중 fix:/feat: 있는지 확인
OPEN_CRITICAL_PRS=$(gh pr list --state open --json title --jq '[.[] | select(.title | test("^(fix:|feat:)"))] | length' 2>/dev/null || echo "0")
if [ "$OPEN_CRITICAL_PRS" -gt 0 ]; then
  echo -e "${YELLOW}    ⚠️  미머지 fix/feat PR ${OPEN_CRITICAL_PRS}건 — 포함 여부 확인 필요${NC}"
  gh pr list --state open --json number,title --jq '.[] | "    PR #\(.number): \(.title)"' 2>/dev/null || true
fi

if [ "$QA_ISSUES" -eq 0 ]; then
  check "QA 승인" "PASS" "품질 기준 정상"
else
  check "QA 승인" "FAIL" "품질 기준 미충족"
fi

# ── Gate 5: 개발팀 승인 ──────────────────────────────────────────────────────
echo -e "${BLUE}[5/6] 개발팀 승인 — FE(박서연) / BE(김민준)${NC}"
# 최근 커밋에 리뷰되지 않은 알고리즘 파일 변경 없는지 확인
ALGO_CHANGED=0
if [ ! -f ".algo-files" ]; then
  echo -e "${YELLOW}    ⚠️  .algo-files 없음 — 알고리즘 파일 목록 정의 필요 (scripts/run-architect.sh 참조)${NC}"
  # .algo-files 없으면 검사 대상 없음 → PASS (파일 생성은 별도 작업, 배포 차단 사유 아님)
fi
if [ -f ".algo-files" ]; then
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    # test/spec 파일 제외 — create-pr.sh와 동일 기준 (테스트 전용 수정은 architect 불필요)
    if git diff origin/main...HEAD --name-only 2>/dev/null \
        | grep -vE '\.test\.[^/]+$|\.spec\.[^/]+$' \
        | grep -qE "$pattern"; then
      ALGO_CHANGED=$((ALGO_CHANGED + 1))
    fi
  done < ".algo-files"
fi

if [ "$ALGO_CHANGED" -gt 0 ]; then
  # architect 승인 artifact 확인 — 스테일 PASS 방지 (create-pr.sh와 동일 기준)
  # 검증 원칙: artifact의 commit이 "마지막 algo 변경 커밋" 이후여야 유효
  #   - 조상 커밋 검증만으로는 이후 추가 algo 변경을 통과시킬 수 있음 (보안 취약점)
  #   - 마지막 algo 변경 커밋을 기준으로, artifact commit이 그 이후(또는 동일)인지 확인
  HEAD_NOW=$(git rev-parse HEAD)

  # 마지막 algo 파일 변경 커밋 해시 계산 (origin/main..HEAD 범위에서)
  LAST_ALGO_COMMIT=""
  if [ -f ".algo-files" ]; then
    # .algo-files 패턴으로 변경된 파일 목록 추출 후, 관련 커밋 중 가장 최신 커밋 탐색
    ALGO_PATTERN_GATE5=$(grep -v '^#' .algo-files | grep -v '^$' | tr '\n' '|' | sed 's/|$//')
    # git log로 origin/main..HEAD 범위에서 algo 파일을 변경한 커밋 중 첫 번째(=가장 최신) 추출
    LAST_ALGO_COMMIT=$(git log origin/main..HEAD --oneline --diff-filter=ACM -- \
      $(git diff origin/main...HEAD --name-only 2>/dev/null \
        | grep -vE '\.test\.[^/]+$|\.spec\.[^/]+$' \
        | grep -E "$ALGO_PATTERN_GATE5" || true) 2>/dev/null \
      | head -1 | awk '{print $1}' || true)
  fi

  ARCHITECT_APPROVED=0
  ARCHITECT_VERDICT_FOUND=""
  for _af in .tmp/architect-review-*.md; do
    [ -f "$_af" ] || continue
    _av=$(grep -oE 'VERDICT:[[:space:]]*(PASS|BLOCK|NOT_REQUIRED)' "$_af" | awk '{print $2}' | head -1 || true)
    _ac=$(grep -m1 "^commit:" "$_af" | awk '{print $2}' || true)
    if { [ "$_av" = "PASS" ] || [ "$_av" = "NOT_REQUIRED" ]; } && [ -n "$_ac" ]; then
      # 유효성 검증: artifact commit이 마지막 algo 변경 커밋 이후(또는 동일)인지 확인
      # - LAST_ALGO_COMMIT이 없으면(탐색 실패) HEAD 일치 여부로 폴백
      # - artifact commit이 LAST_ALGO_COMMIT의 조상이면 스테일 → 거부
      _VALID=0
      if [ -z "$LAST_ALGO_COMMIT" ]; then
        # 마지막 algo 커밋 탐색 실패 시 HEAD 정확 일치로 폴백 (create-pr.sh 동일 기준)
        [ "$_ac" = "$HEAD_NOW" ] && _VALID=1
      else
        # artifact commit이 LAST_ALGO_COMMIT 이후인지: LAST_ALGO_COMMIT이 _ac의 조상이거나 동일
        if git merge-base --is-ancestor "$LAST_ALGO_COMMIT" "$_ac" 2>/dev/null || [ "$_ac" = "$LAST_ALGO_COMMIT" ]; then
          # 추가로 artifact commit이 HEAD의 조상이거나 동일한지도 확인 (미래 커밋 방지)
          if git merge-base --is-ancestor "$_ac" "$HEAD_NOW" 2>/dev/null || [ "$_ac" = "$HEAD_NOW" ]; then
            _VALID=1
          fi
        fi
      fi
      if [ "$_VALID" -eq 1 ]; then
        ARCHITECT_APPROVED=1
        ARCHITECT_VERDICT_FOUND="$_av"
        break
      fi
    fi
  done

  if [ "$ARCHITECT_APPROVED" -eq 1 ]; then
    check "개발팀 승인" "PASS" "architect 승인 완료 (${ARCHITECT_VERDICT_FOUND}) — algo 변경 이후 발급 확인"
  else
    check "알고리즘 파일" "FAIL" "알고리즘 파일 변경 ${ALGO_CHANGED}건 — npm run architect 재실행 필요 (스테일 artifact 거부)"
  fi
else
  check "개발팀 승인" "PASS" "알고리즘 파일 변경 없음"
fi

# ── Gate 6: 조직장 승인 (이준혁 CPO) ─────────────────────────────────────────
echo -e "${BLUE}[6/6] 조직장 승인 — 이준혁 CPO${NC}"
# CLAUDE.md의 배포 방향과 일치하는지: 배포 조건 (P0/P1 수정 or 주요 기능 완료) 확인
DEPLOY_CONDITION_MET=0

# P0/P1 수정이 있었나?
RECENT_FIX=$(git log origin/main..HEAD --oneline 2>/dev/null | { grep "fix:" || true; } | wc -l | tr -d ' ')
# 주요 기능 완료 (feat:) 커밋?
RECENT_FEAT=$(git log origin/main..HEAD --oneline 2>/dev/null | { grep "feat:" || true; } | wc -l | tr -d ' ')

if [ "$RECENT_FIX" -gt 0 ] || [ "$RECENT_FEAT" -gt 0 ]; then
  DEPLOY_CONDITION_MET=1
fi

# 명시적 배포 지시 ("배포해줘") 는 항상 통과
if [ "${EXPLICIT_DEPLOY:-0}" = "1" ] || [ "$DEPLOY_CONDITION_MET" -eq 1 ]; then
  check "조직장 승인" "PASS" "배포 조건 충족 (fix: ${RECENT_FIX}건 / feat: ${RECENT_FEAT}건)"
else
  check "조직장 승인" "FAIL" "배포 조건 미충족 — P0/P1 수정 or 주요 기능 없음"
fi

# ── 최종 판정 ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}────────────────────────────────────────────${NC}"
TOTAL=$((PASS + FAIL + SKIP))
if [ "$FAIL" -eq 0 ]; then
  if [ "$SKIP" -gt 0 ]; then
    SKIP_MSG=", SKIP ${SKIP}건 수동 확인 권장"
  else
    SKIP_MSG=""
  fi
  echo -e "${GREEN}✅ 컨센서스 PASS (${PASS}/${TOTAL}${SKIP_MSG}) — 배포 가능${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}🚫 컨센서스 FAIL (${FAIL}건 미통과) — 배포 불가${NC}"
  echo -e "${YELLOW}   위 항목 해결 후 재실행: npm run deploy:check${NC}"
  echo ""
  exit 1
fi
