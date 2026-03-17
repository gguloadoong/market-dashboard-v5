# 마켓대시보드 UI/UX 디자인 개선 방향서

> 작성 기준: 코드 분석 기반 (HomeDashboard.jsx, BreakingNewsPanel.jsx, Header.jsx, MarketSummaryCards.jsx)
> 대상: 30-40대 국내외 주식·코인 동시 투자자
> 디자인 기조: 토스증권 수준의 모바일 퍼스트, 정보 밀도 높되 인지 부하 최소화

---

## 1. 서비스 로고 / 네이밍 방향

### 1-1. 현재 상태

Header.jsx 24번 줄: 서비스명이 `마켓대시보드`로 하드코딩됨.
로고 아이콘 없음. 폰트 크기 20px, 볼드, 색상 `#191F28`.

### 1-2. 서비스명 후보

| 후보명 | 컨셉 | 어감 |
|---|---|---|
| **마켓레이더** | 전방위 시장 스캔 | 기술적, 전문적 |
| **시세판** | 직관적 한국어 | 친근함, 도메인 기억 쉬움 |
| **마켓나우** | 실시간 강조 | 심플, 영문 혼용 자연스러움 |
| **풀시그널** | 시장 신호 전달 | 트레이더 지향 |
| **마켓펄스** | 심장박동 = 실시간 | 영어권에도 통함 |

**추천: 마켓레이더 (MarketRadar)**
- 이유: 국장·미장·코인을 동시에 "스캔"한다는 핵심 가치를 직관적으로 전달
- 로고 심볼: `🔭` (레이더/망원경) — 적 목표 추적, 기회 발견의 메타포
- 대안 심볼: `⚡` (빠른 실시간 정보) 또는 `📡` (신호 수신)

### 1-3. 컬러 팔레트

```
기본 배경:     #FFFFFF  (흰색)
서브 배경:     #F8F9FA  (연회색)
카드 배경:     #FFFFFF  (흰색, border 1px #E5E8EB)
주 텍스트:     #191F28  (현재 유지)
보조 텍스트:   #6B7684  (현재 유지)
힌트 텍스트:   #8B95A1  (현재 유지)

상승 빨강:     #F04452  (현재 유지 — 토스 표준)
하락 파랑:     #1764ED  (현재 유지 — 토스 표준)
긍정 초록:     #2AC769  (현재 유지)
코인 주황:     #FF9500  (현재 유지)

브랜드 포인트: #3182F6  (미장 계열 파랑 — 로고 강조색으로 활용 가능)
```

### 1-4. 로고 구현 스펙

```
컨테이너: width 32px, height 32px, border-radius 8px
배경:     linear-gradient(135deg, #3182F6 0%, #1764ED 100%)
아이콘:   🔭 또는 SVG 레이더 웨이브 (흰색, 18px)
서비스명: font-size 18px, font-weight 800, color #191F28
로고-텍스트 gap: 8px
전체 높이: 헤더 내 56px 컨테이너에 맞춰 수직 중앙 정렬
```

---

## 2. 홈 레이아웃 정보 위계 개선

### 2-1. 현재 구조 분석

```
현재 순서 (HomeDashboard.jsx):
[헤더] 날짜 + 실시간 표시
[BLOCK 1] 급등 TOP10 / 급락 TOP10
[BLOCK 2] 핫한 종목 인사이트 (뉴스 매칭)
[BLOCK 3] 시장 지수 (KOSPI, NDX 등) ← 중요한데 묻힘
[BLOCK 4] 공포탐욕 + BTC도미넌스 + 김치프리미엄 ← 코인 비관심 사용자에게 노이즈
```

**핵심 문제:**
- 시장 지수가 급등락 아래에 위치 — "오늘 장이 어떤지"를 알기 전에 "무엇이 올랐는지"를 보게 됨
- 공포탐욕·BTC도미넌스·김치프리미엄은 코인 관심 사용자 전용 데이터인데 홈 하단에 상시 노출
- 인사이트 섹션이 무버 리스트와 시각적으로 구분이 약함

