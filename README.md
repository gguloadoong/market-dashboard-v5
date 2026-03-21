<div align="center">

# Market Radar

**국내주식 / 미국주식 / 암호화폐 통합 실시간 투자 대시보드**

[![Live Demo](https://img.shields.io/badge/Live-Demo-00C853?style=for-the-badge&logo=vercel&logoColor=white)](https://market-dashboard-v2-mu.vercel.app)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

국장 52종목 + 미장 60종목 + 코인 250종목을 **하나의 대시보드**에서 실시간으로 모니터링합니다.

[Live Demo](https://market-dashboard-v2-mu.vercel.app) · [버그 리포트](https://github.com/gguloadoong/market-dashboard-v2/issues) · [기능 요청](https://github.com/gguloadoong/market-dashboard-v2/issues)

</div>

---

## Overview

Market Radar는 흩어져 있는 투자 정보를 한 곳에 모아 **빠른 의사결정**을 돕는 실시간 대시보드입니다. 한국투자증권, Yahoo Finance, Upbit, CoinPaprika 등 **10개 이상의 데이터 소스**를 통합하고, Google Gemini AI로 뉴스를 자동 요약합니다.

---

## Features

| | 기능 | 설명 |
|---|------|------|
| **[실시간 시세]** | Market Pulse | KOSPI/KOSDAQ/BTC/환율 실시간 지수 + 개별 종목 가격 |
| **[스마트 추천]** | 주목할 종목 | 변동폭 + 거래량 + 뉴스 매칭 복합 점수 기반 히어로 카드 |
| **[워치리스트]** | 관심종목 관리 | 크로스에셋(주식/코인) 워치리스트 + 가격 알림 |
| **[랭킹]** | 급등/급락 | KR/US/COIN 마켓별 TOP 5 실시간 랭킹 |
| **[AI 뉴스]** | 투자 뉴스 | RSS 기반 뉴스 + Gemini AI 요약 + 종목 연결 뱃지 |
| **[차트]** | 캔들 차트 | lightweight-charts 일/주/월봉 + 거래량 + 투자자 동향 |
| **[자금 흐름]** | 섹터 로테이션 | HOT/COLD MONEY 시각화 — 자금 유입/유출 섹터 |
| **[공지]** | 거래소 공지 | Upbit/Bithumb 신규 상장 모니터링 |

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
| 국내 주식 (52종목) | 한국투자증권 Open API | 필요 |
| 미국 주식 (60종목) | Yahoo Finance v8 + Stooq | 불필요 |
| 코인 가격 KRW (250종목) | Upbit REST + WebSocket | 불필요 |
| 코인 가격 USD | CoinPaprika + Binance | 불필요 |
| 코인 스파크라인 | CoinGecko | 불필요 |
| 시장 지수 | Vercel Edge + 한투 API | 필요 |
| 환율 | Binance + Upbit BTC 교차 계산 | 불필요 |
| 뉴스 | RSS (Investing.com, 연합뉴스 등) | 불필요 |
| AI 요약 | Google Gemini 2.5 Flash Lite | 필요 |

> 필수 키 없이도 코인/미장 데이터는 정상 작동합니다.

---

## Getting Started

### 사전 요구사항
- Node.js 18+
- npm 9+

### 설치 및 실행

```bash
# 레포 클론
git clone https://github.com/gguloadoong/market-dashboard-v2.git
cd market-dashboard-v2

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
| `WHALE_ALERT_KEY` | - | Whale Alert (고래 추적) |
| `KRX_API_KEY` | - | KRX ETF 데이터 |

---

## Architecture

```
market-dashboard-v2/
├── api/                        Vercel Serverless / Edge Functions
│   ├── hantoo-*.js              한투 API 프록시 (가격, 지수, 투자자)
│   ├── us-price.js              미장 Yahoo v8 프록시
│   ├── market-indices.js        글로벌 지수 프록시
│   ├── news-summary.js          Gemini AI 뉴스 요약
│   └── rss.js                   RSS 뉴스 프록시
├── src/
│   ├── api/                     클라이언트 API 모듈
│   │   ├── coins.js              코인 (CoinPaprika + Binance + Upbit)
│   │   └── stocks.js             주식 (한투 + Yahoo + Stooq)
│   ├── components/
│   │   ├── home/                 홈 대시보드 위젯
│   │   ├── ChartSidePanel.jsx    캔들 차트 패널
│   │   ├── WatchlistTable.jsx    워치리스트 테이블
│   │   └── BreakingNewsPanel.jsx 뉴스 슬라이드 패널
│   ├── hooks/                   커스텀 훅 (usePrices, useCoins, useIndices)
│   └── utils/                   유틸리티 (뉴스 매칭, 시장 시간, 알림)
├── .github/workflows/           CI/CD + PR 자동 리뷰
└── .pr_agent.toml               Qodo PR Agent 설정
```

---

## PR Review Automation

모든 PR에 4명의 AI 리뷰어가 자동으로 코드 리뷰를 수행합니다:

| 리뷰어 | 역할 |
|--------|------|
| **Gemini Code Assist** | Google AI 코드 리뷰 |
| **Qodo PR Agent** | 보안/품질/개선 제안 (Gemini 2.5 Flash) |
| **CodeRabbit** | 변경 요약 + 코드 리뷰 |
| **GitHub Copilot** | Copilot 코드 리뷰 |

---

## Security

[SECURITY.md](SECURITY.md) 참고. 모든 API 키는 환경변수로 관리하며 코드에 하드코딩하지 않습니다.

---

## License

[MIT](LICENSE)
