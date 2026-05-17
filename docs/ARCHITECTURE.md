# Market Radar v5 — 아키텍처 문서

> 마지막 업데이트: 2026-05-18  
> 실제 코드 기준. 변경 시 이 문서를 함께 갱신할 것.

---

## 시스템 개요

Market Radar는 국내주식(KOSPI+KOSDAQ 전종목 ~4,000종목), 미국주식(NASDAQ 시총 상위 2,700종목), 코인(Upbit KRW 전종목 ~230종목), ETF(37종목)를 하나의 대시보드에서 실시간 모니터링하는 웹앱이다. 핵심 가치는 **급상승 종목을 남들보다 빠르게 캐치**하고, 시그널 엔진이 "왜 지금인지"를 자동으로 설명하는 것이다.

프론트엔드는 `src/App.jsx`에서 React 19 + Vite로 실행되며, 탭(홈/국내/미국/코인/ETF/섹터) 구조로 이루어져 있다. 백엔드는 Vercel Edge Functions(`api/d.js` 단일 게이트웨이)와 Cloudflare Workers 크론(`workers/cron/src/index.js`)으로 이중화되어 있으며, Upstash Redis가 가격 스냅샷 캐시, Supabase가 시그널 적중률/히스토리 영구 저장소 역할을 한다.

**주요 기술 스택:**
- Frontend: React 19, Vite 8, TailwindCSS, React Query, lightweight-charts, Recharts
- Backend: Vercel Edge Functions (Node.js 런타임), Cloudflare Workers (V8 Isolate)
- 캐시/DB: Upstash Redis (스냅샷 KV), Supabase PostgreSQL (시그널 적중률)
- AI: Google Gemini 2.5 Flash (뉴스 요약, AI 토론)

---

## 데이터 흐름 (Frontend ↔ Vercel Edge ↔ CF Workers ↔ Upstash ↔ Supabase)

### 가격 데이터 흐름

```
[CF Workers 크론 — workers/cron/src/index.js]
  5분마다: updateCoins() / updateKr() / updateUs()
    → Upstash Redis KV 저장 (snap:kr / snap:us:0~2 / snap:coins)
    → hot tier 저장 (snap:kr:hot / snap:us:hot / snap:coins:hot)

[브라우저 → Vercel Edge → Redis]
  src/hooks/usePrices.js → GET /api/d?t=s (snapshot)
    → api/d.js → api/snapshot.js
    → Upstash Redis mget(snap:kr, snap:us:*, snap:coins, snap:etf)
    → 응답 <100ms (첫 로딩)
  
  30초 폴링: 실시간 갱신
    → api/d.js → api/hantoo-price.js (국내)
    → api/d.js → api/us-price.js (미국, Yahoo→Stooq→Polygon→Naver 4단계 fallback)
    → api/d.js → api/upbit-proxy.js (코인, Upbit REST)
```

### 시그널 데이터 흐름

```
[CF Workers — workers/cron/src/crons/compute-signals.js]
  10분마다: snap:kr:hot + snap:us:hot + snap:coins:hot 읽기
    → COMPOSITE_SCORE 계산 (cross-section-v1)
    → signals:latest KV 저장 (TTL 1200s)

[브라우저 → Vercel Edge → Redis]
  src/hooks/useSignals.js → GET /api/d?t=g (signals)
    → api/d.js → api/signals.js
    → Upstash Redis GET signals:latest
    → signalEngine.loadSignals() 로 클라이언트 엔진에 병합
```

### 시그널 적중률 흐름

```
[CF Workers — workers/cron/src/crons/check-signal-accuracy.js]
  30분마다: 발화된 시그널 가격 비교 → Supabase signal_accuracy 테이블 UPSERT

[브라우저 → Vercel → Supabase]
  src/hooks/useSignalAccuracy.js → GET /api/d?t=a
    → api/d.js → api/signal-accuracy.js → Supabase REST API
```

---

## API Fallback 체인

### 국내주식 (4,000종목)

```
1순위: KRX 전종목 API (data.krx.co.kr)
       workers/cron/src/crons/update-kr.js → fetchKrxMarket()
       KOSPI(STK) + KOSDAQ(KSQ) 동시 조회, 비거래일 최대 5회 재시도

2순위: Naver 전종목 페이징 (m.stock.naver.com/api/stocks/marketValue)
       100종목 × N페이지 병렬 수집, 90% 미달 시 거부

3순위: 한투 API (openapi.koreainvestment.com)
       api/hantoo-price.js — 이전 스냅샷 기반 상위 100종목 개별 조회

4순위: Naver 개별 API (m.stock.naver.com/api/stock/{symbol}/basic)
       최후 수단, 주요 61종목 fallback
```

