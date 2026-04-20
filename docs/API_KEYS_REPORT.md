# 마켓레이더 — 실시간 데이터 API 키 보고서

> 작성일: 2026-03-17
> 목적: 현재 mock/지연 데이터를 실제 실시간 데이터로 교체하기 위해 필요한 API 키 목록

---

## 현재 데이터 품질 현황

| 종류 | 현재 방식 | 정확도 | 문제점 |
|------|----------|--------|--------|
| 코인 | Upbit WebSocket (실시간) | ✅ 정확 | 없음 |
| 국장 | Naver Finance 스크래핑 (allorigins 프록시) | ⚠️ 15분 지연 | CORS, 불안정 |
| 미장 | Yahoo Finance + Stooq 폴백 | ⚠️ 15분 지연 | 전일종가 부정확 |
| ETF | mock 데이터 | ❌ 가짜 | 실제 데이터 없음 |
| 뉴스 | Google 뉴스 RSS (한국어) | ⚠️ 준실시간 | 종목 매칭 약함 |

---

## 필요한 API 키 목록

### 1. 🔑 한국투자증권 (KIS) OpenAPI — 국장 실시간 시세
> **대체 대상**: Naver Finance 스크래핑 (allorigins) 완전 교체
> **효과**: 국내 주식 실시간 시세, 등락률 정확, 거래량 정확, 투자자 수급 실데이터

| 항목 | 내용 |
|------|------|
| 발급처 | https://apiportal.koreainvestment.com |
| 인증 방식 | App Key + App Secret → Bearer Token 발급 |
| 주요 API | 주식 현재가, 등락률, 거래량, 외국인/기관/개인 수급 |
| 무료 여부 | 무료 (계좌 개설 필요) |
| 환경변수 | `VITE_KIS_APP_KEY=PSxxxxxxxxxxxxxxx` |
| | `VITE_KIS_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxx` |
| 우선순위 | ⭐⭐⭐ 최고 (국장 완전 해결) |

**발급 방법**:
1. 한국투자증권 계좌 개설 (온라인 가능)
2. https://apiportal.koreainvestment.com 접속
3. Apps → 앱 등록 → App Key + Secret 발급
4. 모의투자 또는 실계좌 선택

**제공 데이터**:
- `GET /uapi/domestic-stock/v1/quotations/inquire-price` → 현재가, 등락률, 거래량
- `GET /uapi/domestic-stock/v1/quotations/inquire-investor` → 외국인/기관/개인 순매수 (실데이터!)
- `GET /uapi/domestic-stock/v1/quotations/inquire-daily-price` → 일봉 데이터

---

### 3. 🔑 Polygon.io — 미장 실시간 시세
> **대체 대상**: Yahoo Finance + Stooq 폴백 완전 교체
> **효과**: 미국 주식 전종목 실시간 시세, 전일종가 정확, S&P 500 모두 커버

| 항목 | 내용 |
|------|------|
| 발급처 | https://polygon.io |
| 무료 플랜 | 5 API calls/min, 전일 종가 (15분 지연) |
| Starter 플랜 | 월 $29, Unlimited calls, 실시간 |
| 환경변수 | `VITE_POLYGON_API_KEY=xxxxxxxxxxxxxxxx` |
| 우선순위 | ⭐⭐⭐ 최고 (미장 완전 해결) |

**발급 방법**: polygon.io 가입 → Dashboard → API Keys

**제공 데이터**:
- `GET /v2/snapshot/locale/us/markets/stocks/tickers` → 전체 스냅샷 (가격+등락+거래량)
- `GET /v2/aggs/ticker/{ticker}/prev` → 전일 종가 (정확)
- `GET /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}` → 일봉 캔들

---

### 4. 🔑 Alpha Vantage — 미장 보조 / ETF 데이터
> **용도**: Polygon.io 폴백 + ETF 실시간 시세

