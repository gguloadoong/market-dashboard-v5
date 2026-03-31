---
평가자: 장성민 (QA Lead)
날짜: 2026-04-01
대상: Phase 12 PR #2 — 계획서 누락 항목 완성
라운드: R1 (Playwright 시각 평가)
방법: Playwright headless + iPhone 14 뷰포트(390x844) + 스크린샷
---

# Phase 12 QA 평가 — R1

## 평가 배경

Phase 12는 Phase 8~11에서 "인프라 회피"로 누락된 계획서 항목을 완성하는 보완 스프린트이다. strategy-plan-v1.md의 27개 전체 작업 항목 대비 구현율을 엄격히 평가한다.

## 변경 파일 분석

| 파일 | 유형 | 역할 |
|------|------|------|
| `api/morning-briefing.js` | NEW | 모닝 브리핑 Edge API (시장 지수 + F&G + BTC 요약) |
| `vercel.json` | MOD | Cron 스케줄 추가 (`/api/morning-briefing` 매일 KST 08:50) |
| `src/components/home/MorningBriefing.jsx` | NEW | 브리핑 카드 위젯 (닫기 + localStorage 일일 해제) |
| `src/utils/signalCardRenderer.js` | NEW | Canvas API로 시그널 카드 이미지 렌더링 |
| `src/components/home/SignalSummaryWidget.jsx` | MOD | 이미지 공유 연동 (renderSignalCard + Web Share API) |
| `src/components/home/index.jsx` | MOD | pull-to-refresh 터치 핸들러 + MorningBriefing 배치 |
| `vite.config.js` | MOD | PWA manifest shortcuts 3개 추가 |

---

## 검증 환경

| 항목 | 값 |
|------|-----|
| 브라우저 | Chromium (Playwright headless) |
| 뷰포트 | 390 x 844 (iPhone 14) |
| 서버 | http://localhost:5176 (Vite dev) |
| 데이터 | 실시간 API (프록시 → Vercel 프로덕션) |
| 빌드 | 통과 (에러 0, 435ms, gzip 272KB) |

---

## Playwright 검증 결과

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| 모닝 브리핑 ("마켓 브리핑") | NOT_FOUND | API 404 — 브랜치 미배포 상태 |
| Pull-to-refresh 요소 | CODE_ONLY | DOM에 overscroll/pull-indicator 없음, onTouchStart 이벤트 바인딩은 코드에 존재 |
| 공유 버튼 (↗ 텍스트) | FOUND (1개) | 시그널 아이템 존재 시 렌더, 빈 상태에서 미노출은 정상 |
| PWA shortcuts (빌드 manifest) | 3개 | 시그널 피드, 고래 알림, 관심종목 — dist/manifest.webmanifest에서 확인 |
| 투자 시그널 위젯 | FOUND | 기존 기능 유지 |
| WHY 배지 | FOUND | 기존 기능 유지 |
| HOT 섹터 | FOUND | 기존 기능 유지 |
| 시그널 피드 | FOUND | 기존 기능 유지 |
| 타임라인 | FOUND | 기존 기능 유지 |
| 강도 바 | 10개 | 시그널 데이터 존재 확인 |
| 공포탐욕 지수 | FOUND | 기존 기능 유지 |
| 관심종목 | FOUND | 기존 기능 유지 |
| 뉴스 섹션 | FOUND | 기존 기능 유지 |
| 브리핑 API (프로덕션) | 404 | 미배포 — 코드만 존재 |
| 브리핑 API (코드 검증) | PASS | morning-briefing.js 로직 완결: 5개 데이터 소스 병렬, 에러 핸들링, 캐시 헤더 |

---

## 스크린샷 소견 (eval-p12-home.png)