### 2-2. 개선된 정보 위계 (권장 순서)

```
[ZONE 0] 헤더: 로고 | 탭 | 장 상태 | 환율                    ← 56px 고정
───────────────────────────────────────────────────────────
[ZONE 1] 시장 맥락 바 (신규)                                  ← 48px
  - KOSPI / KOSDAQ / S&P500 / NASDAQ — 숫자+등락률 한 줄
  - 장 상태 도트 (국장 개장/마감/프리마켓) 인라인 표시
  - "오늘 어떤 장인지"를 5초에 파악

[ZONE 2] 급등·급락 TOP 10                                     ← 메인 콘텐츠
  - 좌: 급등 / 우: 급락 (현재 구조 유지)
  - 개선: 탭 필터 추가 (전체 | KR | US | COIN)

[ZONE 3] 핫한 종목 인사이트                                   ← 현재 BLOCK 2 위치
  - 뉴스 매칭 있는 경우만 노출 (현재 로직 유지)

[ZONE 4] 코인 요약 (코인탭 미리보기, 접을 수 있음)           ← 현재 BLOCK 4 대체
  - 공포탐욕 + BTC도미넌스 + 김치프리미엄
  - "코인 더보기 →" 클릭 시 코인 탭으로 이동
  - 기본 상태: 접힘(collapsed), 코인 탭 방문 후 펼침 유지
```

### 2-3. ZONE 1 시장 맥락 바 스펙 (신규 컴포넌트)

```
컨테이너: width 100%, height 48px, background #F8F9FA, border-bottom 1px #E5E8EB
내부 패딩: horizontal 16px

지수 칩 (가로 스크롤):
  - 칩 크기: 자동 너비, height 32px, border-radius 8px
  - 칩 배경: 상승 시 #FFF0F0, 하락 시 #EDF4FF, 보합 #F2F4F6
  - 지수명: font-size 11px, color #8B95A1, font-weight 600
  - 등락률: font-size 13px, font-weight 700, tabular-nums
  - 칩 간격 gap: 6px

표시 지수 우선순위:
  1. KOSPI  🇰🇷  (국장 사용자 최우선)
  2. KOSDAQ 🇰🇷
  3. S&P500 🇺🇸
  4. NASDAQ 🇺🇸
  5. (나머지는 스크롤)

모바일(< 640px): 가로 스크롤, snap scrolling 권장
```

### 2-4. 급등락 섹션 탭 필터 스펙

```
위치: "급등 TOP 10" 헤더 오른쪽
버튼 그룹: [전체] [KR] [US] [COIN]
  - 버튼 크기: 24px height, 수평 패딩 8px
  - 활성 배경: #191F28, 텍스트 흰색
  - 비활성: #F2F4F6 배경, #6B7684 텍스트
  - 폰트: 10px, font-weight 600
  - 보더 반경: 6px
  - 필터는 급등·급락 양쪽에 동시 적용
```

---

## 3. 고래 알림 UX 패턴

### 3-1. 현재 구조 분석

```
BreakingNewsPanel.jsx:
- TABS 배열: 전체 | 국내 | 미장 | 코인 | 🐋 고래
- latestWhale 핀: 고래 탭 아닌 경우 상단에 노란 배너로 1건 표시 (134번 줄)
- 문제: 배너를 보지 않거나 탭을 누르지 않으면 놓침
- 현재 배너 색상: #FFFBF0 (노란 계열) — 심각도 구분 없음
```

### 3-2. 토스트 알림 스펙 (권장)

고래 이벤트는 "놓치면 안 되는 신호"이므로 패널 안에 가두지 말고
화면 레이어 위에 토스트로 노출해야 함.