### 미국주식 (2,700종목, 3-shard)

```
workers/cron/src/crons/update-us.js 기준:
1순위: Yahoo Finance v8 chart API (query1.finance.yahoo.com/v8/finance/chart)
2순위: Stooq (stooq.com/q/d/l)
3순위: Polygon.io (api.polygon.io, API 키 선택)
4순위: Naver 세계증시 (finance.naver.com/world)

api/us-price.js (Vercel fallback):
  Yahoo v8 → Yahoo v7 → Stooq → Alpaca → Naver → 마지막 정상값
```

### 코인

```
workers/cron/src/crons/update-coins.js:
  Upbit REST ticker/all API (primary, 24/7)
  → Upbit WebSocket (클라이언트, 실시간 체결가)
```

### 종목명 EUC-KR 방어

```
workers/cron/src/kr-stock-names.json — 4,238종목 정적 테이블 (1순위)
workers/cron/src/crons/update-kr.js → resolveKrName() — API 오염 감지 후 테이블 우선
src/hooks/usePrices.js → resolveKrName() — 실시간 폴링 종목명 동일 방어
```

---

## 시그널 엔진 아키텍처

시그널 엔진은 클라이언트 계산과 서버 사전계산 두 레이어로 구성된다.

### 서버 사전계산 (CF Workers)

`workers/cron/src/crons/compute-signals.js`가 10분마다 Hot 200 × 3마켓을 읽어 COMPOSITE_SCORE를 계산하고 `signals:latest`에 저장한다. 클라이언트는 1분마다 폴링해 `src/engine/signalEngine.js`의 `loadSignals()`로 병합한다.

**COMPOSITE_SCORE 공식 (cross-section-v1):**
```
score = 0.50 × clip(changePct / 5.0, -1, +1) × 100  (모멘텀)
      + 0.30 × clip(log10(volume / volMedian), -1, +1) × 100  (거래량 Z)
      + 0.20 × clip(changePct - mktAvg, -1, +1) × 100  (상대시장)

|score| ≥ 30 → 발화, 최대 50개 / 시그널 TTL 15분
```

### 클라이언트 계산 (React)

`src/engine/signalEngine.js`는 Pub/Sub 저장소 패턴으로 구현되어 있다. 구독 훅:

- `src/hooks/useSignals.js` — VOLUME_SURGE, MOMENTUM_BREAKOUT 등 가격 기반
- `src/hooks/useInvestorSignals.js` — 외국인·기관 연속 매수/매도 (15분 폴링)
- `src/hooks/useDerivativeSignals.js` — PCR, 펀딩비, VWAP 파생 시그널

**알고리즘 파일** (수정 시 `npm run architect` 필수, PR 자동 차단):
```
src/engine/signalEngine.js, src/engine/signalTypes.js
src/engine/compositeScorer.js, src/engine/taCalculator.js
src/constants/signalThresholds.js
src/hooks/useSignals.js, useDerivativeSignals.js, useInvestorSignals.js
src/utils/newsSignal.js, newsAlias.js, newsTopicMap.js
src/utils/signalCardRenderer.js, marketHours.js
src/data/relatedAssets.js
```

### 시그널 객체 스키마

```ts
{
  id: string,           // 서버: 'cs_{market}_{symbol}' / 클라이언트: 'sig_{ts}_{n}'
  type: string,         // 'composite_score' | 'volume_surge' | 'double_bottom' 등
  market: 'kr' | 'us' | 'crypto',
  direction: 'bullish' | 'bearish' | 'neutral',
  strength: 1~5,
  source: 'client' | 'server' | 'hybrid',
  confidence: number,   // 0~1
  reasons: { label, value }[],
  timestamp: number,    // ms
  expiresAt: number,    // ms
  meta: Record<string, any>,
}
```

---

## 배포 파이프라인 & 컨센서스 게이트

### Vercel 배포

모든 배포는 `npm run deploy` 단일 진입점으로 실행한다. `scripts/pre-deploy-consensus.sh`가 6단계 게이트를 순차 통과해야만 실제 배포가 진행된다.

| 게이트 | 담당 | 기준 |
|--------|------|------|
| 빌드 통과 | 시스템 | `npm run build` 에러 0 |
| P0/P1 이슈 없음 | QA | GitHub Issues 오픈 없음 |
| PM 기획 검토 | PM | 작업 의도와 구현 결과 일치 |
| QA 승인 | QA | quality-baseline.md 충족 |
| 개발팀 승인 | FE/BE | 알고리즘 파일 무단 변경 없음 |
| 조직장 승인 | CPO | fix/feat 포함 배포 조건 충족 |