1. **Market Pulse** — 최상단. 마켓레이더 헤더 + 주요 지수(코스피 2,548 +0.61%, 나스닥 17,322 -2.70%) 정상 표시. 환율 1,470원.
2. **주목할 종목** — Micron(-10.05%), Ondo Finance(-8.33%) 등 변동폭 큰 종목 히어로 카드. 마켓 배지 + WHY 뉴스 매칭 정상.
3. **모닝 브리핑 미노출** — API 404로 인해 컴포넌트가 null 반환. dismissed가 아닌 data null 상태. 코드 자체는 정상이나 프로덕션 배포 전이라 실동작 불가.
4. **투자 시그널 위젯** — "시장 데이터를 분석 중" 대체 콘텐츠 + 감지 항목 태그(외국인 동향/거래량/고래) 표시.
5. **시그널 피드** — 3시장 통합, 국내/코인 배지 + 시간순 이벤트 정상.
6. **공포탐욕 지수 + 경제 이벤트 티커** — 정상 렌더.
7. **관심종목 + 섹터 자금 흐름** — HOT/COLD 칩 정상. drill-down 클릭 가능.
8. **급등/급락 6박스** — 3시장 x 2분류 그리드 정상.
9. **뉴스 섹션** — 종목 연결 배지, 임팩트 스코어 정상.
10. **Pull-to-refresh** — 시각적으로 미확인 (터치 이벤트는 Playwright headless 한계). 코드 레벨에서 onTouchStart/Move/End + pullDistance 상태관리 + 60px 임계치 확인.

---

## 계획서 27개 항목 대비 구현율 (핵심 평가)

### strategy-plan-v1.md 전체 로드맵 추적

| # | 작업 | 영역 | 구현 Phase | 상태 | 검증 |
|---|------|------|-----------|------|------|
| 1 | 시그널 엔진 코어 + 스키마 | S1 | Phase 8 | 완료 | signalEngine.js + useSignals 훅 |
| 2 | 뉴스 감성 5단계 확장 | N1 | Phase 8 | 완료 | newsSignal.js 5단계 점수 체계 |
| 3 | 외국인/기관 연속 매수매도 시그널 | S1 | Phase 8 R2 | 완료 | useInvestorSignals 훅 |
| 4 | 거래량 이상치 감지 시그널 | S1 | Phase 8 R2 | 완료 | VOL 배지 확인 |
| 5 | 고래 시그널 강도 시각화 | W2 | Phase 8 | 완료 | WhalePanel 금액 기반 3단계 |
| 6 | 스테이블코인 특수 로직 | W3 | Phase 8 | 완료 | USDT/USDC 특수 해석 |
| 7 | WHY 카드 이유 추론 확장 | V2 | Phase 8 | 완료 | NotableMoversSection 5단계 추론 |
| 8 | 뉴스 배지 클릭 → 종목 이동 | D2 | Phase 9 | 완료 | cursor-pointer 112개 확인 (P10) |
| 9 | 고래 알림 → 종목 연결 | D3 | Phase 9 | 완료 | WhalePanel onClick 핸들러 |
| 10 | 뉴스 클러스터링 | N2 | Phase 9 | 완료 | newsCluster.js Jaccard 유사도 |
| 11 | 속보 중복 제거 + 시간 감쇠 | N4 | Phase 9 | 완료 | 속보 → 주요뉴스 자동 강등 |
| 12 | 관련 종목 연결 이유 태그 | D1 | Phase 10 | 완료 | "같은 섹터" / "그룹주" 태그 확인 |
| 13 | 고래 일간 통계 요약 | W4 | Phase 10 | 완료 | 고래 일간 요약 FOUND (P10 R2) |
| 14 | F&G 전환 시점 알림 | S1 | Phase 9 | 완료 | fear_greed_shift 시그널 타입 |
| 15 | 시그널 대시보드 위젯 | S2 | Phase 10 | 완료 | SignalSummaryWidget FOUND |
| 16 | 종목별 시그널 통합 뷰 | S3 | Phase 10 | 완료 | ChartSidePanel 시그널 카드 스택 |
| 17 | 시그널 카드 공유 기능 | V4 | **Phase 12** | 완료 | signalCardRenderer.js + Web Share API |
| 18 | 고래 연속 패턴 감지 | W1 | Phase 10 | 완료 | whalePattern.js 이벤트 버퍼링 |
| 19 | 섹터 drill-down | D4 | Phase 10 | 완료 | SectorMiniWidget 인라인 펼침 |
| 20 | 종목별 감성 누적 트렌드 | N6 | Phase 10 | 완료 | 감성 바 확인 (P11 R2) |
| 21 | 3시장 통합 시그널 피드 | V1 | Phase 11 | 완료 | SignalFeed.jsx FOUND |
| 22 | 모닝 브리핑 (Cron + PWA Push) | V3 | **Phase 12** | 부분 완료 | API + 위젯 코드 완성, Cron 설정 완료. PWA Push 미구현 (카드 표시만). 미배포 상태에서 실동작 불가 |
| 23 | 시장 타임라인 위젯 | D5 | Phase 11 | 완료 | MarketTimeline.jsx FOUND |
| 24 | PWA 경험 강화 | V5 | **Phase 12** | 부분 완료 | shortcuts 3개 + pull-to-refresh 구현. 스와이프 제스처/홈 추가 유도 배너/오프라인 fallback/share_target 미구현 |
| 25 | 뉴스 매칭 신뢰도 등급 + 토픽맵 확장 | N5 | Phase 9 | 완료 | DIRECT/SECTOR/WEAK 등급 |
| 26 | 기관 지갑 라벨링 | W5 | — | **미구현** | CEO 키 발급 대기 (Whale Alert API) |
| 27 | 섹터 로테이션 감지 시그널 | S1 | Phase 11 | 완료 | sector_rotation 시그널 타입 |