```
[토스트 컨테이너]
  위치: position fixed, bottom 24px, right 24px (데스크탑)
        position fixed, bottom 80px, left 50%, transform translateX(-50%) (모바일)
  z-index: 9999
  최대 너비: 360px (데스크탑), calc(100vw - 32px) (모바일)

[토스트 카드]
  border-radius: 14px
  padding: 14px 16px
  box-shadow: 0 8px 24px rgba(0,0,0,0.12)
  배경:
    - HIGH severity: #191F28 (다크, 긴급감)
    - MEDIUM severity: #FFFFFF (흰색, 평상시)
  border-left: 4px solid
    - HIGH: #F04452
    - MEDIUM: #3182F6

[아이콘 영역]
  - HIGH: 🔥 (16px) + "고래 감지" 텍스트 10px, color #F04452
  - MEDIUM: 🐋 (16px) + "고래 거래" 텍스트 10px, color #3182F6

[본문]
  - 종목 심볼: font-size 15px, font-weight 700
    HIGH: color #FFFFFF / MEDIUM: color #191F28
  - 매수/매도: font-size 13px
    매수(BUY): color #F04452 / 매도(SELL): color #1764ED
  - 거래 금액: font-size 13px, font-weight 600, font-mono
  - 시각: font-size 11px, color #8B95A1

[닫기 버튼]
  position: absolute, top 10px, right 10px
  size: 18px × 18px
  color: #8B95A1

[애니메이션]
  등장: translateY(20px) → translateY(0) + opacity 0→1, duration 200ms, ease-out
  퇴장: translateY(0) → translateY(20px) + opacity 1→0, duration 150ms, ease-in
  자동 소멸: HIGH 8초, MEDIUM 5초
  쌓임: 최대 3개, 초과 시 가장 오래된 것부터 제거

[진행 바]
  컨테이너 하단 4px height
  배경: rgba(255,255,255,0.2)
  채워짐 → 비워짐 (남은 시간 시각화)
  color: HIGH #F04452, MEDIUM #3182F6
```

### 3-3. 뉴스 패널 상단 "고래 레이더" 미니 위젯 스펙

토스트와 병행 사용 시 (뉴스 패널이 항상 열려 있는 데스크탑 기준):

```
[위치]
  BreakingNewsPanel 탭 헤더와 갱신 상태 바 사이
  (현재 latestWhale 핀 영역 개선판)

[컨테이너]
  height: auto (최소 40px)
  background: HIGH → #FFF0F0, MEDIUM → #FFFBF0
  border-bottom: 1px solid HIGH → #FFD0D4, MEDIUM → #FFE5A0
  padding: 10px 16px
  cursor: pointer (고래 탭 이동)

[레이아웃]
  좌: 아이콘 (🔥 or 🐋, 14px) + severity 뱃지
  중: 종목 + 방향 + 금액 (한 줄)
  우: 시각 + "자세히 →" 링크 (10px, #B0B8C1)

[severity 뱃지]
  HIGH: background #FFF0F1, color #F04452, text "🔥 HIGH", font-size 9px, font-weight 700
  MEDIUM: background #FFFBF0, color #CC8800, text "알림", font-size 9px

[다중 이벤트 표시]
  최근 2건까지 스택 표시
  두 번째 이벤트는 opacity 0.6, font-size 11px로 아래에 표시
  3건 이상이면 "+N건 더" 텍스트
```

---

## 4. 뉴스 카드 UX 개선

### 4-1. 현재 구조 분석

```
NewsItem 컴포넌트 (BreakingNewsPanel.jsx 21번 줄):
  - 1행: [속보뱃지?] [카테고리뱃지] [출처] [시각]
  - 2행: 뉴스 제목 (2줄 clamp)
  - 폰트: 13px, font-weight 500, color #191F28

InsightRow 컴포넌트 (HomeDashboard.jsx 264번 줄):
  - 1행: 종목명 + 등락률 + 마켓뱃지 + 시각
  - 2행: 뉴스 제목 (2줄 clamp)
  - 폰트: 12px, color #4E5968
```