`vercel.json`의 `ignoreCommand: "exit 0"` 설정으로 Vercel Git 통합 자동 배포는 영구 비활성화(ADR-013). 배포는 반드시 `npm run deploy`만 사용.

### CF Workers 배포

```bash
cd workers/cron && npx wrangler deploy
```

`workers/cron/wrangler.toml`의 cron 트리거 목록이 Cloudflare에 등록된다. Vercel 배포와 독립적으로 별도 실행.

### PR 생성 절차

```
1. gh issue create → Issue 생성 (feat/fix만 필수)
2. git checkout -b feature/#N-설명
3. npm run review:code   → Claude Opus 코드 리뷰
4. npm run pr "제목"     → Gemini gate(gemini-2.5-pro) + PR 생성
5. npm run review:summary → 봇 리뷰 종합 코멘트 게시
```

`scripts/create-pr.sh`가 브랜치명에서 이슈번호를 자동 추출해 `Closes #N`을 PR 본문에 삽입한다.

---

## 보안 & 시크릿 관리

모든 시크릿은 환경변수로만 관리하며 코드에 하드코딩하지 않는다.

**Vercel 환경변수 (프로덕션):**

| 변수 | 용도 |
|------|------|
| `HANTOO_APP_KEY` / `HANTOO_APP_SECRET` | 한국투자증권 OpenAPI 인증 |
| `GEMINI_API_KEY` | Google Gemini AI (뉴스 요약, AI 토론) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | 스냅샷 캐시 |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | 시그널 적중률/히스토리 |
| `GITHUB_TOKEN` / `GITHUB_REPO` | health-check 자동 이슈 생성 |

**보안 규칙 (`CLAUDE.md` 및 `docs/CONVENTIONS.md` 기준):**
- `.env` 파일 `cat` 금지 → `grep -c "KEY_NAME" .env`로 존재 확인만
- `git add -A` / `git add .` 금지 → 파일명 명시
- `vercel env add KEY production` interactive 입력만 허용
- Vercel Edge Functions에서 `process.env.XXX`, Vite에서 `import.meta.env.VITE_XXX` 구분 필수
- 모든 API 엔드포인트는 `api/d.js` 단일 게이트웨이를 통해 JS 난독화로 라우팅 (직접 엔드포인트 노출 최소화)

한투 WebSocket approval_key는 `api/hantoo-ws-approval.js`에서 인스턴스 메모리(Tier 1) + Upstash Redis 23h(Tier 2)로 이중 캐싱해 cold start 시 KIS API 재호출을 방지한다.

---

## 알려진 제약과 트레이드오프

### CF Workers subrequest 한도 (50/invocation)

`workers/cron/src/index.js`는 invocation당 단일 크론만 실행하도록 분리되어 있다 (주석 `#125`). compute-signals 크론은 KV read 3 + write 1 + recordCronSuccess ~2 = 최대 6 subrequest로 여유 있음. 그러나 향후 크론 당 외부 API 호출을 추가할 경우 한도 초과 위험.

### DOUBLE_BOTTOM / RECOVERY_DETECTION 미구현

`workers/cron/src/crons/compute-signals.js`는 Phase 1 (COMPOSITE_SCORE only). DOUBLE_BOTTOM은 15개 이상 캔들, RECOVERY_DETECTION은 25개 이상 캔들이 필요하나, 현재 KV 스냅샷은 단일 시점 데이터만 저장. Phase 2에서 `history:daily:{market}:{symbol}` KV 시계열 구축 후 구현 예정.

### Vercel Edge 서울 리전 단일

`vercel.json`의 `"regions": ["icn1"]`으로 서울 리전 고정. 글로벌 트래픽 대응 불가하나 한국 투자 서비스 특성상 레이턴시 최적화 우선.

### 코인 market 필드 컨벤션 혼재

`workers/cron/src/crons/update-coins.js`는 `market: 'coin'`으로 저장하나, `src/engine/signalEngine.js`는 `market: 'crypto'`를 사용한다. `workers/cron/src/crons/compute-signals.js`에서 정규화하여 처리 중. 통일 리팩터는 별도 이슈.

### 미장 야간 데이터 공백

미장 크론(`update-us.js`)은 UTC 0-1시, 8-23시에만 실행. 야간 quiet window(UTC 2-7시)에는 신규 가격 수집 없음. `api/_price-cache.js`의 `BACKUP_TTL = 86400`으로 전일 데이터 24h 보존해 UI "--" 표시 방지.

### Playwright QA 브라우저 미종료 위험

QA 자동화 시 `mcp__playwright__browser_close` 미호출 시 89GB/일 데이터 소모 사고 발생 이력 (2026-04-09). 모든 QA 세션 종료 시 브라우저 명시적 종료 필수. `CLAUDE.md`에 HARD RULE로 등록됨.
