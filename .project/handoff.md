---
세션 핸드오프
업데이트: 2026-06-01
---

# 마켓레이더 v5 — 세션 핸드오프

> **새 세션 시작 시 이 문서를 가장 먼저 읽어 현재 상황을 복원하세요.**
> 그 다음 `MEMORY.md`, `CLAUDE.md`, `.project/backlog.md`, `.project/decisions.md` 순으로 보강.

## 🎯 현재 최우선 (P0)

**데이터 정합성·신뢰 정밀 점검 진행 중.** 디자인 방향 결정은 **보류**.
- 대표 명시: "데이터가 올바르게 나와야 그 다음이 디자인이 맞다"
- 가짜 종목(공포탐욕), 없는 종목, 시그널 신뢰성, 데이터 정합성 등 전수 점검 필요

## ✅ 직전 사이클 완료 (Phase 12 + 후속)

main 머지 + 배포 완료 (2026-05-28~05-30):
- `#333` marketHours 세션 정상화 — 국장 NXT + 미장 데이마켓 라벨
- `#334` 네이버 비공식 프록시 — 미장 프리/애프터 + NXT 참고가
- `#335` 주도주 알고리즘 + 모핑 포커스 UI
- `#339` 우측 실시간 피드 패널 제거 (사용자 피로감)
- `#341` 공포탐욕 가짜 종목 카드 차단 (P0 신뢰)

배포 production: https://market-dashboard-v5.vercel.app (HEAD: 8515985)

## ⚠️ Phase 12 사후평가 — 절대 잊지 말 것

**대표 평가**: "본질 모르겠다, UI/UX 최악"

4직군(Strategy/CPO/Design/FE) + Gemini 외부 비판 합의:
1. **"5섹션화" = 거짓 회계** — production은 사실상 8섹션
2. **"흡수/통합/모핑" 단어 게임 = 함정** — 다음 사이클에서 등장 시 즉시 회의 중단
3. **첫 1뷰포트(375×667)는 100% 커맨드센터 단독 점유** — 본질 0%
4. **6개 카드 동일 클래스** `bg-white rounded-2xl p-5` — 시각 위계 0
5. **"이건 리디자인이 아니다" 문장이 계획서에 등장하면 즉시 함정 신호**

## 🚫 절대 금지 (이번 사이클 가드)

| 금지 항목 | 출처 |
|----------|------|
| 관심종목 중심 시안 (Watchlist-First) | 대표 명시: "AI들이 자꾸 빠지는 함정. 마켓레이더는 시장 발견, 포트폴리오 앱 아님" |
| "흡수/통합/모핑/결합/포함" 단어로 시안 합치기 | Phase 12 함정 재현 — 3명 모두 D+A 결합 추천 기각 |
| 카드 동질화 `bg-white rounded-2xl p-5` 6개 양산 | FE 측정: 위계 무력화의 코드 레벨 원인 |
| 토스·Robinhood·Coinbase·Bloomberg referent 기생 | Gemini: "남의 성공 방정식에 기생" |
| "이건 리디자인이 아니다" 자기최면 문장 | Phase 12 거짓 회계의 정확한 신호 |
| Codex CLI / Codex Gate | 메모리 `feedback_no_codex` |
| `npm run dev` 로컬 dev 서버 | 메모리 `feedback_no_local_dev_server` (데이터 폭발 사고) |
| `git add -A` | 메모리 `feedback_no_git_add_all` (정크 73개 유입 사고) |
| Playwright 브라우저 미종료 | 메모리 `feedback_playwright_cleanup` (89GB/일 사고) |

## 🟡 진행 중 트랙

### 트랙 1 — `#343` P1 시그널 도메인 분리 (근본 fix)
**상태**: 이슈 생성, 미착수
**근거**: `#341`은 증상 차단(MARKET_INDICATOR_TYPES Set으로 7종 필터). 새 시장 지표 시그널 타입 추가 시 누락하면 재발 = 누적 부채.

**단기 (1주, 즉시 착수 가능)**
- `signalTypes.js`에 모든 시그널 타입 `kind: 'stock' | 'market'` 필수화. 미지정 빌드 실패
- 종목 카드 렌더 4곳(MorphingFocus / SignalBoard / SignalSummary / CommandCenter hero)에서 `signal.symbol`이 실제 종목 풀에 존재하는지 lookup, 미존재 시 drop
- `useFearGreed.js:129` `kind: 'market'` 명시
- architect 게이트 필수 (`src/engine/` 변경)
- executor(opus) 1.5~2일

**중기 (2~3주, 별도 사이클)**: 시그널 풀 물리 분리(`stockSignals` vs `marketSignals`), 생성 팩토리 분리 (`createStockSignal` vs `createMarketSignal`)

**장기**: TypeScript or JSDoc typedef + CI 검증

### 트랙 2 — 디자인 방향 (보류)

대표가 시안 A·B·D 셋 다 기각 후 영감 라운드 진행. **현재 4개 영감 카드 결정 보류**. 데이터 정합성 P0 우선.

영감 4개 상세는 `.project/inspirations-discovery-2026-05.md` 참조.

## 🤝 합의된 본질 (보존)

> **"이 앱을 켜면, 시장 이상 신호 + 그게 내게 의미하는 것이 3초 안에 보인다."**

- 4직군(Strategy/CPO/Design/FE) + Gemini 외부 비판 모두 일치
- 단일 정답 X · 시각화된 시장 심박수 O (Gemini가 추가)
- "3시장 통합"이 진짜 무기 — 지금은 병렬 배치, 통합 아님

## 📋 다음 세션 권고 시작 순서

1. 이 핸드오프 정독
2. `MEMORY.md` 인덱스 + 관련 메모리 파일들 (특히 `feedback_watchlist_secondary`, `project_phase12_situational_focus`)
3. `.project/inspirations-discovery-2026-05.md` (영감 4개 보존)
4. `.project/backlog.md`, `.project/decisions.md`
5. 데이터 정합성 점검 결과 이슈 목록(아래) 확인 후 P0 작업 착수
6. 디자인 사이클은 대표가 데이터 신뢰 회복 만족할 때까지 보류

## 🔎 데이터 정합성 점검 (진행 중)

별도 executor가 production + 코드베이스 정적 분석으로 점검 중. 결과는 이슈로 누적되며 main 머지·배포 후 이 핸드오프에 추가 기록.

**알려진 결함 (이미 확인)**
- ✅ `#341` 공포탐욕 가짜 종목 카드 — fix·배포 완료
- 🔴 KIS 투자자 동향 transient 500 burst — 일시 회복, health-check 감시 필요
- 🟡 Parqet 로고 CDN 404 (SPAC 워런트 OCTVV/CORZZ/RVMDW 등) — fallback 동작 중
- 🟡 Upbit WebSocket 429 → REST fallback 동작 중

**점검 중 의심 지점** (조사 위임)
- 모든 시그널 생성 훅에서 가짜 종목 객체 생성 패턴 추가 존재 여부
- 시그널 풀에서 종목 데이터 lookup 실패해도 렌더되는 경로
- `.symbol`에 종목 외 값(시장 키, 섹터명 등) 주입 가능 경로
- 종목 카드 클릭 → ChartSidePanel `차트 데이터 없음` 발생 경로
- 거래대금·시가총액 등 0 또는 누락 값으로 인한 잘못된 랭킹
