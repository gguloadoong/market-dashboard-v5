# Code Review: feature/#32-hantoo-chart-kst
- date: 2026-04-04T02:58:15Z
- commit: 393f53da77e7d93243d238d029ba67a37bb2e342
- diff_lines:       35

**코드 리뷰: `api/hantoo-chart.js` KST 날짜 변환**

---

**변경 요약**
`toISOString()`(UTC 기준) → `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })`(KST 기준)으로 날짜 포맷 통일.

---

**[STYLE]** `seoulStr` 헬퍼가 핸들러 내부에 정의됨
같은 파일에서 재사용 가능성이 있다면 모듈 상단으로 추출하는 게 낫지만, 현재 사용처가 2곳뿐이므로 허용 범위.

**[STYLE]** `now`와 `startDate` 모두 `new Date()`로 생성 후 `startDate`만 변이(mutate)
두 객체가 수 밀리초 차이로 생성되므로 날짜 경계(자정 직전)에서 이론적으로 `now`와 `startDate`의 KST 날짜가 미묘하게 다를 수 있음. 실질적 영향은 없으나 `const now = new Date(); const startDate = new Date(now);`로 동일 기준점을 쓰는 게 더 명확.

---

**검증 항목 (모두 이상 없음)**

| 항목 | 결과 |
|------|------|
| `en-CA` 로케일 → `YYYY-MM-DD` 포맷 | Node.js/V8 표준 동작, Vercel 환경에서 안전 |
| `.replace(/-/g, '')` → `YYYYMMDD` | KIS API 날짜 형식 정확히 일치 |
| `setMonth`/`setFullYear` 변이 후 `seoulStr` 호출 | 순서 정확, 변이된 값 반영됨 |
| 보안/성능 문제 | 없음 (formatter 2회 생성은 무시 가능) |

---

**핵심 버그 수정 확인**
서버(UTC)에서 한국 장 마감(15:30 KST = 06:30 UTC) 이후 요청 시 `toISOString()`이 하루 전 날짜를 반환하던 근본 원인을 올바르게 수정함.

---

VERDICT: PASS
