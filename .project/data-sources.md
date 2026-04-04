---
소유자: 김민준 (BE)
마지막 업데이트: 2026-04-04
출처: backlog.md Phase 3/7 완료 이력 + api/ 디렉토리 실제 구현
---

# 마켓레이더 데이터 소스

## 데이터 신선도 SLA

| 데이터 | 목표 신선도 | 현재 상태 |
|--------|-----------|----------|
| 코인 시세 | 10초 이내 | ✅ Upbit WebSocket 실시간 |
| 국장 시세 | 30초 이내 | ✅ KIS WebSocket + 5분 Cron Redis 스냅샷 |
| 미장 시세 | 30초 이내 | ✅ Yahoo v8 + 2분 Cron Redis 스냅샷 |
| 국내 지수 | 60초 이내 | ✅ 한투 API + Stooq fallback |
| 해외 지수 | 60초 이내 | ✅ Yahoo Finance |
| 뉴스 | 5분 이내 | ✅ RSS 다중 소스 (국내/미장/코인 분리) |
| 환율 | 1분 이내 | ✅ Yahoo Finance KRW=X |
| 공포탐욕 | 5분 이내 | ✅ Alternative.me + CNN Money + VKOSPI/KIS |

## Fallback 체인

### 코인
1. Upbit WebSocket (실시간, KRW 마켓 ~250개)
2. CoinGecko REST (10초 폴링, 시총/도미넌스/스파크라인)

### 국장 주식
1. Vercel Cron → Redis 스냅샷 (5분 갱신)
   - 1순위: KRX 전종목 API
   - 2순위: Naver Finance 전종목 페이징
   - 3순위: 한투 OpenAPI 개별 조회 (HANTOO_NAME_MAP 20종목 — ⚠️ 종목 수 제한)
2. KIS WebSocket 실시간 체결가 (키 설정 시)
3. 브라우저 폴링 (관심종목 + fallback 소규모)

### 미장 주식
1. Vercel Cron → Redis 스냅샷 (2분 갱신, Yahoo v8 chart API)
2. Yahoo Finance v8 (`/v8/finance/chart/`)
3. Yahoo Finance v7 (`/v7/finance/quote/`)
4. Stooq CSV (CORS-free)
5. Alpaca Markets (키 설정 시)
6. Naver 해외시세 스크래핑
7. Redis 캐시 마지막값 (모두 실패 시)

### ETF
1. Yahoo Finance REST (60초 폴링)
2. Vercel Function 프록시 `/api/etf-prices` (ADR-008)

### 지수
1. 한투 API (KOSPI/KOSDAQ)
2. Stooq (S&P500, NASDAQ, DOW)
3. Yahoo Finance (^KS11, ^KQ11, ^GSPC 등)

### 뉴스
**국내:**
- 한국경제, 매일경제, 연합뉴스 경제, 이데일리, 머니투데이, 네이버 증권, 블록미디어 RSS

**코인:**
- CoinDesk, Decrypt, CoinTelegraph RSS

**미장:**
- Yahoo Finance, MarketWatch RSS

**공통 fallback:**
- Vercel Edge Function `/api/rss` (프로덕션 프록시)

### 공포탐욕지수 (`/api/kr-fear-greed`, `/api/fear-greed`)
**코인:** Alternative.me Crypto Fear & Greed Index
**미장:** CNN Money Fear & Greed Index
**국장:** VKOSPI(Naver) + 외국인 순매수(KIS — 14일 윈도우, 장기연휴 대응)

## 장애 시나리오

| 시나리오 | 영향 | 대응 |
|---------|------|------|
| KRX + Naver 동시 장애 | 국장 Cron이 20종목만 스냅샷 | HANTOO_NAME_MAP fallback (v2 대비 종목 감소) |
| Yahoo Finance 장애 | 미장 시세 지연 | 6단계 fallback 자동 전환 |
| KIS 토큰 만료 | 국장 실시간 불가 | Naver Finance fallback |
| Redis(Upstash) 장애 | 첫 로딩 스냅샷 없음 | 브라우저 폴링으로 직접 조회 |
| Vercel Edge 장애 | 뉴스 미로딩 | RSS 직접 구독 fallback |
| CoinGecko rate limit | 코인 시총 미갱신 | Upbit WS 가격은 유지 |

## 캐싱 전략

| 데이터 | React Query staleTime | refetchInterval | Redis TTL |
|--------|----------------------|-----------------|-----------|
| 코인 시세 | 10초 | 10초 | 1분 (Cron 1분) |
| 미장 시세 | 30초 | 30초 | 2분 (Cron 2분) |
| 국장 시세 | 30초 | 30초 | 5분 (Cron 5분) |
| 뉴스 | 5분 | 5분 | — |
| 환율 | 1분 | 1분 | — |
| 차트 (1일) | 1분 | 1분 | — |
| 차트 (1주~) | 10분 | 10분 | — |
| 한투 OAuth 토큰 | — | — | 만료 5분 전 갱신 |
