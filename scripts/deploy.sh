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
WORKERS_LAST_DEPLOYED_FILE=".last-deployed-workers-commit"
WORKERS_DIR="workers/cron"
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# Vercel GA는 --ref main 고정. 로컬이 main 이 아니면 Vercel(main)과 Workers(local)가
# 서로 다른 리비전을 배포해 프론트↔크론 불일치 발생. 사전 차단. (#160 Codex P1)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ 배포는 main 브랜치에서만 실행하세요 (현재: ${CURRENT_BRANCH})"
  echo "   이유: Vercel GA 는 --ref main 고정이므로 다른 브랜치에서 실행 시"
  echo "   Vercel(main) ≠ CF Workers(로컬) 리비전 불일치 발생."
  echo "   조치: git checkout main && git pull && npm run deploy"
  exit 1
fi
# origin/main 과 최신 동기화 확인 — fetch 성공 필수 (#160 Codex P2)
# fetch 실패 시 무조건 abort. 이유: 로컬이 stale 일 수 있는데 "배포됨" 기록 시
# .last-deployed-commit 에 실제 미배포 커밋이 쓰여 다음 실행이 잘못 skip 됨.
if ! git fetch origin main --quiet 2>/dev/null; then
  echo "❌ git fetch origin main 실패 — 네트워크/인증 확인 후 재시도"
  echo "   이유: GA 는 origin/main 배포 → 로컬이 stale 이면 잘못된 커밋을 배포됨으로 기록"
  exit 1
fi
ORIGIN_MAIN=$(git rev-parse origin/main 2>/dev/null || echo "")
if [ -z "$ORIGIN_MAIN" ]; then
  echo "❌ origin/main ref 조회 실패 — git 원격 설정 확인"
  exit 1
fi
if [ "$ORIGIN_MAIN" != "$CURRENT_COMMIT" ]; then
  # ahead/behind 구분해서 명확히 안내 (#160 재리뷰 HIGH)
  if git merge-base --is-ancestor "$CURRENT_COMMIT" "$ORIGIN_MAIN" 2>/dev/null; then
    echo "⚠️  로컬이 origin/main 보다 뒤처짐 (${CURRENT_COMMIT:0:7} → ${ORIGIN_MAIN:0:7})"
    echo "   조치: git pull --ff-only && npm run deploy"
  elif git merge-base --is-ancestor "$ORIGIN_MAIN" "$CURRENT_COMMIT" 2>/dev/null; then
    echo "⚠️  로컬이 origin/main 보다 앞섬 (${ORIGIN_MAIN:0:7} → ${CURRENT_COMMIT:0:7})"
    echo "   조치: git push origin main 후 npm run deploy"
  else
    echo "⚠️  로컬과 origin/main 이 분기됨 (로컬 ${CURRENT_COMMIT:0:7} ↔ 원격 ${ORIGIN_MAIN:0:7})"
    echo "   조치: git log로 분기 지점 확인 후 rebase/merge"
  fi
  exit 1
fi

# CF Workers 변경 시 wrangler deploy — Vercel 배포 성공 후 호출
# (#160) 자동화로 "배포는 했는데 Workers는 까먹음" 방지
# Return: 0 = 실제 동기화 상태 (변경 없음 OR 배포 성공)
#         1 = 배포 필요한데 실패 (wrangler 미설치 포함)
deploy_workers_if_changed() {
  if [ ! -d "$WORKERS_DIR" ]; then
    return 0  # workers 디렉토리 없는 체크아웃 — skip (정상)
  fi

  local workers_last=""
  if [ -f "$WORKERS_LAST_DEPLOYED_FILE" ]; then
    workers_last=$(cat "$WORKERS_LAST_DEPLOYED_FILE")
  fi

  if [ -n "$workers_last" ] && git cat-file -e "$workers_last^{commit}" 2>/dev/null \
     && git diff --quiet "$workers_last" HEAD -- "$WORKERS_DIR" 2>/dev/null; then
    echo "✅ CF Workers 변경 없음 — wrangler deploy 생략"
    return 0
  fi

  # 여기부터는 "배포 필요" 확정. wrangler 없거나 실패 시 1 반환 — 동기화 거짓 보고 금지 (#160 Codex P2)
  if ! command -v wrangler &>/dev/null; then
    echo "❌ wrangler CLI 미설치 + CF Workers 변경 존재 → 크론 뒤처짐 상태"
    echo "   조치: npm i -g wrangler && cd $WORKERS_DIR && wrangler deploy"
    return 1
  fi

  # workers/cron 에 미커밋 변경이 있으면 거부 (#160 Codex P1)
  # 이유: wrangler deploy 는 파일시스템을 배포하므로 미커밋 에디트가 prod 에 올라가고
  # .last-deployed-workers-commit 에는 HEAD 만 기록돼 다음 run 이 "in sync" 로 오인.
  if ! git diff --quiet HEAD -- "$WORKERS_DIR" 2>/dev/null; then
    echo "❌ $WORKERS_DIR 에 미커밋 변경 감지 — wrangler deploy 거부"
    echo "   이유: 미커밋 코드가 prod 에 배포되면 추적 불가 + 복구 어려움"
    echo "   조치: git status로 확인 → stash 또는 commit 후 재실행"
    return 1
  fi

  echo "🔧 CF Workers 변경 감지 — wrangler deploy 실행"
  if (cd "$WORKERS_DIR" && wrangler deploy); then
    echo "$CURRENT_COMMIT" > "$WORKERS_LAST_DEPLOYED_FILE"
    echo "✅ CF Workers 배포 성공 — 크론 최신 커밋으로 동기화"
    return 0
  else
    echo "❌ CF Workers 배포 실패 — Vercel 프론트는 배포됨. 수동 확인 필요 (cd $WORKERS_DIR && wrangler deploy)"
    return 1
  fi
}

# ── 1. 이중 배포 방지 ─────────────────────────────────────────────
# Vercel 이 같은 커밋에 이미 배포됐으면 skip. 단 Workers 가 뒤처져있으면 Workers만 재동기화.
# 이 경로의 Workers 실패는 exit 1 (의도적) — main 경로(|| true)와 비대칭이지만,
# 여기선 Workers 가 배포 액션 전부이므로 실패 = 작업 실패. main 은 Vercel 성공 후 부가 단계라 smoke test 진행 목적.
if [ -f "$LAST_DEPLOYED_FILE" ]; then
  LAST_COMMIT=$(cat "$LAST_DEPLOYED_FILE")
  if [ "$LAST_COMMIT" = "$CURRENT_COMMIT" ]; then
    echo "ℹ️  Vercel 은 이미 ${CURRENT_COMMIT:0:7} 에 배포됨. CF Workers 동기화 상태 확인..."
    if deploy_workers_if_changed; then
      echo "✅ 전체 배포 완료 상태. 생략."
      exit 0
    fi
    echo "❌ Workers 배포 실패. 수동 확인 후 재시도."
    exit 1
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

  # ── CF Workers 배포 ─────────────────────────────────────────────
  deploy_workers_if_changed || true
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

  # ── CF Workers 배포 (fallback 경로에서도 동일) ──────────────────
  deploy_workers_if_changed || true
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
