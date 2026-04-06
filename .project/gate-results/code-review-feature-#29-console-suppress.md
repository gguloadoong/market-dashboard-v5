# Code Review: feature/#29-console-suppress
- date: 2026-04-04T01:55:16Z
- commit: 68af9003c1bc7a6db0c737d3edb4472e444a9b49
- diff_lines:       31

**변경 요약**: `vite.config.js`를 함수형 설정으로 전환하고, 프로덕션 빌드 시 `console.log/warn/info/debug`를 esbuild `pure` 어노테이션으로 번들에서 제거.

---

**[STYLE]** `mode === 'production'` 조건은 `--mode staging` 같은 커스텀 모드 빌드에서 콘솔이 남는다. 의도적이라면 OK지만, staging 환경도 콘솔 제거 대상이라면 `mode !== 'development'`로 반전하는 게 더 포괄적.

**[STYLE]** `esbuild.pure`는 "반환값이 사용되지 않으면 호출 자체를 제거" 방식이라 console 제거에 맞다. 다만 `console.*`를 통째로 없애려면 `drop: ['console']` + `drop_labels`도 있는데, `error`를 보존하려는 현재 의도에는 `pure` 방식이 더 정밀하므로 올바른 선택.

**[STYLE]** 화살표 함수 반환 객체 `({ mode }) => ({})` 괄호 래핑은 문법상 필수이며 정상.

---

특이사항 없음. 로직 오류, 보안 문제, 성능 퇴행 없음. Vitest 설정(`test:`)은 esbuild 옵션과 독립적으로 동작하므로 테스트에 영향 없음.

**VERDICT: PASS**
