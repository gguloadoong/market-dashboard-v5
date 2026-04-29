# 홈 대시보드 레이아웃 계약

> **이 파일이 홈의 단일 진실 소스(Single Source of Truth)다.**
> 홈 컴포넌트를 추가/삭제/변경하기 전에 이 파일을 먼저 읽고, 변경 후 이 파일을 반드시 업데이트하라.

---

## 현재 활성 렌더 구조 (2026-04-07 기준 — Phase 4+5+6 개편)

> **핵심 원칙**: 시그널 중심. "데이터 대시보드"가 아니라 "시그널 인텔리전스".
> **언어 원칙**: 전문용어 배제, 쉽고 위트있는 우리만의 언어.

### 홈 대시보드 (`src/components/home/index.jsx`)

```
1. CommandCenterWidget     — 커맨드 센터 (온도바+지수+히어로시그널+관심종목+이벤트 통합)
   ├── TemperatureBar      — 시장 온도 인라인 바 + 공포탐욕 점수 + 지수 미니카드
   ├── HeroSignalCard      — 최강 시그널 TOP3 카드 (md:grid-cols-[1fr_260px])
   ├── WatchlistMini       — 관심종목 (마켓 배지 KR/US/COIN + 추가 버튼 + 검색 링크)
   │   └── WatchlistAlertStrip — 이상 신호 스트립 (±3% 변동/시그널 발화 시만 표시, inline)
   └── EventStrip          — EventTicker 세로 롤링 (translateY, 3아이템, 9초 순환)
2. NotableMoversSection    — 주목할 종목 (WHY 카드)
3. SignalBoardWidget       — 시그널 보드 (카운터 큰 숫자 + 텍스트 색상 구분) — 인라인 결정 패널(SignalInlinePanel) 포함
4. AiDebateSection         — AI 종목토론 (별도 섹션, 4종목 칩 선택)
5. ExploreTabsWidget       — 탐색 탭 (급등/급락 | 섹터)
   ├── TopMoversWidget     — 급등/급락 탭 (KR/US/COIN 서브탭)
   └── SectorMiniContent   — 섹터 탭 (HOT/COLD pill 칩 + drill-down)
6. NewsFeedWidget          — 투자 뉴스 (lg:hidden — 모바일 전용, 데스크톱은 우측 패널)
```

### 우측 패널 (`src/App.jsx` — 데스크톱 전용)

```
UnifiedFeedPanel           — 통합 실시간 피드 (BreakingNewsPanel 교체)
├── FeedHeader             — "실시간" + LIVE dot
├── 시그널 피드             — 시그널 timestamp 기준 정렬 (최대 5건, 빨강 태그)
├── 뉴스 탭 헤더            — 속보/국내/해외/코인
└── 뉴스 목록               — 파랑 태그, 클러스터링 적용
```

### 모바일 뉴스 탭 (`activeTab === 'news'`)

```
BreakingNewsPanel          — 기존 뉴스 패널 (모바일 전용, lg:hidden)
```

### 커맨드 센터 개편으로 홈에서 비표시인 컴포넌트

| 컴포넌트 | 비표시 이유 |
|---------|---------|
| MarketPulseWidget (독립) | CommandCenterWidget의 TemperatureBar에 통합됨 |
| MarketSentimentWidget (독립) | CommandCenterWidget의 TemperatureBar에 통합됨 |
| WatchlistWidget (독립) | CommandCenterWidget의 WatchlistMini에 통합됨 |
| EventTicker (독립) | CommandCenterWidget의 EventStrip에 래핑됨 |
| MorningBriefing | "5분 안에 파악" 목표와 충돌 — 시그널 푸시로 전환 예정 |
| FearGreedWidget (독립) | CommandCenterWidget에 인라인 통합됨 |
| MarketTemperatureWidget (독립) | CommandCenterWidget에 통합됨 |
| DerivativesWidget | 전문 트레이더 전용. 고급 설정 토글로 이동 예정 |
| MarketTimeline | EventTicker 롤링으로 충분 |
| MarketInvestorSection | SeoulForceSection과 데이터 중복 (외국인/기관 수급) |
| SectorMiniWidget (독립) | ExploreTabsWidget의 SectorMiniContent로 통합됨 |
| SignalSummaryWidget (독립) | SignalBoardWidget에 통합됨 |
| SeoulForceSection (인라인) | SignalBoardWidget에 통합됨 |

---

## 영구 삭제된 컴포넌트 (절대 재추가 금지)

| 컴포넌트 | 삭제 이유 | 삭제 커밋 |
|---------|---------|---------|
| `EarlySignalSection` | 실데이터 기준 신호 품질 미달, 오탐 多 | #172 (2026-03-26) |
| `EventCalendar` (섹션) | EventTicker 롤링으로 대체. 섹션 형태는 홈 9개 섹션 과부하 | #153 (2026-03-25) |
| `DexHotSection` | DEX 데이터 소스 불안정, 실사용 없음 | #180 (2026-03-26) |
| `InsightsSection` | TopMoversWidget + NewsFeedWidget으로 기능 통합 | #180 (2026-03-26) |
| `SurgeSection` | TopMoversWidget으로 통합 | #180 (2026-03-26) |
| `CoinListingSection` | 거래소 상장 공지 섹션 — 사용자 요청으로 제거 | #213 (2026-03-29) |
| `SignalFeed` | SignalSummaryWidget과 완전 중복 — 동일 데이터 소스, 시간순/강도순 차이만 있으나 UX 혼란 유발 | #8 (2026-04-01) |

