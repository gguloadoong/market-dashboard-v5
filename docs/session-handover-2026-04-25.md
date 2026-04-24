# 세션 핸드오버 — 2026-04-25

## 완료된 작업

### 오늘 배포됨 (https://market-dashboard-v5.vercel.app)
- **AI 토론 종목 22개 동기화** (DEFAULT_SYMBOLS 4→22, 크론 TOP_SYMBOLS 일치)
- **tsb 시그널 성적표 혼재 근본 해결** (signal_history tsb 레코드 삭제 + 뷰 필터)
- **PR #201 시그널 엔진 27종 복원** (머지 완료, 배포됨)
  - signalThresholds.js 임계값 16개 완화
  - fear_greed_shift 극단값 발화 + localStorage 영속
  - capitulation F&G 직접 판단 (연쇄 의존 해소)
  - useFearGreed 단일 인스턴스화 (App.jsx)
  - composite_score TTL 15분, 임계값 40
  - NEWS_CLUSTER 중앙화 (THRESHOLDS.NEWS_CLUSTER)
  - compositeScorer NEUTRAL_LOW 단일 소스화
  - 성적표 30종 사용자 친화 명칭

### 배포 스크립트 버그 수정 (main 커밋됨)
- `git log | head -20` → `--max-count=20` SIGPIPE 수정
- `trap '' SIGPIPE` deploy.sh + pre-deploy-consensus.sh 추가
- `|| true` 파이프 보호

## 미완료 / 다음 세션
- `workers/cron/.gitignore` 미커밋 상태 → commit 또는 삭제 필요
- 시그널 발화량 모니터링 (임계값 13개 완화, 7일 추적)
- `smart_money_flow`/`momentum_divergence`/`volume_price_divergence` BOT_CATEGORIES 누락 확인됨 (SignalScorecardTab에 추가 완료)

## 현재 브랜치 상태
- main: 최신 (배포 완료 커밋 포함)
- feature/#202-deploy-cooldown: SIGPIPE 수정 커밋 잔류 (cherry-pick으로 main에 반영됨)
- feature/#200-signal-engine-restoration: PR #201 머지됨

## 배포 상태
- Last deployed: f2a9369 (2026-04-25 오전 1시경)
- Smoke Test: kr:4256 us:2700 coins:250 ✅
