---
소유자: 이준혁 (CPO) + 이지원 (Strategy)
마지막 업데이트: 2026-05-14
출처: backlog.md Phase 1~13 완료 이력 + decisions.md ADR + git log
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
- 미장 6단계 fallback 체인 (Yahoo v8 → v7 → Stooq → Alpaca → Naver → Cache)
- 뉴스 품질 강화 — CoinDesk/Decrypt/한경/매경/연합/이데일리/머니투데이 RSS 추가

### Phase 4~5: 인게이지먼트 (P2)
- 가격·거래량 조건 알림 (PWA Push Alert)
- CDS 번들 블로트 해소 (gzip 100KB 절감)
- Fear & Greed 위젯 (코인/미장/국장)
- 모바일 스크리너 — 등락률/거래량/섹터 조건 필터

### Phase 6: 완성도 & 공개 준비
- 한투 배치 병렬화 — 50종목 Promise.all 10배치 동시처리
- 다크모드 — CSS 토큰 시스템 + 전 컴포넌트 적용
- 뉴스 API 실패율 모니터링 (Vercel Analytics)
- 뉴스 알고리즘 정합성 수정 (newsTopicMap.js)

### Phase 7: 안정성 & 실사용 품질
- Vercel ignoreCommand 정상화 (ADR-013 수동 배포 게이트)
- API 단일 게이트웨이 `/api/d` 난독화
- 한투 토큰 Upstash Redis 캐시 (TTL 기반 자동 갱신)
- Redis 스냅샷 캐시 + Vercel Cron — 첫 로딩 <100ms
- mock.js 완전 제거 → 전종목 라이브 데이터
- 2단계 PR 리뷰 체계 수립 (Claude Opus + Gemini gate)
- HOME_CONTRACT.md + 아키텍처 테스트 (ADR-014)

### Phase 8: 시그널 UX
- SignalBoardWidget — 홈 시그널 보드 위젯
- HeroSignalCard — 최우선 시그널 히어로 카드 + 봇 배지 + 성적표 브리지
- 시그널 인라인 패널 — 1탭 결정 패널 인라인 확장 (P3-4)

### Phase 9: 서버 사전계산 시그널 (CF Workers KV)
- 시그널 서버 사전계산 아키텍처 전환 — CF Workers cron 5분 주기
- compute-signals cron에 KR flow(외인/기관) 데이터 통합
- 데이터 소스 헬스 모니터 cron — 일별 자동 감시 + Issue 생성
- 헬스체크 이슈 쿨다운 (동일 소스 24h 중복 방지)
- 내러티브 시그널 — 시그널/뉴스/섹터 자동 연결 컨텍스트

### Phase 10: 시그널 적중률 (Supabase)
- 5분 결정 사이클 측정 인스트루먼테이션 (Vercel Analytics)
- 적중률 높은 시그널 섹션 — SignalBoardWidget 인라인
- 관심종목 이상 신호 스트립 — WatchlistMini 인라인
- 알고리즘 부채 3건 해소 — batch pair invariant / accuracy 로딩 상태 / flow last-good fallback
- 폴링 과잉 11개 소스 최적화 — CPU 과열 원인 제거

### Phase 11: 시그널 품질 개선 1차
- 시그널 품질 전반 개선 — 뉴스 분류/과도 발화/보드 필터/성적표
- 시그널 신뢰도 임계값 N≥30 통일 — sort comparator antisymmetry 버그 수정
- 투자 시그널 부적절 표현 제거
- CPU 과열 수정 — InvestorSignals 배치화 + transitionChecker 개선

### Phase 12: 시그널 품질 개선 2차 (COMPOSITE_SCORE / DOUBLE_BOTTOM / RECOVERY_DETECTION)
- 시그널 객체 source/confidence/reasons 구조 확장
- 시그널 카드 reasons 태그 + 신뢰도 pill UI
- DataHealthBadge 컴포넌트 — 문제 시에만 노출
- 시그널 히스토리 타임라인 — 적중 이력 시각화
- Gemini gate 도입 (Codex gate 교체)
- Vite 8.0.11 보안 패치 (3 HIGH CVE 해소)

### Phase 13: SignalLab / AI Debate / EUC-KR 방어
- Signal Lab 위젯 — 과거 시그널 정확도 흐름 시각화
- AiDebateSection — AI 종목 토론 섹션
- EUC-KR 오염 방어 강화 — 정적 테이블 우선 + Latin-1 오염 감지 (#290)
- usePrices resolveKrName EUC-KR 오염 감지 — 실시간 폴링 종목명 깨짐 수정 (#291, #292)
- 컨센서스 게이트 6 — fix/feat 스코프 형식(fix(#N):) 매칭 추가

---

## 현재 상태 (2026-05-14 기준)

### 최근 머지된 PR
| PR | 내용 |
|----|------|
| #292 | EUC-KR 오염 방어 — usePrices resolveKrName 실시간 폴링 종목명 깨짐 수정 |
| #290 | EUC-KR 모지바케 방어 강화 — 정적 테이블 우선 + Latin-1 오염 감지 |
| #288 | HeroSignalCard 봇 배지 + 성적표 브리지 |

### 활성 이슈
GitHub Issues 참고 — `gh issue list --label bug,enhancement`

### 알려진 기술 부채
`.project/tech-debt.md` 참고

---

## 백로그 (Phase 14 이후 후보)

`.project/backlog.md` 참고

주요 후보:
- 모닝 브리핑 (Cron + PWA Push)
- 시그널 카드 공유 기능
- 국장 한투 fallback 적중률 모니터링 (KRX/Naver primary 실패율 추적)
- 뉴스 배지 클릭 → 종목 이동 탐색 루프