> ⚠️ 위 목록의 파일이 `src/` 어딘가에 남아있으면 즉시 삭제하라. 파일 존재 = 살아있는 기능으로 오인.

---

## 파일별 역할

### 위젯 (src/components/home/widgets/)

| 파일 | 역할 | 핵심 데이터 |
|------|------|-----------|
| `CommandCenterWidget.jsx` | 커맨드 센터 통합 (지수+온도+시그널+관심종목+이벤트) | `indices`, `krwRate`, `allItems`, `watchedItems`, `popularItems` |
| `MarketPulseWidget.jsx` | 지수 + 환율 컴팩트 뷰 (CommandCenter에 통합) | `indices`, `krwRate` |
| `WatchlistWidget.jsx` | 관심종목 실시간 리스트 | `krStocks`, `usStocks`, `coins` |
| `TopMoversWidget.jsx` | 급등/급락 랭킹 (HotListSection 래퍼) | `krStocks`, `usStocks`, `coins` |
| `NewsFeedWidget.jsx` | 필터된 투자 뉴스 | `useAllNewsQuery` |
| `FearGreedWidget.jsx` | CNN Fear & Greed 지수 | 외부 API |
| `SignalSummaryWidget.jsx` | (비활성) 투자 시그널 — SignalBoardWidget에 통합됨 | `useTopSignals` |
| `SignalBoardWidget.jsx` | 시그널 보드 (카운터 + 세력 포착 + 시그널 리스트 통합) — 인라인 결정 패널 호스트 | `useTopSignals` |
| `SignalInlinePanel.jsx` | 시그널 인라인 결정 패널 (카드 펼침: 트리거/컨텍스트/뉴스/Sparkline/액션) | `signal`, `narrative`, `relatedNews`, `matchedItem` |
| `MarketSentimentWidget.jsx` | 통합 시장 심리 (온도계 + 공포탐욕) | `useSignals`, `useFearGreed`, `allItems` |
| `MarketTemperatureWidget.jsx` | (비활성) 마켓 온도계 단독 — MarketSentimentWidget에 통합됨 | `useSignals` |
| `DerivativesWidget.jsx` | 파생 시그널 | 파생/소셜 데이터 |

### 우측 패널 (src/components/)

| 파일 | 역할 | 핵심 데이터 |
|------|------|-----------|
| `UnifiedFeedPanel.jsx` | 데스크톱 우측 통합 피드 (시그널+뉴스) | `useSignals`, `useNewsAutoRefetch` |
| `BreakingNewsPanel.jsx` | 모바일 뉴스 탭 전용 (기존 패널) | `useNewsAutoRefetch` |

### 섹션 (src/components/home/)

| 파일 | 역할 | 상태 |
|------|------|------|
| `EventTicker.jsx` | 경제 이벤트 롤링 | ✅ 활성 (롤링만. 섹션 X) |
| `NotableMoversSection.jsx` | 수급 이상 종목 | ✅ 활성 |
| `MarketInvestorSection.jsx` | 외국인/기관 수급 | ✅ 활성 |
| `HotListSection.jsx` | HotList UI (TopMoversWidget의 서브컴포넌트) | ✅ 활성 (직접 렌더 X) |
| `MarketIndexSection.jsx` | 지수 UI (MarketPulseWidget의 서브컴포넌트) | ✅ 활성 (직접 렌더 X) |
| `AiDebateSection.jsx` | AI 종목토론 (4종목 칩 선택, 살 이유 vs 조심할 이유) | ✅ 활성 (독립 섹션) |
| `SeoulForceSection` | (비활성) 세력 포착 — SignalBoardWidget에 통합됨 | ❌ 비활성 |
| `ExploreTabsWidget.jsx` | 탐색 탭 (급등/급락 + AI 토론 + 섹터 통합) | ✅ 활성 |
| `SectorMiniContent.jsx` | 섹터 미니 (HOT/COLD 칩 + drill-down) | ✅ 활성 (ExploreTabsWidget 내부) |
| `SignalBoardWidget.jsx` | 시그널 보드 (카운터 + 세력 포착 + 시그널 리스트) | ✅ 활성 |

---

## 변경 규칙

1. **섹션 추가**: 이 파일에 먼저 추가 → index.jsx 수정
2. **섹션 삭제**: index.jsx에서 제거 → 파일 삭제 → 이 파일의 "영구 삭제" 목록에 추가
3. **삭제된 파일 복원 금지**: 영구 삭제 목록에 있는 컴포넌트는 어떤 이유로도 재추가 금지
4. **새 섹션 기준**: ADR에 결정 기록 후 추가. "일단 추가해보자" 금지.

---

## 자주 묻는 질문

**Q: EarlySignalSection을 다시 넣으면 안 되나?**
A: 안 된다. 실제 데이터로 수동 테스트 결과 오탐률이 너무 높다. 알고리즘이 근본적으로 개선되면 새 이름으로 ADR을 거쳐 추가한다.

**Q: EventCalendar를 섹션으로 다시 추가하면?**
A: 안 된다. EventTicker(롤링)로 대체 완료. 홈 섹션 수가 이미 많다(9개). 섹션 형태로는 절대 재추가 금지.

**Q: SurgeSection을 살려야 할 것 같은데?**
A: TopMoversWidget이 그 기능을 완전히 포함한다. 코드가 보이지 않는다고 삭제된 게 아니다.
