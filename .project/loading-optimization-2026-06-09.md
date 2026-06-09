---
제목: 서비스 로딩 최적화 — 종합 감사 + 우선순위 플랜
날짜: 2026-06-09
소유자: (대표 /goal) 서비스 최적화 — 지연없이/이전데이터 신뢰훼손 없게/바로 노출/실서비스급
출처: workflow loading-optimization-audit (7 agents) + 적대적 critique(REVISE)
---

# 로딩 최적화 플랜 (실측 + workflow 감사 기반)

## 실측 진단 (프로덕션 콜드 로드)
- 셸/번들 빠름: TTFB 30ms, DCL 317ms, JS 48~98ms. **문제는 100% 데이터레이어.**
- 로드 시 API 97~123콜, 그중 **/api/d 123콜**(POST, 미캐시), 최대 8129ms.
- **진짜 임계경로 = `/api/snapshot?tier=hot` GET 1콜**(CDN s-maxage=60, KR845·US2700·coins). 나머지는 전부 지연가능.
- **최대 주범**: `usePrices.js:286-287`이 mount 즉시 `refreshUsStocks()+refreshKoreanStocks()` 발사 → us-price가 서버에서 **250종목 per-symbol Yahoo v8 fan-out**(8초 지연·1~3s 24콜 정체) — hot 스냅샷이 이미 시드한 **중복**.

## 우선순위 단계 (impact×effort)
- **Phase 1 [최대효과·최소위험]** mount 즉시 폴링 burst 제거: usePrices 즉시 refresh 2줄 삭제(폴링은 60s 후 첫 발사) + useCoins onVisible WS가드 + ETF/sparkline 즉시발사 정리 + 뉴스 idle 게이팅 + no-op 훅 제거. → burst 97~123 → ~30콜.
- **Phase 2** 비임계 보조 afterPaint 게이팅: FearGreed(3쿼리)/KrxEtf/ServerSignals(home만)/WS approval. → burst <15.
- **Phase 3** 스냅샷 `asOf`(데이터 생성시각) + freshness UX: 'N초 전 업데이트'·'○○시 기준/확정종가' 칩. **'이전 데이터 신뢰훼손' 근본 해결**(토스/네이버급).
- **Phase 4** 캐시가능 비민감 타입 GET+CDN 분리(지수/F&G/KRX/공지). 재방문 네트워크 0.
- **Phase 5** 뉴스 17 RSS → /api/news-bundle GET 1콜(CDN). (L — edge DOMParser 부재 주의)
- **Phase 6** keep-warm cron + WS/REST 역할분리 + fallback 단축 (런칭 직전).

## ⚠️ 적대적 critique must_fix (구현 시 반드시 반영)
1. **F&G = 3쿼리** (crypto=alternative.me 직접, us=/api/d t=f, kr=t=fk). 카운트·게이팅 3개 기준.
2. **`stockItems` useMemo(home/index.jsx:66-69) 보존 필수** — useInvestorSignals(line 113, **라이브** not no-op)가 의존. watchlistSymbols(line116) + no-op 훅(useDerivativeSignals 117/useNewsSignals 120) 호출·import만 제거. ⚠️ useDerivativeSignals.js는 알고리즘 파일 → npm run architect 경유.
3. **useServerSignals는 2곳**: home/index.jsx:123 + DataHealthBadge.jsx:6(전탭 렌더). **home 인스턴스만 게이팅**, DataHealthBadge는 즉시 유지.
4. **Phase4 GET**: d.js:120-122가 POST-only 405 가드 → **method 분기로 변경**(GET 화이트리스트/POST 나머지/405). serverless 타입(fk/ke)은 Cache-Control strip되므로 passthrough 1줄 필요(Edge 타입 i/f는 이미 보존).
5. **Phase3 상대시간 격리**: `<RelativeTime asOf={ts}/>` 자체 setInterval 소유 + 상위로 state 비전파(종목 리스트 리렌더 방지).

## ⚠️ critique risks/missed (반영)
- **useIndices 지연 불가**: 스냅샷에 지수 없음(kr/us/coins만) → 지연 시 헤더 지수바 빈칸. Phase2에서 useIndices 제외(또는 Phase4 캐시로 가속).
- **ETF 폴링**(App.jsx:169 refreshEtfs 즉시+120s), **CoinGecko sparkline**(useCoins.js:168 캐시시 즉시) — burst 기여, Phase1에 포함.
- **dual snapshot**(hot+full, inflight dedup으로 2콜) — dedup 검증.
- **Edge 콜드스타트**: Phase1 <1s 타겟은 Phase6 keep-warm 없이는 콜드 시 미달 가능 — 의존성 명시.
- **번들 코드스플릿 부재**(React.lazy by tab) — 셸 320ms라 현 병목 아니나 미래 레버.
- **오프라인/SW 전략 부재** — 토스/네이버는 오프라인 동작.

## 측정 타겟
- 콜드로드 burst(페인트 후 2s 윈도우 /api/d): 97~123 → **<15**
- 첫 시세 페인트(hot snapshot p95): 최대 8129ms → **<1000ms**
- mount 동일 tick 발사: 14콜 → 1콜(hot snapshot만)
- 재방문/다중탭 캐시가능 타입: CDN HIT(현 0%) → origin 왕복 0
- 뉴스: t=r POST 17 → news-bundle GET 1 + 재방문 HIT
- freshness: 장외 asOf 노출 + 'N초 전/확정종가' 칩

검증: Playwright browser_network_requests로 mount~FMP+2s /api/d 카운트 전후 비교(브라우저 종료 필수).
