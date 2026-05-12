# 마켓레이더 v5 아키텍처

> 마지막 코드 기준 커밋: `d77264b` (2026-05-12)
> 이 문서는 실제 코드에서 직접 추출한 엔트리포인트와 데이터 흐름입니다.

---

## 서비스 개요

국장·미장·코인 실시간 시세 모니터링 웹앱.  
핵심 가치: **급상승 종목 빠른 캐치** + 개미 투자자 입소문 유도.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 19 + Vite 8 |
| 스타일 | TailwindCSS |
| 데이터 | React Query (`@tanstack/react-query`) |
| 차트 | Recharts (스파크라인), lightweight-charts (캔들) |
| 배포 | Vercel (Edge Functions) |
| DB/캐시 | Supabase (적중률/히스토리), Upstash Redis (스냅샷 캐시) |
| 서버 시그널 | Cloudflare Workers (KV) |

---

## 엔트리포인트

```
src/main.jsx              앱 진입점 — React root 마운트
src/App.jsx               최상위 컴포넌트 — 탭 라우팅, 가격 폴링
src/components/home/index.jsx   홈 탭 대시보드 조립
```

---

## 데이터 흐름

### 가격 데이터
```
usePrices() (React Query)
  → /api/kr-stocks, /api/us-stocks, /api/coins, /api/etfs
  → App.jsx에서 krStocks, usStocks, coins, etfs로 분리
  → HomeDashboard props로 하위 전달
```

### 시그널 엔진 (클라이언트)
```
src/engine/signalEngine.js       저장소 + CRUD + 구독자 패턴
src/engine/signalTypes.js        SIGNAL_TYPES 상수, TYPE_META(easyLabel), getTTL

생성 헬퍼:
  createInvestorSignal()   외국인/기관 연속 매수·매도
  createVolumeSignal()     거래량 이상치
  createSmartMoneySignal() 외국인+기관 동시 매매
  createFearGreedSignal()  공포탐욕 구간 전환
  createMomentumSignal()   모멘텀 괴리
  (+ 10여 개 추가 헬퍼)

시그널 스캔 훅 (홈 마운트 시 자동 실행):
  useInvestorSignals()   → 한투 API (15분 폴링)
  useDerivativeSignals() → PCR·펀딩비·VWAP·소셜
  useNewsSignals()       → 뉴스 클러스터 감지
  useServerSignals()     → CF Workers KV (1분 폴링, composite_score·패턴)
```

### 서버 사전 계산 시그널
```
Cloudflare Workers → KV 저장
  → /api/signals (Edge Function)
  → useServerSignals() 폴링
  → signalEngine.loadSignals() 로 엔진에 병합
```

---

## API 엔드포인트 (api/ 폴더, Vercel Edge)

| 파일 | 경로 | 역할 |
|------|------|------|
| `kr-stocks.js` | GET /api/kr-stocks | 국내 주식 시세 (한투 API) |
| `us-stocks.js` | GET /api/us-stocks | 미국 주식 시세 (Yahoo Finance) |
| `coins.js` | GET /api/coins | 코인 시세 (CoinGecko) |
| `etfs.js` | GET /api/etfs | ETF 시세 |
| `kr-fear-greed.js` | GET /api/kr-fear-greed | 국장 공포탐욕 (VKOSPI + 외국인 순매수) |
| `us-fear-greed.js` | GET /api/us-fear-greed | 미장 공포탐욕 |
| `crypto-fear-greed.js` | GET /api/crypto-fear-greed | 코인 공포탐욕 |
| `signal-accuracy.js` | GET/POST /api/signal-accuracy | 시그널 적중률 집계 (Supabase) |
| `signal-history.js` | GET /api/signal-history | 시그널 히스토리 (30일, Supabase) |
| `signals.js` | GET /api/signals | 서버 사전계산 시그널 (CF Workers KV) |
| `hantoo-indices.js` | GET /api/hantoo-indices | KOSPI·KOSDAQ 지수 |

---

## 홈 화면 위젯 구성 (렌더 순서)

```
CommandCenterWidget      시장 온도계 + 공포탐욕 미니 게이지
NotableMoversSection     주목할 종목 (관심종목 + 인기종목)
SignalBoardWidget        시그널 보드 (강세/약세/중립 카운터 + 카드 리스트)
AiDebateSection          AI 종목 토론
ExploreTabsWidget        급등/급락 + 섹터 탐색
SignalLabWidget          과거 시그널 흐름 (#274, 타입별 1h/24h 결과)
NewsFeedWidget           뉴스 피드 (모바일 전용)
```

---

## 알고리즘 파일 (수정 시 `npm run architect` 필수)

```
src/engine/
src/constants/signalThresholds.js
src/utils/marketHours.js
src/utils/newsAlias.js
src/utils/newsTopicMap.js
src/utils/newsSignal.js
src/utils/signalCardRenderer.js
src/data/relatedAssets.js
src/hooks/useSignals.js
src/hooks/useDerivativeSignals.js
src/hooks/useInvestorSignals.js
```

---

## 시그널 객체 스키마

```ts
{
  id: string             // 'sig_{timestamp}_{counter}'
  type: string           // SIGNAL_TYPES 상수값
  symbol: string | null
  name: string | null
  market: 'kr' | 'us' | 'crypto' | null
  direction: 'bullish' | 'bearish' | 'neutral'
  strength: number       // 1~5
  title: string
  meta: Record<string, any>
  source: 'client' | 'server' | 'hybrid'  // #275 추가
  confidence: number | null               // 0~1, #275 추가
  reasons: { label: string, value: string }[]  // #275 추가
  timestamp: number      // ms
  expiresAt: number      // ms
}
```

---

## 배포 규칙 요약

```
npm run deploy           컨센서스 게이트 → GA → 성공 시 완료
npm run deploy:check     게이트만 확인 (배포 없음)
npm run architect        알고리즘 파일 변경 시 설계 리뷰 (Opus)
npm run review:code      PR 전 코드 리뷰 (Opus)
npm run pr "제목"        Gemini gate + PR 생성
```

---

## 주요 ADR (Architecture Decision Records)

| ADR | 결정 |
|-----|------|
| ADR-013 | Vercel Git 통합 자동 배포 비활성화 (`ignoreCommand: "exit 0"`) |
| #116 | 가격 null 시그널 accuracy 기록 보류 → 가격 업그레이드 시 최초 기록 |
| #162 | whale_* 시그널 타입 제거 (레거시 레코드 차단) |
| #213 | 서버 사전계산 시그널 CF Workers KV 경유 (1분 폴링) |
| #275 | 시그널 객체 source/confidence/reasons 확장 |