**현재 문제:**
- 투자 시그널(강세/약세/금리/유가)이 텍스트에 묻혀 시각적으로 없음
- 속보 외에 뉴스 중요도 구분이 없음
- 제목만 있고 핵심 정보 요약(리드 문장) 없음

### 4-2. 투자 시그널 태그 체계

```
태그 종류와 색상:
┌─────────┬────────────┬────────┬──────────────────────────────────────┐
│ 태그명  │ 배경       │ 텍스트  │ 트리거 키워드                         │
├─────────┼────────────┼────────┼──────────────────────────────────────┤
│ 🟢 강세 │ #F0FFF6    │ #2AC769 │ 급등, 상승, 최고가, 호실적, 어닝비트 │
│ 🔴 약세 │ #FFF0F1    │ #F04452 │ 급락, 하락, 손실, 적자, 어닝미스     │
│ 💰 금리 │ #EDF4FF    │ #3182F6 │ 금리, 기준금리, FOMC, 연준, Fed     │
│ 🛢 유가 │ #FFF4E6    │ #FF9500 │ 유가, 원유, WTI, OPEC, 오일         │
│ 💵 달러 │ #F0FFF6    │ #00A896 │ 달러, DXY, 환율, 원/달러            │
│ 📊 실적 │ #F5F0FF    │ #8B5CF6 │ 실적, EPS, 매출, 영업이익           │
│ 🏦 정책 │ #F2F4F6    │ #6B7684 │ 정책, 규제, 법안, 제재              │
└─────────┴────────────┴────────┴──────────────────────────────────────┘

태그 스펙:
  height: 18px
  padding: 2px 6px
  border-radius: 4px
  font-size: 10px
  font-weight: 700
  이모지 크기: 10px (앞에 붙이기)
  태그 간격 gap: 4px
  한 카드당 최대 2개 태그
```

### 4-3. 개선된 뉴스 카드 레이아웃

```
[뉴스 카드 컨테이너]
  padding: 12px 16px
  border-bottom: 1px solid #F2F4F6
  hover background: #FAFBFC
  cursor: pointer

[1행: 메타 정보]
  높이: 18px
  좌측: [카테고리뱃지 KR/US/COIN] [속보뱃지, 있는 경우]
  우측: [출처 11px #B0B8C1] [시각 11px #B0B8C1]
  gap: 6px

[2행: 투자 시그널 태그] ← 신규 추가
  margin-top: 6px
  높이: 18px
  태그 최대 2개 좌측 정렬
  태그 없으면 이 행 생략 (height 0)

[3행: 뉴스 제목]
  margin-top: 5px
  font-size: 13px
  font-weight: 500
  color: #191F28
  line-height: 1.4
  line-clamp: 2
  (단 속보는 font-weight 600으로 강조)

전체 카드 높이:
  태그 없음: 약 68px
  태그 있음: 약 86px
```

### 4-4. InsightRow 개선 (HomeDashboard)

```
현재: 종목+등락률 / 뉴스 제목 2줄 구조
개선: 종목+등락률 / [시그널 태그] / 뉴스 제목 1줄

- 뉴스 제목 line-clamp를 2→1로 줄이되 태그로 맥락 보완
- 종목 등락률 뱃지 크기: font-size 12px (현재 11px에서 키움)
- 종목명과 뉴스 제목 사이에 시각적 구분선 불필요 — 태그가 구분 역할 담당
```

---

## 5. 국장 투자자 동향 UI

### 5-1. 표시 방식 비교

| 방식 | 장점 | 단점 | 적합 상황 |
|---|---|---|---|
| 숫자 텍스트 | 정확한 값 전달 | 단위 파악 필요, 스캔 어려움 | 전문가 뷰 |
| 방향 화살표 | 즉각적 방향 파악 | 크기 비교 불가 | 모바일 요약 |
| 바 차트 | 크기 비교 직관적 | 좁은 공간에서 읽기 어려움 | 태블릿 이상 |
| **수평 게이지 (권장)** | 방향+비율 동시 전달 | — | 모바일 최적 |

