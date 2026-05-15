<div align="center">

# Market Radar

**국내주식 / 미국주식 / 암호화폐 통합 실시간 투자 대시보드**

[![Live Demo](https://img.shields.io/badge/Live-Demo-00C853?style=for-the-badge&logo=vercel&logoColor=white)](https://market-dashboard-v5.vercel.app)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

국장 63종목 + 미장 NASDAQ 시총 상위 2,700종목 + ETF(국내·해외 혼합) + 코인 Upbit KRW 전 종목을 **하나의 대시보드**에서 실시간으로 모니터링합니다.

[Live Demo](https://market-dashboard-v5.vercel.app) · [버그 리포트](https://github.com/gguloadoong/market-dashboard-v5/issues) · [기능 요청](https://github.com/gguloadoong/market-dashboard-v5/issues)

</div>

---

## 개요

Market Radar는 흩어져 있는 투자 정보를 한 곳에 모아 **매수 결정 직전 5분**을 돕는 실시간 대시보드입니다. 한국투자증권, Yahoo Finance, Upbit, Stooq 등 **10개 이상의 데이터 소스**를 통합하고, Google Gemini AI로 뉴스를 자동 요약합니다. 서버 사전계산 시그널(Cloudflare Workers)과 시그널 적중률 추적(Supabase)까지 포함한 풀스택 투자 도구입니다.

---

## 주요 기능

| | 기능 | 설명 |
|---|------|------|
| **[실시간 시세]** | Market Pulse | KOSPI/KOSDAQ/BTC/환율 실시간 지수 + 공포탐욕지수(코인/미장/국장 통합) |
| **[시그널]** | 핵심 시그널 | 외국인·기관 연속매수, 거래량 이상치, 뉴스 클러스터, 복합 점수(COMPOSITE_SCORE) |
| **[스마트 추천]** | 주목할 종목 WHY 카드 | 복합 스코어 기반 히어로 카드 — 매수 근거 자동 생성 |
| **[랭킹]** | 급등/급락 TOP5 | 국내·미국·코인 마켓별 실시간 TOP 5 |
| **[AI 토론]** | 종목 AI 토론 | 살 이유 vs 조심할 이유 자동 생성 (Gemini 2.5 Flash) |
| **[뉴스]** | 투자 뉴스 피드 | RSS 기반 뉴스 + Gemini AI 요약 + 임팩트 스코어(호재/악재) |
| **[차트]** | 캔들 차트 | lightweight-charts 일/주/월봉 + 거래량 + 투자자 동향 |
| **[워치리스트]** | 관심종목 | localStorage 기반 마켓별 관심종목 관리 |
| **[시그널 성적표]** | SignalLab | 시그널 정확도 적중률 추적 (Supabase 히스토리) |
| **[다크모드]** | 테마 전환 | 야간 트레이딩 지원 — 빨강=상승/파랑=하락 한국 증권 컨벤션 유지 |

---

## 기술 스택

### Frontend
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![React Query](https://img.shields.io/badge/@tanstack/react--query-FF4154?style=flat-square&logo=reactquery&logoColor=white)

### 차트 & 시각화
![TradingView](https://img.shields.io/badge/Lightweight_Charts-131722?style=flat-square&logo=tradingview&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts_(스파크라인)-FF6384?style=flat-square)

### Backend & Infra
![Vercel](https://img.shields.io/badge/Vercel_Edge_Functions-000000?style=flat-square&logo=vercel&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Upstash](https://img.shields.io/badge/Upstash_Redis-00E9A3?style=flat-square&logo=upstash&logoColor=black)
![Google Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)

---

## 데이터 소스

| 데이터 | 소스 | API 키 |
|--------|------|:------:|
| 국내 주식 (63종목) | 한국투자증권 Open API (KIS) | 필요 |
| 미국 주식 (NASDAQ 시총 상위 2,700종목) | Yahoo Finance v8 → Stooq → Polygon → Naver 4단계 fallback | 일부 선택 |
| ETF (국내·해외 혼합) | Yahoo Finance | 불필요 |
| 코인 가격 KRW (Upbit KRW 전 종목, 동적 수집) | Upbit REST + WebSocket | 불필요 |
| 코인 시총/스파크라인 | CoinGecko | 불필요 |
| 시장 지수 | 한투 API + Stooq | 필요 |
| 환율 | Yahoo Finance KRW=X | 불필요 |
| 국내 뉴스 | 한경·매경·연합뉴스·이데일리·머니투데이 RSS | 불필요 |
| 코인 뉴스 | CoinDesk·Decrypt·CoinTelegraph RSS | 불필요 |
| 미장 뉴스 | Yahoo Finance·MarketWatch RSS | 불필요 |
| 공포탐욕지수 | Alternative.me (코인) + CNN Money (미장) + VKOSPI (국장) | 불필요 |
| AI 요약·토론 | Google Gemini 2.5 Flash | 선택 |
| 서버 시그널 | Cloudflare Workers 크론 (10분 간격) | — |

> 한투 API 키 없이도 코인·미국 주식 데이터는 정상 동작합니다.

---

## 시작하기

### 사전 요구사항
- Node.js 18+
- npm 9+

### 설치 및 실행

```bash
# 레포 클론
git clone https://github.com/gguloadoong/market-dashboard-v5.git
cd market-dashboard-v5

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 API 키 입력

# 프로덕션 빌드 (개발 서버 대신 빌드로 검증)
npm run build
```

### 환경변수

| 변수 | 필수 | 설명 |
|------|:----:|------|
| `HANTOO_APP_KEY` | O | 한국투자증권 앱 키 |
| `HANTOO_APP_SECRET` | O | 한국투자증권 앱 시크릿 |
| `GEMINI_API_KEY` | - | Google Gemini (뉴스 AI 요약, 시그널 AI 토론) |
| `POLYGON_API_KEY` | - | Polygon.io (미장 3순위 fallback, 없으면 스킵) |
| `UPSTASH_REDIS_REST_URL` | - | Upstash Redis — 스냅샷 캐시 URL |
| `UPSTASH_REDIS_REST_TOKEN` | - | Upstash Redis — 스냅샷 캐시 토큰 |
| `SUPABASE_URL` | - | Supabase — 시그널 적중률/히스토리 |
| `SUPABASE_ANON_KEY` | - | Supabase 익명 키 |

---

## 아키텍처

```
market-dashboard-v5/
├── api/                        Vercel Edge Functions
│   ├── kr-stocks.js             국내 주식 시세 (한투 API)
│   ├── us-stocks.js             미국 주식 시세 (Yahoo→Stooq→Polygon→Naver 4단계 fallback)
│   ├── coins.js                 코인 시세 (Upbit + CoinGecko)
│   ├── signals.js               서버 사전계산 시그널 (Cloudflare Workers KV)
│   ├── signal-accuracy.js       시그널 적중률 (Supabase)
│   └── ...
├── src/
│   ├── components/home/         홈 대시보드 위젯
│   ├── engine/                  시그널 엔진 (알고리즘 핵심)
│   ├── hooks/                   커스텀 훅 (useSignals, useDerivativeSignals 등)
│   └── utils/                   유틸리티 (뉴스 매칭, 시장 시간, 시그널 렌더링)
├── workers/cron/                Cloudflare Workers 크론
│   └── (5분 간격 가격 수집, 10분 간격 시그널 계산)
└── scripts/
    ├── pre-deploy-consensus.sh  배포 전 6단계 컨센서스 게이트
    └── create-pr.sh             PR 생성 자동화 (Opus 리뷰 + Gemini gate 포함)
```

---

## 배포

```bash
npm run deploy        # 컨센서스 게이트 → Vercel 배포
npm run deploy:check  # 게이트 확인만 (배포 없음)
npm run build         # 빌드만
```

**배포 전 6단계 컨센서스 게이트** (`scripts/pre-deploy-consensus.sh`):

| 게이트 | 기준 |
|--------|------|
| 빌드 통과 | `npm run build` 에러 0 |
| P0/P1 이슈 없음 | GitHub Issues 오픈 없음 |
| PM 기획 검토 | 작업 의도와 구현 결과 일치 |
| QA 승인 | quality-baseline.md 충족 |
| 개발팀 승인 | 알고리즘 파일 무단 변경 없음 |
| 조직장 승인 | fix/feat 포함 배포 조건 충족 |

---

## PR 리뷰 자동화

| 리뷰어 | 역할 |
|--------|------|
| **Claude Opus** | 로컬 코드 리뷰 (`npm run review:code`) |
| **Gemini gate** | PR 전 자동 검증 (`npm run review:gate`, gemini-2.5-pro) |
| **Gemini Code Assist** | GitHub PR 자동 리뷰 |
| **CodeRabbit** | 변경 요약 + 코드 리뷰 |
| **GitHub Copilot** | Copilot 코드 리뷰 |

```bash
npm run review:code     # Claude Opus 코드 리뷰 → .tmp/code-review-{BRANCH}.md
npm run review:gate     # Gemini gate 검증
npm run review:summary  # 봇 리뷰 종합 → PR 코멘트 자동 게시
npm run pr "PR 제목"    # 빌드 + artifact 검증 + Gemini gate + PR 생성
```

---

## 보안

[SECURITY.md](SECURITY.md) 참고. 모든 API 키는 환경변수로만 관리하며 코드에 하드코딩하지 않습니다.

---

## 라이선스

[MIT](LICENSE)
