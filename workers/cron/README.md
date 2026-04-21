# mdv5-cron (Cloudflare Workers 크론)

## 시크릿 관리 (파일 기반)

1. `.secrets.json.example` 을 `.secrets.json` 으로 복사
2. `.secrets.json` 파일 열어서 실제 값 입력 (JSON 형식)
3. `npm run secrets:push` 실행 → CF Workers 에 일괄 업로드

`.secrets.json` 은 `.gitignore` 에 등록되어 있어 git 에 올라가지 않음.
CLI 에 값 타이핑하거나 대화창에 노출할 필요 없음.

### 필요 시크릿

| 키 | 용도 |
|---|---|
| `DISCORD_WEBHOOK` | #164 Phase C watchdog — 크론 실패 Discord 알림 (없으면 watchdog 조용히 skip) |
| `HANTOO_APP_KEY`, `HANTOO_APP_SECRET` | 한국투자증권 API |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SIGNAL_RPC_SECRET` | Supabase 시그널 적중 검증 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Redis |

## 개발 / 배포

```bash
npm run dev              # 로컬 wrangler dev
npm run deploy           # CF Workers 배포
npm run tail             # 프로덕션 로그 tail
npm run secrets:push     # .secrets.json → CF secrets 일괄 업로드
```

## 크론 스케줄

| 크론 | 담당 |
|---|---|
| `*/5 * * * *` | coins (24/7) |
| `1-56/5 * * * *` | kr (KST 평일 08~20시 active) |
| `2-57/5 * * * *` | us shard 0 (장중 + 프리/애프터) |
| `3-58/5 * * * *` | us shard 1 |
| `4-59/5 * * * *` | us shard 2 |
| `*/30 * * * *` | signal accuracy |
| `50 23 * * *` | morning briefing |
| `*/10 * * * *` | watchdog (Discord 알림) |
