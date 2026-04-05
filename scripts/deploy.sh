#!/usr/bin/env bash
# deploy.sh — 스마트 배포 스크립트
#
# 동작:
# 1. 현재 HEAD가 이미 배포된 커밋이면 중단 (이중 배포 방지)
# 2. GitHub Actions 트리거 → 결과 대기
# 3. GA 실패 시 원인 파악 → 토큰 문제면 vercel --prod fallback
# 4. 배포 성공 시 .last-deployed-commit 갱신

set -euo pipefail

# ── 0. 배포 전 컨센서스 게이트 ────────────────────────────────────
EXPLICIT_DEPLOY=1 bash "$(dirname "$0")/pre-deploy-consensus.sh"
echo ""

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

  # ── Smoke Test ──────────────────────────────────────────────────
  echo "🔍 배포 후 Smoke Test 시작 (30초 대기)..."
  sleep 30

  SMOKE_URL="https://market-dashboard-v5.vercel.app/api/snapshot"
  SMOKE_RESP=$(curl -s "$SMOKE_URL" || echo "")

  if [ -n "$SMOKE_RESP" ]; then
    # kr, us, coins 배열 중 하나라도 비어있지 않으면 PASS
    KR_LEN=$(echo "$SMOKE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('kr',[])))" 2>/dev/null || echo "0")
    US_LEN=$(echo "$SMOKE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('us',[])))" 2>/dev/null || echo "0")
    COINS_LEN=$(echo "$SMOKE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('coins',[])))" 2>/dev/null || echo "0")

    if [ "$KR_LEN" -gt 0 ] || [ "$US_LEN" -gt 0 ] || [ "$COINS_LEN" -gt 0 ]; then
      echo "  ✅ Smoke Test PASS — kr:${KR_LEN} us:${US_LEN} coins:${COINS_LEN}"
    else
      echo "  ⚠️  CRITICAL: Smoke Test 실패 — 모든 마켓 데이터 비어있음 (장외시간 가능성 있음)"
      echo "  kr:${KR_LEN} us:${US_LEN} coins:${COINS_LEN}"
      echo "  수동 확인: curl -s $SMOKE_URL | python3 -m json.tool"
      # exit 1 하지 않음 — 장외시간에는 정상적으로 비어있을 수 있음
    fi
  else
    echo "  ⚠️  CRITICAL: Smoke Test 실패 — API 응답 없음"
    echo "  수동 확인: curl -s $SMOKE_URL"
  fi

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

  # ── Smoke Test (fallback 배포) ─────────────────────────────────
  echo "🔍 배포 후 Smoke Test 시작 (30초 대기)..."
  sleep 30

  SMOKE_URL="https://market-dashboard-v5.vercel.app/api/snapshot"
  SMOKE_RESP=$(curl -s "$SMOKE_URL" || echo "")

  if [ -n "$SMOKE_RESP" ]; then
    KR_LEN=$(echo "$SMOKE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('kr',[])))" 2>/dev/null || echo "0")
    US_LEN=$(echo "$SMOKE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('us',[])))" 2>/dev/null || echo "0")
    COINS_LEN=$(echo "$SMOKE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('coins',[])))" 2>/dev/null || echo "0")

    if [ "$KR_LEN" -gt 0 ] || [ "$US_LEN" -gt 0 ] || [ "$COINS_LEN" -gt 0 ]; then
      echo "  ✅ Smoke Test PASS — kr:${KR_LEN} us:${US_LEN} coins:${COINS_LEN}"
    else
      echo "  ⚠️  CRITICAL: Smoke Test 실패 — 모든 마켓 데이터 비어있음 (장외시간 가능성 있음)"
      echo "  kr:${KR_LEN} us:${US_LEN} coins:${COINS_LEN}"
    fi
  else
    echo "  ⚠️  CRITICAL: Smoke Test 실패 — API 응답 없음"
  fi

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