### 구현율 산출

- **완전 완료**: 24/27 (88.9%)
- **부분 완료**: 2/27 (#22 모닝 브리핑, #24 PWA 강화)
- **미구현**: 1/27 (#26 기관 지갑 라벨링 — 외부 블로커)
- **가중 구현율**: (24 + 2*0.5 + 0) / 27 = 25/27 = **92.6%**

---

## P0 체크리스트 검증

| P0 항목 | 상태 | 근거 |
|---------|------|------|
| 가격 데이터 정확성 | PASS | 코스피 2,548(+0.61%), 나스닥 17,322(-2.70%), BTC 실시간 가격 정상 |
| 데이터 freshness 표시 | PASS | WHY 뉴스 타임스탬프, 시그널 피드 시간 표시 |
| 빠른 탭 전환 레이스 컨디션 | N/A | 홈 탭 단일 평가 |
| 모바일 터치 타겟 44px | PASS | 카드 클릭 영역, 버튼 크기 충분 |
| WebSocket 재연결 | N/A | headless 환경에서 WS 테스트 한계 |

---

## 5개 항목 정량 채점

### 1. 기획 의도 부합 (가중치 x3)

**점수: 15/20**

Phase 12의 역할은 "계획서 누락 항목 완성"이다. 27개 중 Phase 12에서 신규 구현한 것은 3개(#17 시그널 카드 공유, #22 모닝 브리핑, #24 PWA 강화)이다.

- (+) 시그널 카드 공유 기능(V4)은 계획서의 핵심 입소문 메커니즘이다. Canvas 렌더러 + Web Share API + 클립보드 폴백까지 완성도 높다.
- (+) 모닝 브리핑(V3)은 계획서의 DAU 견인 핵심 기능이다. API 설계가 깔끔하다 (5개 소스 병렬, Promise.allSettled, 에러 격리).
- (+) PWA shortcuts 3개 추가로 홈 화면 바로가기 경험 강화.
- (-) 모닝 브리핑의 PWA Push 알림 미구현. 계획서는 "매일 아침 8:50 푸시 알림"을 명시했으나, 실제로는 카드 위젯만 구현. Service Worker 푸시 구독 + Cron 트리거 알림 로직이 없다. 카드 표시와 푸시 알림은 전혀 다른 기능이다.
- (-) Pull-to-refresh가 `window.location.reload()`로 구현됨. 전체 페이지 리로드는 React 앱에서 SPA 상태를 초기화하므로, React Query invalidateQueries나 refetch가 적절하다. 네이티브 앱 느낌과 거리가 있다.
- (-) PWA 경험 강화 항목에서 스와이프 제스처, 홈 추가 유도 배너, 오프라인 fallback, share_target 모두 미구현. shortcuts만 추가된 것은 계획서 대비 부분 이행이다.
- (-) 기관 지갑 라벨링(#26)은 외부 블로커로 미구현이나, Phase 12가 "누락 항목 완성" 스프린트인 만큼 가능한 범위의 정적 매핑(Grayscale, MicroStrategy 등 공개 주소)은 구현할 수 있었다.

### 2. 투자 인사이트 제공 (가중치 x2)

**점수: 14/20**

- (+) 모닝 브리핑 API의 데이터 구성이 투자 판단에 유용하다: 코스피/나스닥/BTC 변동률 + F&G US/Crypto. "출근길 5분 브리핑" 컨셉에 부합.
- (+) 시그널 카드 공유로 인사이트 전파 가능 — 외국인 연속 매수, 고래 이동 등을 이미지로 공유.
- (-) 모닝 브리핑이 실동작하지 않는다. API가 미배포 상태이므로 사용자가 이 기능을 경험할 수 없다. 코드만 존재하고 데이터가 없다.
- (-) 계획서의 모닝 브리핑은 "주목 종목: 전일 시그널 상위 3건"을 포함하는데, 구현된 API는 지수 + F&G만 반환하고 시그널 엔진 연동이 없다. 가장 가치 있는 정보("어떤 종목을 봐야 하는지")가 빠져있다.
- (-) 기관 지갑 라벨링 미구현으로 고래 알림의 인사이트 심도가 계획서 수준에 미달.

### 3. 차별화 시그널 경험 (가중치 x2)

**점수: 15/20**

- (+) Canvas 기반 시그널 카드 렌더러의 완성도가 높다. 방향 색상, 강도 바, 타입 배지, 워터마크, 날짜까지 포함. roundRect 미지원 브라우저 폴백도 처리.
- (+) 공유 플로우가 3단계 폴백으로 설계됨: 이미지 공유(canShare) → 텍스트 공유(navigator.share) → 클립보드 복사. 실패 없는 공유 경험.
- (+) 기존 시그널 위젯/피드/타임라인 모두 정상 유지 (regression 없음).
- (-) 모닝 브리핑의 차별화 요소(3시장 통합 아침 요약)가 미작동 상태에서 사용자 체감이 없다.
- (-) Pull-to-refresh의 시각적 피드백이 단순 ↻ 문자 + animate-spin이다. 네이티브 앱 수준의 스프링 애니메이션이나 진행 상태 표시와 비교하면 미흡하다.

### 4. 디자인/UX 직관성 (가중치 x2)

**점수: 16/20**

- (+) MorningBriefing.jsx의 디자인이 우수하다. warm gradient 배경(#FFF9E6 → #FFFDF5), 구조화된 레이아웃(헤더 → 지수 → 구분선 → 요약 → F&G), 닫기 버튼 + localStorage 일일 리셋.
- (+) signalCardRenderer의 카드 디자인이 공유 가능한 수준이다. 600x320 비율, 방향별 색상 배경, 워터마크 배치.
- (+) 기존 홈 레이아웃(스크린샷 확인): Market Pulse → 주목할 종목 → 시그널 → 피드 → 공포탐욕 → 관심종목 + 섹터 → 급등급락 → 뉴스 → 타임라인. 정보 밀도가 높으면서 과부하가 아닌 균형.
- (-) 모닝 브리핑이 미노출 상태에서 홈 최상단이 Market Pulse로 시작. 브리핑이 표시될 때와 안 될 때의 레이아웃 일관성 미검증.
- (-) Pull-to-refresh 인디케이터의 transition이 height 기반이라 smooth하지 않을 수 있다 (pullDistance 직접 바인딩).

### 5. 정확도/커버리지 (가중치 x3)

**점수: 14/20**

- (+) 빌드 에러 0. ESLint 클린. 번들 사이즈 정상 범위(gzip 272KB, 기준선 750KB 이하).
- (+) 기존 기능 13개 항목 모두 FOUND — regression 없음.
- (+) 27개 항목 중 가중 구현율 92.6% (24 완전 + 2 부분 + 1 미구현).
- (-) **모닝 브리핑 API가 실동작하지 않는다.** 로컬에서도 프로덕션에서도 404. 코드만 존재하고 검증 불가능한 기능은 "구현 완료"로 인정하기 어렵다. Phase 12의 핵심 신규 기능 3개 중 1개가 비동작.
- (-) 모닝 브리핑 API에서 시그널 엔진 연동이 누락. summary가 "코스피 +X%, 나스닥 +Y%, BTC +Z%"로만 구성되어 계획서의 "주목: 삼성전자(외국인 매수), 반도체(섹터 상승)" 수준에 미달.
- (-) Vercel Cron 스케줄이 `"50 23 * * *"` (UTC)로 설정되어 있어 KST 08:50에 맞지만, 실제 Cron 동작 검증 불가.
- (-) PWA Push 알림 파이프라인 전체 미구현. Service Worker 푸시 구독, 서버 사이드 푸시 발송, 사용자 시각 설정 모두 없다.

---

## 점수 산출

| # | 항목 | 점수 | 가중치 | 소계 |
|---|------|------|--------|------|
| 1 | 기획 의도 부합 | 15 | x3 | 45 |
| 2 | 투자 인사이트 제공 | 14 | x2 | 28 |
| 3 | 차별화 시그널 경험 | 15 | x2 | 30 |
| 4 | 디자인/UX 직관성 | 16 | x2 | 32 |
| 5 | 정확도/커버리지 | 14 | x3 | 42 |
| | **합계** | | | **177/240** |

**달성률: 73.8% — FAIL (기준 90% / 216점)**

---

## 핵심 감점 요인 (R2 수정 대상)

### P0: 모닝 브리핑 실동작 불가 (-18점 영향)

1. **API 미배포**: morning-briefing.js가 현재 브랜치에만 존재하고 프로덕션에 배포되지 않았다. 로컬 dev 서버에서도 Vercel 프록시가 프로덕션 API를 호출하므로 404. 최소한 로컬에서 검증 가능한 상태여야 한다.

2. **시그널 엔진 미연동**: 계획서는 "주목: 삼성전자(외국인 매수), 반도체(섹터 상승), BTC(고래 출금 증가)" 수준의 시그널 요약을 명시했다. 현재 API는 지수 + F&G만 반환하고 시그널 상위 종목이 없다. 이 정보가 빠지면 브리핑의 핵심 가치("어떤 종목을 봐야 하는지")가 사라진다.

3. **PWA Push 미구현**: 계획서는 "매일 아침 8:50 푸시 알림"을 명시했다. 카드 위젯(앱을 열어야 보이는 것)과 푸시 알림(앱을 안 열어도 오는 것)은 근본적으로 다른 기능이다. DAU 견인 효과는 푸시에서 나온다.

### P1: Pull-to-refresh 구현 품질 (-6점 영향)

4. **window.location.reload()**: React SPA에서 전체 페이지 리로드는 모든 상태(WebSocket 연결, 시그널 엔진 메모리, React Query 캐시)를 초기화한다. React Query의 `queryClient.invalidateQueries()` 또는 개별 refetch가 적절하다.

5. **시각적 피드백 미흡**: ↻ 문자 하나 + 60px 임계치 구분. 네이티브 앱 수준의 탄성 애니메이션, 당김 비율 피드백, 새로고침 완료 상태 표시가 없다.

### P2: PWA 경험 강화 미완성 (-8점 영향)

6. **shortcuts만 추가**: 계획서 V5는 5가지 항목(스와이프 제스처, pull-to-refresh, 홈 추가 유도 배너, 오프라인 fallback, 하단 네비게이션 고정)을 명시했다. Pull-to-refresh 외에 shortcuts만 추가. 스와이프 제스처, 홈 추가 유도 배너, 오프라인 fallback, share_target 모두 미구현.

### P2: 기관 지갑 라벨링 미착수 (-5점 영향)

7. **외부 블로커 핑계**: Whale Alert API 키가 없어도 공개 주소 기반 정적 매핑(Grayscale GBTC 주소, MicroStrategy cold wallet 등)은 구현 가능하다. "키 대기"를 이유로 전체 항목을 스킵한 것은 Phase 12의 "누락 항목 완성" 취지에 맞지 않는다.

---

## 결론

Phase 12는 계획서 27개 항목 중 Phase 8~11에서 미완성된 3개 항목(#17, #22, #24)을 보완하는 스프린트였다. 코드 수준에서는 morning-briefing.js, signalCardRenderer.js, pull-to-refresh, PWA shortcuts가 추가되었으나, **핵심 신규 기능인 모닝 브리핑이 실동작하지 않는 상태**에서 "구현 완료"로 인정할 수 없다.

시그널 카드 공유(V4)는 Canvas 렌더러 + Web Share API + 폴백 체인까지 완성도가 높아 유일하게 완전 동작하는 Phase 12 신규 기능이다.

**FAIL 판정 (73.8%). R2에서 모닝 브리핑 실동작 + 시그널 연동 + pull-to-refresh 개선이 필수.**