**권장: 수평 중앙 기준 양방향 게이지 + 숫자 조합**

### 5-2. 투자자 동향 컴포넌트 스펙 (InvestorFlow)

```
[컴포넌트 컨테이너]
  background: #FFFFFF
  border-radius: 16px
  padding: 16px
  border: 1px solid #F2F4F6
  box-shadow: 0 1px 4px rgba(0,0,0,0.04)

[헤더]
  좌: "투자자 동향" font-size 14px font-weight 700 color #191F28
  우: 날짜 or "코스피 기준" font-size 11px color #8B95A1

[KOSPI 미니 라인 차트] ← 선택적 (데이터 있을 때)
  height: 40px
  width: 100%
  색상: 당일 등락에 따라 #F04452 or #1764ED
  no axis, no label (순수 방향 표시용)
  margin-bottom: 12px

[투자자 행 — 개인 / 외국인 / 기관]
  각 행 height: 36px
  padding: 4px 0

  행 구성:
  [투자자명 44px] [게이지 flex-1] [금액 텍스트 64px]

  투자자명:
    font-size: 12px, font-weight 600, color #191F28
    "개인" / "외국인" / "기관"

  게이지 (양방향 수평 바):
    전체 높이: 6px
    중앙 기준선: 1px solid #E5E8EB
    좌(매도) 색상: #1764ED (파랑)
    우(매수) 색상: #F04452 (빨강)
    최대 길이: 각 방향 50% (상대 비율)
    border-radius: 3px
    애니메이션: width 0 → 최종값, duration 500ms, ease-out

  금액 텍스트:
    font-size: 12px, font-weight 700, font-mono, tabular-nums
    순매수: color #F04452, 값 앞에 "▲" 표시
    순매도: color #1764ED, 값 앞에 "▼" 표시
    단위: 억(1억 이상) / 천만(1억 미만)
    우측 정렬

[행 간격 gap]: 8px

[총 순매수 합산 행] ← 선택적
  border-top: 1px solid #F2F4F6
  margin-top: 8px, padding-top: 8px
  font-size: 11px, color #8B95A1
  "순매수 합계: 외국인 +△△△억"
```

### 5-3. 모바일 최적화 스펙

```
모바일(< 640px) 단순화 버전:
  게이지 대신 방향 아이콘 + 숫자만 표시

  [개인] ▲ +1,234억  (font-size 13px, color #F04452)
  [외국인] ▼ -567억   (font-size 13px, color #1764ED)
  [기관] ▲ +89억      (font-size 13px, color #F04452)

  3개 항목을 grid grid-cols-3 gap-2로 배치
  각 셀: border 1px #F2F4F6, border-radius 10px, padding 10px 8px
  텍스트 가운데 정렬
```

### 5-4. 위치 권장

```
홈 탭: ZONE 2(급등락) 와 ZONE 3(인사이트) 사이에 삽입
국내탭: 섹터 차트 아래, 개별 종목 리스트 위
데이터 없거나 장 마감 후: "전일 동향" 레이블로 표시, 전체 opacity 0.7
```

---

## 6. 헤더 개선 방향

### 6-1. 현재 문제

- 서비스명 "마켓대시보드"가 브랜드 아이덴티티 없이 텍스트만 존재
- 모바일에서 로고 영역과 탭이 함께 있어 너비 초과 시 탭이 숨겨질 수 있음
- 탭 레이블 "🔥 지금 핫한 것"이 길어 좁은 화면에서 잘림

### 6-2. 헤더 개선 스펙

