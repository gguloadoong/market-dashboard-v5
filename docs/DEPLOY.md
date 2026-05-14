# 배포 가이드

---

## 배포 방법 (단 하나)

```bash
npm run deploy
```

내부 동작:
1. `scripts/pre-deploy-consensus.sh` — 컨센서스 게이트 6단계 검사
2. 모든 게이트 PASS → GA 트리거로 Vercel 배포
3. GA 실패 또는 토큰 만료 감지 시 → `vercel --prod` 자동 fallback
4. `.last-deployed-commit` 에 커밋 해시 기록 (이중 배포 방지)

게이트 확인만 (배포 없음):
```bash
npm run deploy:check
```

---

## 컨센서스 게이트 (`scripts/pre-deploy-consensus.sh`)

| 단계 | 담당 | 기준 |
|------|------|------|
| 1. 빌드 통과 | 시스템 | `npm run build` 에러 0 |
| 2. P0/P1 이슈 없음 | QA (장성민) | GitHub Issues 오픈 없음 |
| 3. PM 기획 검토 | PM (이준혁) | 작업 의도 ↔ 구현 결과 일치, 서비스 방향 부합 |
| 4. QA 승인 | QA (장성민) | `.project/quality-baseline.md` 기준 충족 |
| 5. 개발팀 승인 | FE(박서연) / BE(김민준) | 알고리즘 파일 무단 변경 없음 |
| 6. CPO 승인 | CPO (이준혁) | fix/feat PR 포함 + 배포 조건 충족 |

모든 게이트 PASS 시에만 배포 진행. 하나라도 BLOCK이면 배포 중단.

---

## 환경변수

Vercel 대시보드 또는 CLI를 통해 등록한다. **interactive 입력만 허용.**

```bash
vercel env add VARIABLE_NAME production
```

절대 금지:
- `printf 'key값' | vercel env add ...` — 히스토리에 키 노출
- 코드에 키값 하드코딩
- `.env` 파일을 git에 커밋

---

## Cloudflare Workers 배포 (`workers/cron`)

시세 수집 cron 및 시그널 사전계산 워커를 별도 배포한다.

```bash
cd workers/cron
npm run deploy          # wrangler deploy
npm run secrets:push    # .secrets.json → CF Secrets 일괄 업로드
```

로컬 개발:
```bash
npm run dev    # wrangler dev
npm run tail   # 실시간 로그
```

---

## 빌드 검증

```bash
npm run build    # 에러 0 확인
npm run lint     # ESLint 통과
npm run test     # vitest 통과
```

---

## 주의사항

- `vercel --prod` 직접 호출 금지 — `npm run deploy` 가 자동으로 fallback 처리
- PR 머지 후 자동 배포 없음 — `vercel.json`의 `ignoreCommand: "exit 0"` 유지 (ADR-013)
- 이중 배포 방지 — `.last-deployed-commit` 커밋 해시 추적
- 로컬 dev 서버(`npm run dev`) 기동 금지 — `npm run build` 로만 검증
- 배포 실행 조건: 대표님 명시 요청 또는 Claude가 필요 판단 후 확인 받고 실행

---

## 배포 URL

- 프로덕션: https://market-dashboard-v5.vercel.app
- Vercel 대시보드: https://vercel.com/dashboard
