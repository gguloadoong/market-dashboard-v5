#!/bin/bash
# check-context-pct.sh — PostToolUse hook: monitor session context usage
#
# WHY THIS EXISTS:
# Long Claude Code sessions drift into context bloat. /compact loses the "why"
# behind decisions; 95% saturation ships garbage summaries. This hook watches the
# session transcript size and injects graduated guidance (60/80/95 thresholds)
# so Claude self-manages context without CEO intervention.
#
# Reference: Anthropic "harness design for long-running apps" — structured
# handoff pattern. idea-factory skills/start-company/phases.md:268-279.
#
# TRIGGER: PostToolUse (all tools)
# PRINCIPLE: Silent until threshold; fire once per level per session.

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)

[ -z "$TRANSCRIPT_PATH" ] && exit 0
[ -f "$TRANSCRIPT_PATH" ] || exit 0

# Calibration: Opus 4.7 (1M context) saturates around ~4MB of jsonl transcript.
# Env overrides allow tuning as empirical data accumulates.
CTX_FULL_BYTES=${CTX_FULL_BYTES:-4194304}
SIZE=$(stat -f%z "$TRANSCRIPT_PATH" 2>/dev/null || stat -c%s "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)
[ "$SIZE" -eq 0 ] && exit 0

PCT=$(( SIZE * 100 / CTX_FULL_BYTES ))

SENTINEL_DIR="${TMPDIR:-/tmp}/mkt-v5-ctx"
mkdir -p "$SENTINEL_DIR" 2>/dev/null || exit 0
SID_KEY=$(echo "$SESSION_ID" | tr -c 'a-zA-Z0-9' '_' | cut -c1-64)

fire_once() {
  local level=$1
  local sentinel="$SENTINEL_DIR/${SID_KEY}-${level}"
  [ -f "$sentinel" ] && return 1
  touch "$sentinel" 2>/dev/null
  return 0
}

REPO_ROOT=$(cd "$(dirname "$0")/../.." && pwd)

if [ "$PCT" -ge 95 ]; then
  if fire_once 95; then
    cat <<EOF
[CONTEXT 95%+ — HARD STOP]
세션 컨텍스트가 ${PCT}% 포화 상태입니다. 지금 즉시:
1. auto-checkpoint.sh가 .project/checkpoint.md에 현재 상태를 저장 (세션 종료 시 자동 실행됨)
2. 이 세션을 종료하고 새 세션 시작
3. 새 세션 시작 직후 .project/checkpoint.md를 먼저 읽어 맥락 복원
이 상태에서 /compact는 이미 품질 저하된 요약을 만듭니다. 새 세션 시작이 유일한 해결책.
EOF
  fi
elif [ "$PCT" -ge 80 ]; then
  if fire_once 80; then
    # Trigger auto-checkpoint now while context is still coherent enough to summarize
    AUTO_CHECKPOINT="$REPO_ROOT/.claude/hooks/auto-checkpoint.sh"
    if [ -x "$AUTO_CHECKPOINT" ]; then
      echo "$INPUT" | "$AUTO_CHECKPOINT" --forced 2>/dev/null || true
    fi
    cat <<EOF
[CONTEXT 80% — 체크포인트 저장됨]
컨텍스트 ${PCT}% 도달. .project/checkpoint.md를 방금 자동 갱신했습니다.
앞으로 5-10턴 내에 /compact를 실행하거나 세션을 종료하세요.
CEO께 현 상태를 보고하고 세션 전환 여부를 결정하실 수 있도록 안내하세요.
EOF
  fi
elif [ "$PCT" -ge 60 ]; then
  if fire_once 60; then
    cat <<EOF
[CONTEXT 60% — compact 권장]
컨텍스트 ${PCT}% 도달. 다음 자연스러운 작업 경계에서 실행 권장:
/compact Keep: essence, 현재 Phase, 핵심 decisions, 진행중 Issue/PR, 알려진 bug
지금 선제 compact가 95% 포화 후 품질 저하된 요약보다 훨씬 낫습니다.
EOF
  fi
fi

exit 0