| 항목 | 내용 |
|------|------|
| 발급처 | https://www.alphavantage.co/support/#api-key |
| 무료 플랜 | 25 API calls/day (실질적으로 제한적) |
| Premium | 월 $50~, Unlimited |
| 환경변수 | `VITE_ALPHA_VANTAGE_KEY=XXXXXXXXXX` |
| 우선순위 | ⭐⭐ 보통 (Polygon 있으면 불필요) |

---

### 5. 🔑 CoinGecko Pro API — 코인 메타데이터
> **현재**: 무료 공개 API 사용 중 (rate limit 빈번)
> **효과**: 시가총액, 공포탐욕지수, 도미넌스 안정적 수신

| 항목 | 내용 |
|------|------|
| 발급처 | https://www.coingecko.com/en/api/pricing |
| 무료 플랜 | 분당 10-30 req (현재 사용 중, 불안정) |
| Demo 플랜 | 무료, 분당 30 req, 키 필요 |
| 환경변수 | `VITE_COINGECKO_API_KEY=CG-xxxxxxxxxxxxxxxxx` |
| 우선순위 | ⭐⭐ 보통 (코인 시세는 Upbit으로 OK, 메타만 필요) |

**발급 방법**: coingecko.com 가입 → Developer Dashboard → Demo API Key (무료)

---

### 6. 🔑 Finnhub — 미장 뉴스 + 기업 정보
> **용도**: 종목별 관련 뉴스, 실적 캘린더, 기업 정보

| 항목 | 내용 |
|------|------|
| 발급처 | https://finnhub.io |
| 무료 플랜 | 60 API calls/min, 1년치 뉴스 |
| 환경변수 | `VITE_FINNHUB_KEY=xxxxxxxxxxxxxxxxxx` |
| 우선순위 | ⭐⭐⭐ 높음 (종목별 관련뉴스 해결) |

**발급 방법**: finnhub.io 가입 → API Key (즉시 발급)

**제공 데이터**:
- `GET /api/v1/company-news?symbol=AAPL&from=...&to=...` → 종목별 뉴스 (영문)
- `GET /api/v1/stock/profile2?symbol=AAPL` → 기업 기본 정보
- `GET /api/v1/quote?symbol=AAPL` → 실시간 시세 (무료, 15분 지연)

---

## 적용 우선순위 로드맵

```
Phase 1 (즉시, 무료/저비용):
✅ CoinGecko Demo Key → 코인 메타 안정화
✅ Finnhub Key → 종목별 관련 뉴스

Phase 2 (계좌 개설 필요):
🔧 KIS OpenAPI → 국장 실시간 + 투자자 수급 실데이터

Phase 3 (유료 서비스):
💰 Polygon.io Starter ($29/월) → 미장 실시간
```

---

## .env 파일 설정 예시

```bash
# .env (절대 GitHub에 올리지 않음)

# === 코인 ===
VITE_COINGECKO_API_KEY=CG-xxxxxxxxxxxxxxxxx

# === 국내주식 (KIS OpenAPI) ===
VITE_KIS_APP_KEY=PSxxxxxxxxxxxxxxxxxxxxxxx
VITE_KIS_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# === 미국주식 ===
VITE_POLYGON_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx

# === 미장 뉴스/기업정보 ===
VITE_FINNHUB_KEY=xxxxxxxxxxxxxxxxxx
```

---

## 현재 당장 무료로 개선 가능한 것들

API 키 없이도 다음은 바로 개선 가능:
1. **Stooq 전일종가 수정** → 이미 완료 (v3 브랜치)
2. **업비트 KRW 전종목 동적 로딩** → 이미 완료 (v3 브랜치)
3. **KOSPI 200 종목 확장** → 이미 완료 (135개, v3 브랜치)
4. **S&P 500 종목 확장** → 이미 완료 (151개, v3 브랜치)

---

*이 보고서는 API 키를 제공받는 즉시 연동 작업을 진행할 수 있도록 사전 준비된 문서입니다.*
