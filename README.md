<div align="center">

# Market Radar

**국내주식 / 미국주식 / 암호화폐 통합 실시간 투자 대시보드**

[![Live Demo](https://img.shields.io/badge/Live-Demo-00C853?style=for-the-badge&logo=vercel&logoColor=white)](https://market-dashboard-v5.vercel.app)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

국장 61종목 + 미장 250종목 + ETF 38종목 + 코인 250종목을 **하나의 대시보드**에서 실시간으로 모니터링합니다.

[Live Demo](https://market-dashboard-v5.vercel.app) · [버그 리포트](https://github.com/gguloadoong/market-dashboard-v5/issues) · [기능 요청](https://github.com/gguloadoong/market-dashboard-v5/issues)

</div>

---

## Overview

Market Radar는 흩어져 있는 투자 정보를 한 곳에 모아 **매수 결정 직전 5분**을 돕는 실시간 대시보드입니다. 한국투자증권, Yahoo Finance, Upbit, Stooq 등 **10개 이상의 데이터 소스**를 통합하고, Google Gemini AI로 뉴스를 자동 요약합니다.

---

## Features

| | 기능 | 설명 |
|---|------|------|
| **[실시간 시세]** | Market Pulse | KOSPI/KOSDAQ/BTC/환율 실시간 지수 + 공포탐욕지수(코인/미장/국장) |
| **[시그널]** | 핵심 시그널 | 외국인·기관 연속매수, 거래량 이상치, 뉴스 임팩트 복합 신호 |
| **[스마트 추천]** | 주목할 종목 | 변동폭 + 거래량 + 뉴스 매칭 복합 점수 기반 히어로 카드 |
| **[워치리스트]** | 관심종목 관리 | 크로스에셋(주식/코인) 워치리스트 + 매수가 입력 → 평가손익 실시간 표시 |
| **[알림]** | 조건부 알림 | 목표가·거래량 조건 설정 + PWA Push + 관심종목 뉴스 알림 |
| **[랭킹]** | 급등/급락 | KR/US/COIN 마켓별 TOP 5 실시간 랭킹 + 조건 스크리너 |
| **[AI 뉴스]** | 투자 뉴스 | RSS 기반 뉴스 + Gemini AI 요약 + 임팩트 스코어(🟢호재/🔴악재) |
| **[차트]** | 캔들 차트 | lightweight-charts 일/주/월봉 + 거래량 + 투자자 동향 + "왜 지금?" |
| **[자금 흐름]** | 섹터 로테이션 | HOT/COLD MONEY 시각화 — 국장·미장·코인 통합 섹터 자금 흐름 |
| **[이벤트]** | 경제 캘린더 | FOMC, CPI, 실업률 등 이번 주/다음 주 주요 일정 |
| **[다크모드]** | 테마 전환 | 야간 트레이딩 지원 — 빨강=상승/파랑=하락 한국 증권 컨벤션 유지 |

---

## Tech Stack

### Frontend
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![React Query](https://img.shields.io/badge/React_Query-FF4154?style=flat-square&logo=reactquery&logoColor=white)

### Charts & Visualization
![TradingView](https://img.shields.io/badge/Lightweight_Charts-131722?style=flat-square&logo=tradingview&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-FF6384?style=flat-square)

### Backend & Infra
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?style=flat-square&logo=google&logoColor=white)

---

## Data Sources

| 데이터 | 소스 | 키 |
|--------|------|:---:|
| 국내 주식 (61종목) | 한국투자증권 Open API (KIS WebSocket) | 필요 |
| 미국 주식 (~250종목) | Yahoo Finance v8 → Stooq → Alpaca → Naver 6단계 fallback | 불필요 |
| ETF (38종목) | Yahoo Finance (국내/해외 ETF) | 불필요 |
| 코인 가격 KRW (~250종목) | Upbit REST + WebSocket | 불필요 |
| 코인 시총/스파크라인 | CoinGecko | 불필요 |
| 시장 지수 | 한투 API + Stooq + Yahoo Finance | 필요 |
| 환율 | Yahoo Finance KRW=X | 불필요 |
| 뉴스 (국내) | 한경·매경·연합뉴스·이데일리·머니투데이 RSS | 불필요 |
| 뉴스 (코인) | CoinDesk·Decrypt·CoinTelegraph RSS | 불필요 |
| 뉴스 (미장) | Yahoo Finance·MarketWatch RSS | 불필요 |
| 공포탐욕지수 | Alternative.me (코인) + CNN Money (미장) + VKOSPI (국장) | 불필요 |
| 고래 추적 | Whale Alert API | 필요 |
| AI 요약 | Google Gemini 2.5 Flash | 필요 |

> 필수 키 없이도 코인/미장 데이터는 정상 작동합니다.

---

## Getting Started

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

# 개발 서버 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build
```

### 환경변수

| 변수 | 필수 | 설명 |
|------|:----:|------|
| `HANTOO_APP_KEY` | O | 한국투자증권 앱 키 |
| `HANTOO_APP_SECRET` | O | 한국투자증권 앱 시크릿 |
| `GEMINI_API_KEY` | - | Google Gemini (뉴스 AI 요약) |
| `GROQ_API_KEY` | - | Groq AI (고속 추론) |
| `POLYGON_API_KEY` | - | Polygon.io (미장 보조 데이터) |
| `WHALE_ALERT_KEY` | - | Whale Alert (고래 추적) |
| `KRX_API_KEY` | - | KRX ETF 데이터 |
| `KV_REST_API_URL` | - | Vercel KV — Redis 캐시 URL |
| `KV_REST_API_TOKEN` | - | Vercel KV — Redis 캐시 토큰 |

---

## Architecture

```
market-dashboard-v5/
├── api/                        Vercel Serverless Functions
│   ├── hantoo-*.js              한투 API 프록시 (가격, 지수, 투자자, 차트)
│   ├── kr-fear-greed.js         국장 공포탐욕지수 (VKOSPI + 외국인 순매수)
│   ├── us-price.js              미장 Yahoo v8 프록시
│   ├── market-indices.js        글로벌 지수 프록시
│   ├── news-summary.js          Gemini/Groq AI 뉴스 요약
│   └── _price-cache.js          Vercel KV Redis 캐시 공통 모듈
├── src/
│   ├── components/
│   │   ├── home/                 홈 대시보드 위젯
│   │   ├── ChartSidePanel.jsx    캔들 차트 패널
│   │   └── WatchlistTable.jsx    워치리스트 테이블
│   ├── engine/                  시그널 엔진 (알고리즘 핵심)
│   ├── hooks/                   커스텀 훅 (useSignals, useDerivativeSignals 등)
│   └── utils/                   유틸리티 (뉴스 매칭, 시장 시간, 시그널 렌더링)
├── scripts/
│   ├── pre-deploy-consensus.sh  배포 전 6단계 컨센서스 게이트
│   ├── create-pr.sh             PR 생성 자동화 (Opus+Codex 리뷰 포함)
│   └── run-code-reviewer.sh     Claude Opus 코드 리뷰
└── .github/workflows/           CI/CD + PR 자동 리뷰 (Gemini, CodeRabbit, Copilot)
```

---

## Environment Variables

| 변수 | 필수 | 설명 |
|------|:----:|------|
| `HANTOO_APP_KEY` | O | 한국투자증권 앱 키 |
| `HANTOO_APP_SECRET` | O | 한국투자증권 앱 시크릿 |
| `GEMINI_API_KEY` | - | Google Gemini (뉴스 AI 요약) |
| `GROQ_API_KEY` | - | Groq AI (고속 추론) |
| `POLYGON_API_KEY` | - | Polygon.io (미장 보조 데이터) |
| `WHALE_ALERT_KEY` | - | Whale Alert (고래 추적) |
| `KRX_API_KEY` | - | KRX ETF 데이터 |
| `KV_REST_API_URL` | - | Vercel KV (Upstash Redis) — 스냅샷 캐시 URL |
| `KV_REST_API_TOKEN` | - | Vercel KV (Upstash Redis) — 스냅샷 캐시 토큰 |

---

## PR Review Automation

모든 PR에 4명의 AI 리뷰어가 자동으로 코드 리뷰를 수행합니다:

| 리뷰어 | 역할 |
|--------|------|
| **Claude Opus** | 코드 리뷰 (로컬 — `npm run review:code`) |
| **OpenAI Codex** | 정확성/버그 게이트 (`npm run review:gate`) |
| **Gemini Code Assist** | Google AI 자동 PR 리뷰 |
| **CodeRabbit** | 변경 요약 + 코드 리뷰 |
| **GitHub Copilot** | Copilot 코드 리뷰 |

---

## Security

[SECURITY.md](SECURITY.md) 참고. 모든 API 키는 환경변수로 관리하며 코드에 하드코딩하지 않습니다.

---

## License

[MIT](LICENSE)
