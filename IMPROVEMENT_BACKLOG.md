# 마켓레이더 개선 백로그

> 에이전트 회의: PM + FE + Design + BE/Data + QA
> 날짜: 2026-03-17

---

## 현재 상태 평가

| 에이전트 | 점수 | 근거 |
|---------|------|------|
| **PM** | 7/10 | 핵심 CTA(급등→차트) 동선은 작동. 홈에서 "오늘 뭐 봐야 하나" 5초 파악 가능. 단, 인사이트 카드가 뉴스-무버 매칭 실패 시 조용히 사라지고 mock 대체 없음. 모바일에서 BreakingNewsPanel 미노출이 치명적 정보 손실. |
| **FE** | 7/10 | useMemo/memo/useCallback 적극 활용. setInterval cleanup 전부 존재. 그러나 HomeDashboard 내 MoverRow에서 `useMemo` 안에 `findRelatedItems` 호출이 dataMap 전체 reference 변경 시 매 렌더마다 재계산. useCallback deps가 포괄적으로 설정되어 있어 실질적 memoization 효과 제한적. |
| **Design** | 8/10 | 토스증권 레퍼런스 충실히 반영. 카드 여백·색상·타이포 일관성 높음. 그러나 375px 모바일에서 HomeDashboard 급등/급락 2열 그리드가 1열로 폴백 안 되면 텍스트 overflow 발생 가능. |
| **BE/Data** | 6/10 | CoinGecko(무료) + Upbit WS + Naver Finance + Yahoo Finance + Stooq 다중 소스 fallback 구조 탄탄함. 국장 실제 API(한투 OpenAPI) 미연동 — mock 시뮬레이션으로 대체 중. 뉴스 RSS가 Vercel Edge Function 프록시 의존: 로컬 개발 환경에서 `/api/rss` 호출 실패 → corsproxy.io fallback이 CORS 문제로 실패 가능. |
| **QA** | 7/10 | null/undefined 방어 코드(pubDate 처리, logoIdx fallback 등) 전반적으로 존재. 빌드 에러 없음. 단, InsightCard 조건(`insights.length > 0`)으로 카드 전체가 숨겨질 때 UX 공백 발생 — 로딩 스켈레톤은 있으나 "데이터 없음" fallback UI 미존재. |

---

## P0 (즉시 수정)

### P0-1: 인사이트 카드 — 데이터 없을 때 mock 표시 미구현
- **현상**: `insights.length === 0` && `newsLoading === false` 이면 인사이트 섹션 전체 숨김
- **영향**: 홈 화면 최상단 콘텐츠 공백 → "지금 핫한 것"이 지수바와 급등/급락만으로 구성됨
- **수정 방향**: `!newsLoading && insights.length === 0` 일 때 하드코딩 mock 인사이트 3개 표시 (BTC 급등, 삼성전자 실적, NVDA AI 모멘텀 등 관심도 높은 종목 예시)
- **파일**: `src/components/HomeDashboard.jsx`

### P0-2: 모바일(375px)에서 뉴스 패널 완전 미노출
- **현상**: BreakingNewsPanel이 `hidden lg:block`으로 모바일에서 숨겨짐. 모바일 사용자는 뉴스/고래 시그널 접근 불가
- **영향**: 모바일 UX에서 핵심 인사이트 0%, 서비스 차별점 소실
- **수정 방향**: 홈탭 하단에 뉴스 미리보기 섹션 4~5건 노출, 또는 하단 네비게이션에 "뉴스" 탭 추가
- **파일**: `src/App.jsx`, `src/components/HomeDashboard.jsx`

### P0-3: 로컬 개발 환경 뉴스 로드 실패
- **현상**: `/api/rss` → Vercel Edge Function은 `vercel dev` 없이는 404. corsproxy.io는 CORS 정책으로 브라우저에서 차단되는 경우 있음
- **영향**: `npm run dev` 환경에서 뉴스 데이터 없음 → 인사이트 카드 비어있음 → 개발/디버깅 불가
- **수정 방향**: `api/` 디렉토리에 Vercel Edge Function `/api/rss.js` 존재 여부 확인 및 생성. 로컬 개발 시 CryptoCompare(코인 뉴스, CORS-free)를 fallback으로 자동 사용

---

## P1 (이번 이터레이션)

### P1-1: 국장 실제 데이터 연동 — 한투 OpenAPI
- **현상**: `VITE_KIS_APP_KEY`, `VITE_KIS_APP_SECRET` 환경변수 미설정 시 장 중에도 Naver Finance fallback 사용, 장 외에는 15초마다 `simulateKorean()` 랜덤 변동
- **수정 방향**: `.env` 키 설정 후 한투 WebSocket(실시간 체결) 또는 REST(30초 폴링) 연동. 키 미설정 시 "시뮬레이션 모드" 배지 표시
- **파일**: `src/api/stocks.js`, `src/App.jsx`

### P1-2: 모바일 375px 레이아웃 검증 및 수정
- **현상**: HomeDashboard의 `grid-cols-1 sm:grid-cols-2` 인사이트 카드/급등락 섹션은 모바일 1열로 정상 처리. 그러나 WatchlistTable의 CDS Table 컴포넌트(`@coinbase/cds-web/tables`)가 375px에서 가로 스크롤 또는 overflow 발생 가능
- **수정 방향**: 모바일에서 테이블 대신 카드 리스트 뷰 전환 또는 `overflow-x-auto` 처리
- **파일**: `src/components/WatchlistTable.jsx`

### P1-3: SurgeBanner — 비어있을 때 레이아웃 점프
- **현상**: `stocks` + `coins` 등락률 +3% 이상 없을 때 배너 숨김 처리되나, sticky top-0 z-30 영역이 0px → 헤더 위치 점프
- **수정 방향**: 배너 숨김 시 min-height 0px 유지, height transition으로 부드럽게 처리
- **파일**: `src/components/SurgeBanner.jsx`