```
[로고 영역]
  아이콘: 32×32px, border-radius 8px, gradient background
  서비스명: 텍스트 18px (현재 20px에서 소폭 축소)
  로고-서비스명 gap: 8px

[탭 레이블 단축안]
  현재 → 개선
  "🔥 지금 핫한 것" → "🔥 홈" or "📡 레이더"
  "🇰🇷 국내"        → 유지
  "🇺🇸 해외"        → 유지
  "🪙 코인"         → 유지
  "📊 ETF"          → 유지

  이유: 탭이 5개이므로 각 레이블 최대 6자 이내 권장
  모바일(< 480px): 이모지만 표시, 텍스트 숨김

[활성 탭 하이라이트]
  현재: background #191F28, 텍스트 흰색 (pill형)
  개선안: 하단 2px border (underline 스타일) + 텍스트 색상 변경만
    활성: color #191F28, font-weight 700, border-bottom 2px solid #191F28
    비활성: color #6B7684
  이유: 토스증권, 카카오페이 등 주요 앱의 탭 스타일과 일치, 인지 부하 감소

[모바일 헤더 분리]
  높이 56px 유지
  좌: 로고 (아이콘+서비스명)
  우: 새로고침 버튼 + 알림 아이콘 (고래 알림 개수 뱃지)
  탭은 헤더 아래 별도 행(44px)으로 분리 — 안드로이드 앱 패턴
```

---

## 7. 전체 공통 개선 원칙

### 7-1. 폰트 사이즈 일관성 정리

```
현재 코드에서 발견된 폰트 크기 (픽셀):
9, 10, 11, 12, 13, 14, 15, 18, 20px — 너무 많은 단계

권장 폰트 스케일 (4단계):
  - 본문:    14px (font-weight 400/500)
  - 레이블:  12px (font-weight 600)
  - 캡션:    11px (font-weight 400/500)
  - 뱃지:    10px (font-weight 700)
  - 숫자:    font-mono, tabular-nums 유지
  - 타이틀:  18-20px (섹션 제목 등)

9px는 가독성 경계 미만 — 제거 권장
```

### 7-2. 카드 그림자/배경 일관성

```
현재: shadow-sm, border border-[#F2F4F6] 혼용 + 일부 배경색 변수 (#FFFAFA, #F4F8FF)

통일 스펙:
  일반 카드: background #FFFFFF, border 1px solid #E5E8EB, border-radius 16px
  강조 카드: background #FFFFFF, box-shadow 0 2px 8px rgba(0,0,0,0.06), border-radius 16px
  급등 영역 배경: #FFFAF9 (현재 #FFFAFA와 유사, 통일)
  급락 영역 배경: #F5F8FF (현재 #F4F8FF와 유사, 통일)
```

### 7-3. 접근성 최소 요건

```
- 상승(빨강)/하락(파랑)은 색맹 사용자를 위해 반드시 ▲/▼ 화살표와 함께 사용 (현재 구현됨, 유지)
- 호버 전용 연관 종목 표시 → 모바일 대응 필요 (탭으로도 전환 가능하게)
- 아이콘 전용 버튼은 aria-label 필수
- 터치 타겟 최소 44×44px 확보 (현재 py-2.5 = 10px → 버튼 높이 약 34px, 개선 필요)
```

---

## 8. 구현 우선순위 (Impact vs Effort)

| 순위 | 개선 항목 | 임팩트 | 난이도 |
|:---:|---|:---:|:---:|
| 1 | ZONE 1 시장 맥락 바 추가 | 높음 | 낮음 |
| 2 | 고래 토스트 알림 | 높음 | 중간 |
| 3 | 급등락 탭 필터 (전체/KR/US/COIN) | 높음 | 낮음 |
| 4 | 뉴스 투자 시그널 태그 | 중간 | 중간 |
| 5 | 코인 요약 카드 접기/펼치기 | 중간 | 낮음 |
| 6 | 투자자 동향 컴포넌트 | 높음 | 높음 |
| 7 | 로고/브랜딩 업데이트 | 낮음 | 낮음 |
| 8 | 헤더 탭 underline 스타일 전환 | 낮음 | 낮음 |
| 9 | 폰트 스케일 정리 | 낮음 | 중간 |

---

*이 문서는 코드 분석 기반 UI/UX 개선 방향서이며, 실제 구현 전 디자인 목업 검토를 권장함.*
