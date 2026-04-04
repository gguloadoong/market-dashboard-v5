---
소유자: 이준혁 (CPO) + 이지원 (Strategy)
마지막 업데이트: 2026-04-04
출처: backlog.md Phase 1~7 완료 이력 + decisions.md ADR
---

# 마켓레이더 로드맵

## 완료된 마일스톤

### Phase 1: 데이터 신뢰성 (P0)
- Mock 초기값 0 보장 자동화
- 데이터 신뢰도 레이블 (LIVE / 15분지연 / 마감 배지)
- 뉴스 종목 매칭 재설계 — alias 딕셔너리 + 단어 경계 매칭
- API 에러 상태 UI — 경고 배너 + 재시도 버튼

### Phase 2: UX 재구조화 (P0/P1)
- 홈 구조 개편 — 핵심 시그널 최상단 + 오늘의 핵심 뉴스
- 종목 상세 "왜 지금?" WHY 배지 + 뉴스 1문장
- 선행 신호 섹션 (뉴스 발생 2h 이내 + 주가 변화 < 1.5%)
- 경제 이벤트 캘린더 (FOMC, CPI, 실업률 등)
- 뉴스 탭 재설계 — 속보/국내/미장/코인 + 종목 태그

### Phase 3: 데이터 소스 업그레이드 (P2)
- 국장 실시간 — KIS WebSocket 체결가 + 30초 폴링 병행
- 미장 실시간 — Alpaca Markets 무료 티어 + 6단계 fallback 체인
- 뉴스 품질 강화 — CoinDesk/Decrypt/한경/매경/연합/이데일리/머니투데이 RSS 추가

### Phase 4: 사용자 유지 & 인게이지먼트 (P2)
- 가격·거래량 조건 알림 (PWA Push Alert)
- 매수가 입력 → 평가손익 실시간 트래킹 (localStorage)
- 뉴스 임팩트 스코어 🟢호재/🔴악재/⚪중립 (AI-free 규칙 기반)

### Phase 5: 인게이지먼트 심화 (P2)
- CDS 번들 블로트 해소 361KB → CDS 전체 제거 (gzip 100KB 절감)
- 관심종목 뉴스 알림 (useNewsAlerts.js — React Query 캐시 구독)
- Fear & Greed 위젯 — Alternative.me(코인) + CNN Money(미장) + VKOSPI(국장)
- 모바일 스크리너 — 등락률/거래량/섹터 조건 필터

### Phase 6: 완성도 & 공개 준비 (2026-03-26 스프린트)
- 한투 배치 병렬화 — 50종목 Promise.all 10배치 동시처리
- 다크모드 — CSS 토큰 시스템 + 전컴포넌트 적용 (빨강=상승 한국 컨벤션 유지)
- 뉴스 API 실패율 모니터링 (Vercel Analytics + 소스별 구조화 로깅)
- 국장 뉴스 소스 강화 (네이버 증권 + 이데일리/머니투데이 RSS)
- 뉴스 알고리즘 정합성 수정 — 부동산 차단, 관련뉴스 0건 해소, newsTopicMap.js

### Phase 7: 안정성 & 실사용 품질 (2026-03-28 스프린트)
- Vercel ignoreCommand 정상화 (ADR-013 수동 배포 게이트)
- 미장 6단계 fallback 체인 (Yahoo v8 → Yahoo v7 → Stooq → Alpaca → Naver → Cache)
- API 단일 게이트웨이 `/api/d` 난독화
- 한투 토큰 Upstash Redis 캐시 (TTL 기반 자동 갱신)
- Redis 스냅샷 캐시 + Vercel Cron — 첫 로딩 <100ms
- mock.js 완전 제거 → 전종목 라이브 데이터
- 2단계 PR 리뷰 체계 수립 (Claude Opus + Codex gate)
- 반복 회귀 방지 — HOME_CONTRACT.md + 아키텍처 테스트 (ADR-014)

---

## 현재 상태 (2026-04-04 기준)

### 진행 중 이슈
| PR | 내용 | 상태 |
|----|------|------|
| #37 | 국장 공포탐욕지수 (kr-fear-greed) 항상 null 반환 수정 | PR 오픈, 봇 리뷰 대기 |
| #38 | pre-deploy-consensus.sh 인프라 개선 | GitHub 이슈 등록 |
| #39 | review-summary.sh 인프라 개선 | GitHub 이슈 등록 |

### 알려진 구조 이슈
- 국장 Cron fallback 종목 수: KRX/Naver 실패 시 HANTOO_NAME_MAP 20종목으로 제한 (v2 대비 종목 감소 원인)
- Whale Alert API: CEO 키 발급 대기 상태

---

## 백로그 (Phase 8 이후 후보)

> Phase 8 이후 기획은 `.project/backlog.md`와 `phase-tracker.md` 참고

- 시그널 엔진 코어 + 외국인/기관/거래량 이상치 시그널 UI 연결
- 뉴스 배지 클릭 → 종목 이동 탐색 루프
- 시그널 카드 공유 기능
- 모닝 브리핑 (Cron + PWA Push)
- 국장 Cron fallback 61종목으로 확장 (현재 20종목 제한)