### P1-4: 인사이트 카드 — 고래 시그널 미반영
- **현상**: 인사이트 카드가 뉴스-무버 매칭만 사용. WhalePanel의 고래 이벤트(`whaleBus`)가 인사이트에 미반영
- **수정 방향**: `whaleBus`에서 최신 고래 이벤트 구독, 인사이트 카드에 고래 시그널 카드 추가 (최대 1~2개)
- **파일**: `src/components/HomeDashboard.jsx`, `src/state/whaleBus.js`

### P1-5: 차트 사이드 패널 — ChartErrorBoundary 클래스 컴포넌트
- **현상**: `ChartSidePanel.jsx`에 클래스 기반 ErrorBoundary 존재. React 18 이후 함수형 error boundary 라이브러리(`react-error-boundary`) 도입 권장
- **수정 방향**: `react-error-boundary` 패키지 설치 또는 유지 (현재 동작은 정상)

### P1-6: Vercel Edge Function `/api/rss` 파일 확인 및 생성
- **현상**: `src/api/news.js`에서 `/api/rss?url=` 호출하지만 `api/` 디렉토리 존재 여부 불확실
- **수정 방향**: 루트 `api/rss.js` Edge Function 생성 및 `vercel.json` 설정 확인
- **파일**: `/api/rss.js`, `vercel.json`

---

## P2 (다음 이터레이션)

### P2-1: 관심종목 로컬스토리지 저장 (PRD v4 항목 조기 도입)
- 홈 탭에서 자주 보는 종목을 북마크, 로컬스토리지 persist
- `src/hooks/useWatchlist.js` 이미 존재 → UI 연결만 필요

### P2-2: 다크모드
- TailwindCSS `dark:` 클래스 + `prefers-color-scheme` 감지
- 현재 모든 색상이 하드코딩 헥스값으로 되어 있어 CSS 변수 리팩토링 선행 필요

### P2-3: 등락률 임계값 브라우저 알림
- Web Notifications API, +5% 이상 종목 감지 시 OS 알림
- 권한 요청 타이밍 UX 설계 필요

### P2-4: 국장 탭 ETF 분리
- 현재 ETF 탭이 별도 존재하나 KR ETF(KODEX 등)와 해외 ETF(SPY 등)가 함께 표시
- 탭 내 서브필터 또는 섹션 구분 추가

### P2-5: 뉴스 키워드 검색
- BreakingNewsPanel 상단에 검색 입력창 추가
- 종목명 입력 시 관련 뉴스만 필터링

### P2-6: PWA 적용
- `vite-plugin-pwa` 설치, 서비스워커로 오프라인 캐시
- 모바일 홈화면 추가 지원

---

## 기술 부채

### TD-1: `HomeDashboard.jsx` 비대화
- 현재 566줄 단일 파일: `InsightCard`, `MoverRow`, `RelatedChips`, `IndexMiniChip`, `SkeletonRow`, `SkeletonInsightCard`, `HomeDashboard` 모두 동일 파일
- 각 컴포넌트를 별도 파일로 분리 권장 (`src/components/home/` 서브디렉토리)

### TD-2: `WatchlistTable.jsx` 내 CDS 라이브러리 의존
- `@coinbase/cds-web/tables` (Coinbase Design System) 사용
- 외부 프로덕트 전용 디자인 시스템 의존은 장기적으로 커스터마이징 제약
- 자체 테이블 컴포넌트로 교체 검토

### TD-3: `simulateKorean()` 프로덕션 코드 잔존
- `src/App.jsx`의 장 외 시간 국장 시뮬레이션은 개발 편의 코드
- 한투 OpenAPI 연동 완료 후 제거 필요

### TD-4: `allorigins.win` 단일 의존
- `src/api/stocks.js` 전반에 `api.allorigins.win` 사용
- 서비스 중단 시 미장 데이터 전체 차단 — Stooq를 1순위로 높이고 allorigins는 fallback으로 유지

### TD-5: 인라인 스타일 vs Tailwind 혼용
- 상당수 컴포넌트에서 `style={{ background: '#FFFAFA', color: '#F04452' }}` 하드코딩
- Tailwind config에 커스텀 색상 추가 후 클래스 통일 권장

---

## 데이터 갭

| 데이터 | 현재 상태 | 필요한 것 |
|--------|---------|---------|
| **국장 실시간** | Naver Finance fallback (지연 있음) | `VITE_KIS_APP_KEY` + `VITE_KIS_APP_SECRET` 한투 OpenAPI 키 발급 |
| **뉴스 NewsAPI** | RSS + CryptoCompare로 대체 중 | `VITE_NEWS_API_KEY` (100req/day 무료 → 더 많은 소스 커버) |
| **고래 알림 REST** | Whale Alert REST 폴링 | Vercel 프록시 `/api/whale-alert` + Whale Alert API 키 필요 |
| **KOSDAQ 실시간** | Yahoo Finance 경유 (~10분 지연) | Stooq `^kosdaq` 검증 후 직접 사용, 또는 한투 API |
| **미장 환율** | Yahoo Finance `KRW=X` via allorigins | 안정적이나 allorigins 의존성 리스크 있음 |

---

## PM 판단: 우선순위 TOP 3

1. **P0-1 (인사이트 mock fallback)** — 홈 화면 핵심 블록이 빈 화면이 되는 즉각적 UX 손상
2. **P0-2 (모바일 뉴스 노출)** — 모바일 사용자의 핵심 가치 접근 차단
3. **P1-6 (Edge Function 확인)** — 뉴스 전체가 Vercel 배포에서만 작동하는 구조적 리스크
