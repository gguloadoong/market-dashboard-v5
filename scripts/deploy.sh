#!/usr/bin/env bash
# deploy.sh — 스마트 배포 스크립트
#
# 동작:
# 1. 현재 HEAD가 이미 배포된 커밋이면 중단 (이중 배포 방지)
# 2. GitHub Actions 트리거 → 결과 대기
# 3. GA 실패 시 원인 파악 → 토큰 문제면 vercel --prod fallback
# 4. 배포 성공 시 .last-deployed-commit 갱신

set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
WORKFLOW="Deploy to Vercel"
LAST_DEPLOYED_FILE=".last-deployed-commit"
CURRENT_COMMIT=$(git rev-parse HEAD)

# ── 1. 이중 배포 방지 ─────────────────────────────────────────────
if [ -f "$LAST_DEPLOYED_FILE" ]; then
  LAST_COMMIT=$(cat "$LAST_DEPLOYED_FILE")
  if [ "$LAST_COMMIT" = "$CURRENT_COMMIT" ]; then
    echo "✅ 이미 배포된 커밋입니다 (${CURRENT_COMMIT:0:7}). 배포 생략."
    exit 0
  fi
fi

echo "🚀 배포 시작 — HEAD: ${CURRENT_COMMIT:0:7}"
echo ""

# ── 2. GitHub Actions 트리거 ──────────────────────────────────────
echo "▶ GitHub Actions 트리거 중..."
RUN_URL=$(gh workflow run "$WORKFLOW" --ref main 2>&1)
echo "  $RUN_URL"

# 실행 ID 조회 (최신 run)
sleep 5
RUN_ID=$(gh run list --workflow="$WORKFLOW" --limit 1 --json databaseId -q '.[0].databaseId')
echo "  Run ID: $RUN_ID"
echo ""

# ── 3. 결과 대기 (최대 5분) ──────────────────────────────────────
echo "⏳ GitHub Actions 결과 대기 중..."
WAIT=0
MAX_WAIT=300
STATUS=""
CONCLUSION=""

while [ $WAIT -lt $MAX_WAIT ]; do
  sleep 10
  WAIT=$((WAIT + 10))
  STATUS=$(gh run view "$RUN_ID" --json status -q '.status' 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "completed" ]; then
    CONCLUSION=$(gh run view "$RUN_ID" --json conclusion -q '.conclusion' 2>/dev/null || echo "unknown")
    break
  fi
  echo "  대기 중... (${WAIT}s)"
done

echo ""

# ── 4. 성공 처리 ─────────────────────────────────────────────────
if [ "$CONCLUSION" = "success" ]; then
  echo "✅ GitHub Actions 배포 성공!"
  echo "$CURRENT_COMMIT" > "$LAST_DEPLOYED_FILE"
  echo ""
  echo "🌐 https://market-dashboard-v5.vercel.app"
  exit 0
fi

# ── 5. 실패 분석 → Fallback ──────────────────────────────────────
echo "❌ GitHub Actions 배포 실패 (conclusion: $CONCLUSION)"
echo ""

# 실패 로그에서 토큰 오류 감지
FAIL_LOG=$(gh run view "$RUN_ID" --log-failed 2>/dev/null || echo "")
if echo "$FAIL_LOG" | grep -q "token provided via.*argument is not valid\|The token.*is not valid\|Invalid token"; then
  echo "⚠️  원인: VERCEL_TOKEN 만료 또는 무효"
  echo "   → vercel --prod CLI fallback으로 배포합니다"
  echo ""
  vercel --prod --yes
  echo ""
  echo "✅ vercel --prod 배포 완료"
  echo "$CURRENT_COMMIT" > "$LAST_DEPLOYED_FILE"
  echo ""
  echo "⚠️  VERCEL_TOKEN을 무기한 토큰으로 교체하세요:"
  echo "   1. https://vercel.com/account/tokens → 새 토큰 (No Expiration)"
  echo "   2. GitHub Settings → Secrets → VERCEL_TOKEN 업데이트"
  echo ""
  echo "🌐 https://market-dashboard-v5.vercel.app"
else
  echo "⚠️  원인: 토큰 외 다른 문제. 로그 확인 필요:"
  echo "   gh run view $RUN_ID --log-failed"
  echo ""
  echo "❌ 자동 fallback 불가. 수동 확인 후 재시도하세요."
  exit 1
fi
