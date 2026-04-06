# Code Review: feature/#36-kr-fear-greed-fix
- date: 2026-04-04T06:11:02Z
- commit: f6f78cfbe5d214a854ad917dbe28fa585ea5d83d
- diff_lines:      601

## 코드 리뷰

### `api/kr-fear-greed.js`

**[HIGH] Naver 외국인 순매수 fallback 제거 — 무음 성능 저하 가능성**

`fetchForeignNetNaver()` 함수를 완전 삭제하고, KIS 실패 시 `foreignScore = null`로 처리하는 방식으로 변경. 의도는 이해되지만(단위 검증 불가), KIS API가 장기간 실패하면 공포탐욕지수에서 외국인 성분이 계속 빠진다. 모니터링/알림 없이 null 전파되면 점수 품질이 조용히 하락할 수 있음.

- `kr-fear-greed.js:163` — `foreignNet`이 null일 때 로그 한 줄이라도 남기는 것 권장

**[STYLE] `const` 전환 적절**

`foreignNetFinal`, `foreignAvailableFinal`을 `let` → `const`로 변경한 것은 Naver fallback 제거와 일관됨. 좋음.

**VKOSPI `/prices?pageSize=1` 추가 — 안정성 개선**

- `kr-fear-greed.js:49` — 새 URL 추가로 fallback 체인 강화. `Array.isArray` 분기도 올바름.

**날짜 범위 14일 확장**

- `kr-fear-greed.js:83-87` — `new Date(y, m, d - 14)` 로컬 타임존 생성자 사용은 서버 TZ가 KST일 때 정확. Vercel 서버가 UTC라면 날짜가 하루 밀릴 수 있으나, `today` 파라미터 자체가 KST 기준 생성되므로 상대 차이(-14)는 문제없음. 통과.

---

### `scripts/pre-deploy-consensus.sh`

**[HIGH] Gate 3 (PM 검토) — `claude --print` stdin 호출의 비용/시간 불확실성**

- `pre-deploy-consensus.sh:109` — 배포 게이트에서 `claude --print`를 동기 호출. 네트워크 지연이나 Opus 토큰 소모가 배포 파이프라인을 지연시킬 수 있음. 타임아웃이 없어서 무한 대기 가능성.
- 권장: `timeout 120 claude --print < "$PM_TMP"` 등으로 상한 설정

**[HIGH] Gate 5 — `git diff origin/main...HEAD`가 detached HEAD 또는 main 직접 커밋 시 빈 결과**

- `pre-deploy-consensus.sh:175` — `origin/main..HEAD`에 커밋이 없으면(main 직접 커밋 후 push된 상태) ALGO_CHANGED=0으로 무조건 PASS. CLAUDE.md에 "refactor:/docs:/chore:는 main 직접 커밋 허용"이라 의도일 수 있으나, 알고리즘 파일을 main에 직접 커밋하면 Gate 5를 우회함.

**[STYLE] Gate 4 (QA) — quality-baseline.md 존재 여부만 확인하는 소프트 게이트**

- `pre-deploy-consensus.sh:140-146` — 파일 존재만 체크하고 내용 검증 없음. 주석에 "PR 리뷰 단계에서 검증"이라 명시되어 있어 의도적이지만, "QA 승인 PASS"라는 출력은 실제 품질 검증 완료로 오해할 수 있음.

**[PERF] Gate 1 — `npm run build --silent 2>/dev/null`**

- `pre-deploy-consensus.sh:55` — 빌드 에러를 `/dev/null`로 버림. 실패 시 원인 파악 불가. `2>&1 | tail -20` 등으로 마지막 에러 로그를 보여주는 게 나음.

---

### `scripts/review-summary.sh`

**[HIGH] Codex BLOCK 판정 regex가 brittle**

- `review-summary.sh:82-84` — `"overall_correctness"` JSON 키 매칭이 codex 출력 포맷에 강하게 결합됨. codex 버전 업데이트로 키명 변경되면 BLOCK 감지 실패 → false PASS.
- 실용적으로 현재 동작하면 OK이나, codex 출력 포맷 변경 시 즉시 깨질 수 있음을 인지해야 함.

**[STYLE] `_opus_verdict_raw` 빈값 처리**

- `review-summary.sh:54-55` — `grep || true` 후 `cut`으로 추출, 빈값이면 `UNKNOWN` 설정. 방어적이고 올바름.

---

### `CLAUDE.md` / `package.json`

문서 변경은 실제 스크립트 구현과 일치. `npm run deploy:check`와 `npm run review:summary` 매핑 정확.

---

### 요약

| 태그 | 건수 | 핵심 |
|------|------|------|
| [HIGH] | 3 | claude 타임아웃 없음, Gate5 main 직접 커밋 우회, codex regex brittle |
| [PERF] | 1 | 빌드 에러 출력 삼킴 |
| [STYLE] | 2 | QA 게이트 라벨 오해 소지, const 전환 적절 |

위 HIGH 항목은 즉각적인 장애를 유발하진 않으나, 엣지 케이스에서 게이트 우회 또는 파이프라인 hang이 가능. 현 시점 배포 차단 수준은 아님.

**VERDICT: PASS**
