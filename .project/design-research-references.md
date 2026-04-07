---
작성자: 이지원 (Head of Strategy) + document-specialist
작성일: 2026-04-07
목적: 홈 화면 전면 개편을 위한 금융 대시보드 디자인 레퍼런스 + 트렌드 분석 + AI 슬롭 방지 체크리스트
소스: 웹 리서치 기반 (2025~2026 최신 정보)
---

# 마켓레이더 v5 홈 리뉴얼 — 디자인 레퍼런스 종합 리서치

> **서비스 컨텍스트**: "3시장 통합 투자 시그널 인텔리전스" — 국장·미장·코인 실시간 모니터링
> **타겟**: 25~40세 직장인 단타/스윙 트레이더, 아침 지하철에서 장 준비
> **레이아웃 목표**: "커맨드 센터" (시장 온도 + 시그널 + 종목 통합 블록 + 우측 통합 피드)

---

## 1. 금융 대시보드 디자인 레퍼런스 (18개)

---

### 1-1. 토스증권 (Toss Securities)

**홈/대시보드 레이아웃**
- 내 투자 요약 (총자산, 수익률) → 관심종목 → 인기 종목 → 뉴스
- 정보 밀도 낮음, 여백 넉넉한 카드 UI

**색상 시스템**
- 라이트 모드 중심. 수익률 색상이 화면 전체 톤을 결정 (빨강/파랑 앵커 효과)
- 배경 #FFFFFF, 서피스 #F6F6F6 계열의 극도로 절제된 팔레트

**카드/위젯 디자인**
- 대형 카드 + 넉넉한 여백. 한 화면에 2~3개 카드만 노출
- 카드 간 정보 독립적 — 카드 단위로 스캔 가능

**시그널/알림 표현**
- 시그널/인텔리전스 기능 전무
- 단순 급등 알림만 지원, 조건 알림 설정 불가

**모바일 UX 전략**
- 극도의 단순화 — 첫 사용자도 3초 안에 이해
- "주식 모으기" 등 독자 기능으로 습관 형성
- 스크롤 기반 리니어 탐색

**배울 점**: 정보 밀도와 여백의 균형. 첫 화면에서 "내 돈"이 보이는 심리적 안정감.
**차별화**: 3시장 통합, 시그널 인텔리전스, "왜 지금" 맥락 연결.

> 소스: [토스증권 App Store](https://apps.apple.com/kr/app/toss)

---

### 1-2. 카카오페이증권 (KakaoPay Securities)

**홈/대시보드 레이아웃**
- 웹뷰 기반 하이브리드 앱 — 증권 홈, 계좌개설, 투자정보, 주식모으기, 연금저축
- 카카오 디자인 시스템 기반의 일관된 UI

**색상 시스템**
- 카카오 옐로(#FEE500) 브랜드 컬러 + 금융 신뢰감을 위한 짙은 그레이 조합
- 라이트 모드 주력

**카드/위젯 디자인**
- 카카오톡 내 임베디드 UX 고려한 간결한 카드
- 복잡한 금융 정보를 최소 텍스트로 전달

**시그널/알림 표현**
- 2024년 12월부터 AI 시황 정보 베타 서비스 운영
- 미국 지수 마감 현황 + 변동 요인 + 상승/하락 종목을 AI가 매일 아침 자동 분석/요약

**모바일 UX 전략**
- "손안의 블룸버그" 표방 — 2040 세대 자산축적 플랫폼
- 웹뷰 기반이라 네이티브 대비 전환 매끄러움 부족하나 개발 속도 빠름

**배울 점**: AI 시황 요약 — 매일 아침 자동 분석 포맷이 "아침 지하철 장 준비" 타겟과 정확히 일치.
**차별화**: 우리는 실시간 시그널 + 3시장 통합. 카카오페이는 일 1회 정적 요약.

> 소스: [카카오페이증권 UX 브런치](https://brunch.co.kr/@kakaopaysec/15), [카카오페이증권 기술블로그](https://tech.kakaopay.com/tag/ux/)

---

### 1-3. 삼성증권 mPOP

**홈/대시보드 레이아웃**
- 시각적 화면 구성으로 상품 정보를 쉽게 소화할 수 있는 포맷
- 국내/해외 주식 + 금융상품 + 자산관리를 원앱에서 처리
- 커스텀 포트폴리오 디자인 기능

**색상 시스템**
- 삼성 블루 계열 브랜드 컬러 + 전통적 증권사 신뢰 팔레트
- 다크모드 지원

**카드/위젯 디자인**
- 주문 실행에 최적화된 빠른 인터랙션 설계
- 정보 조회 + 주문 실행을 최소 탭으로 연결

**시그널/알림 표현**
- 전통적 시세 알림 (가격 도달)
- 시그널 인텔리전스 없음

**모바일 UX 전략**
- 태블릿 전용 버전(mPOP Tab) 별도 제공 — 화면 크기별 최적화 의지
- 신규 투자자 온보딩 + 전문가 리서치 연결

**배울 점**: 태블릿 별도 최적화. 화면 크기별 정보 밀도 조절의 모범 사례.
**차별화**: 시그널 중심 vs 매매 중심. 우리는 "왜"를 팔고, 삼성은 "어떻게(주문)"를 판다.

> 소스: [삼성증권 mPOP Google Play](https://play.google.com/store/apps/details?id=com.samsungpop.android.mpop)

---

### 1-4. 키움증권 영웅문S#

**홈/대시보드 레이아웃**
- 글로벌 시세판 + 시장 종합 + 강력한 차트 + 관심종목 + 조건검색
- 국내/해외 주식, ETF, ELW, ETN, 금융상품 + AI 자산관리(Qi GO) 통합

**색상 시스템**
- 전통적 증권사 다크 테마 (HTS 계보)
- 고밀도 정보 표시를 위한 작은 폰트 + 고대비 색상

**카드/위젯 디자인**
- HTS 스타일 멀티 패널 — 정보 밀도 최대화
- 차트 + 호가 + 체결 동시 표시

**시그널/알림 표현**
- 조건검색 강력 (HTS급 기능)
- AI 자산관리 "Qi GO" 서비스

**모바일 UX 전략**
- 파워유저 타겟 — 학습 곡선 높음
- 신규 통합 MTS "영웅문S#"으로 리뉴얼 (기존 구버전과 병행)

**배울 점**: 조건검색(스크리너) 기능의 깊이. 파워유저가 원하는 것은 커스터마이징.
**차별화**: 우리는 "큐레이션된 시그널"로 조건검색 없이도 핵심 포착. 진입 장벽 제로.

> 소스: [키움증권 영웅문S# App Store](https://apps.apple.com/us/app/%ED%82%A4%EC%9B%80%EC%A6%9D%EA%B6%8C-%EC%98%81%EC%9B%85%EB%AC%B8s-new/id1570370057)

---

### 1-5. NH투자증권 나무

**홈/대시보드 레이아웃**
- 홈 화면 커스터마이징 가능 — 사용자가 위젯 배치 조절
- HTS 기능을 모바일 환경에 맞춰 단순화

**색상 시스템**
- 그린 계열 브랜드 컬러 (형광 연두 → 사용자 피로도 이슈 보고)
- 색상 접근성 문제 — 형광 연두색이 눈에 피로감을 준다는 사용자 피드백

**카드/위젯 디자인**
- "나무" 컨셉 위젯 — 자산 변화를 나무 형태로 시각화 (실험적)
- iOS 위젯 + Apple Watch 앱 별도 디자인

**시그널/알림 표현**
- 자동 투자 기능 (정기 매수)
- 기본적인 가격 알림

**모바일 UX 전략**
- 직관적 UI — 모바일 투자 초보자도 쉽게 설정
- 위젯/워치 앱으로 앱 밖에서도 자산 확인

**배울 점**: iOS 위젯/워치 확장. 앱 진입 없이 핵심 정보 노출하는 전략.
**차별화**: 우리는 "시그널 인텔리전스" — 나무는 "자동 투자" 중심.
**경고**: 형광/밝은 그린은 눈 피로도 유발 — 우리 색상 시스템에서 절대 피해야 할 안티패턴.

> 소스: [나무증권 App Store](https://apps.apple.com/kr/app/%EB%82%98%EB%AC%B4%EC%A6%9D%EA%B6%8C-nh%ED%88%AC%EC%9E%90%EC%A6%9D%EA%B6%8C-mts/id486312400), [NH위젯 디자인 사례](https://ooooseok.com/work/nhWidgetWatch08)

---

### 1-6. 업비트 (Upbit)

**홈/대시보드 레이아웃**
- 실시간 시세 테이블 중심 (원화/BTC/USDT 마켓 탭)
- 상단: 검색 + 관심종목 / 하단: 투자내역 + 입출금

**색상 시스템**
- 업비트 블루 (#0060FF 계열) 브랜드
- 다크모드 지원. 시세 테이블의 빨강/초록(글로벌 컨벤션) 사용

**카드/위젯 디자인**
- 테이블 기반 고밀도 UI — 카드보다 테이블 선호
- 실시간 깜빡임 피드백 (가격 변동 시 셀 하이라이트)

**시그널/알림 표현**
- 코인 특화: 펀딩비, 김프, 도미넌스
- 시세 변동 알림 (단순)
- 인사이트/시그널 레이어 전무

**모바일 UX 전략**
- WebSocket 기반 실시간성 극대화
- 호가/체결 정보 밀도 높은 트레이더 친화 설계

**배울 점**: 실시간 피드백의 즉각성 — 가격 변동 시 셀 깜빡임/색상 전환이 "살아있는" 느낌.
**차별화**: 주식+코인 통합, 뉴스-시세 맥락 연결, 시그널 해석 레이어.

> 소스: [업비트 Google Play](https://play.google.com/store/apps/details?id=com.dunamu.exchange)

---

### 1-7. 빗썸 (Bithumb)

**홈/대시보드 레이아웃**
- 거래 화면 중심 + 시세 리스트
- 최근 UI/UX 전면 개편 실시 — 28개 부문 개선

**색상 시스템**
- 오렌지 계열 브랜드 컬러
- 다크 테마 거래 화면

**카드/위젯 디자인**
- 전용 서체 "빗썸 트레이딩 산스" 개발 — 숫자 가독성 극대화
- 고정폭 숫자 간격으로 가격 변동 시 레이아웃 안정성 확보
- 자체 그래픽 라이브러리 구축으로 시각적 통일성 확보

**시그널/알림 표현**
- 기본적인 가격 변동 알림
- 인텔리전스 레이어 없음

**모바일 UX 전략**
- 거래 화면 내 원화 입금 가능 — 매매까지 최소 동선
- 차트 UI 별도 개편 (가독성 + 편의성 강화)

**배울 점**: **전용 트레이딩 서체 개발**. 숫자 가독성은 금융 앱의 핵심이며, 고정폭 숫자 간격은 가격 변동 시 UI 떨림을 방지. 우리의 `font-mono + tabular-nums` 전략과 동일 철학.
**차별화**: 우리는 시그널 중심, 빗썸은 매매 중심.

> 소스: [빗썸 UI 개편 - 인사이트코리아](https://www.insightkorea.co.kr/news/articleView.html?idxno=243294), [빗썸 차트 UI 개편 - ZDNet](https://zdnet.co.kr/view/?no=20230925143126)

---

### 1-8. 코인원 (Coinone)

**홈/대시보드 레이아웃**
- 시세 리스트 중심 + 관심종목
- 깔끔한 리스트 기반 UI

**색상 시스템**
- 블루 계열 브랜드 컬러
- 미니멀한 색상 사용

**모바일 UX 전략**
- 앱 안정성 + 간편/안전 서비스 중시
- 업비트 대비 기능은 적지만 UI 정돈도 높음

**배울 점**: 과도한 기능보다 안정성 우선. 적은 기능이라도 완성도 있게.
**차별화**: 코인 전용 vs 우리는 3시장 통합.

> 소스: [코인원 App Store](https://apps.apple.com/kr/app/%EC%BD%94%EC%9D%B8%EC%9B%90/id1326526995)

---

### 1-9. Robinhood

**홈/대시보드 레이아웃**
- 내 포트폴리오 그래프 (전체 자산 라인 차트, 기간 전환) 히어로
- "Today's Movers" 수평 카드 스크롤
- "Snacks" 브랜드 뉴스 피드
- 하단: 인기 종목 리스트

**색상 시스템**
- 포트폴리오 수익률이 배경 전체 색상 결정 (초록 = 수익, 빨강 = 손실)
- 극도로 절제된 모노톤 + 1 악센트 컬러 전략
- 다크모드: #1E2124 계열 다크 그레이

**카드/위젯 디자인**
- "Today's Movers" 수평 카드 캐러셀 — 엄지 스와이프에 최적화
- 카드에 종목명 + 미니차트 + 등락률만 — 극도의 정보 압축

**시그널/알림 표현**
- "Snacks" 뉴스 — 투자 뉴스를 쉬운 언어로 해석 (우리의 easyLabel과 동일 철학)
- 시그널/알고리즘 분석은 없음

**모바일 UX 전략**
- 스와이프 제스처 자연스러움
- 매매까지 3탭 이내
- 감정 디자인 — 수익 시 축하, 첫 매매 시 컨페티 효과

**배울 점**: (1) 포트폴리오 그래프가 감정을 지배하는 히어로 패턴. (2) "Today's Movers" 수평 카드 UX. (3) Snacks식 쉬운 뉴스 해석.
**차별화**: 3시장 통합, AI 시그널, "조심할 이유"까지 양면 제공.

> 소스: [Robinhood App](https://robinhood.com/us/en/about/), [Robinhood Design - Dribbble](https://dribbble.com/tags/robinhood)

---

### 1-10. Webull

**홈/대시보드 레이아웃**
- 모듈식 커스텀 대시보드 — 사용자가 위젯을 자유 배치
- 기본: 워치리스트 + 차트 + 시세 + 뉴스 멀티패널
- 컬러 코딩 그룹으로 데이터 동기화 (차트 ↔ 워치리스트 연동)

**색상 시스템**
- 디폴트 다크 테마 (트레이더 선호)
- 시세: 초록/빨강 (글로벌 컨벤션)
- 깔끔하고 모던한 인터페이스

**카드/위젯 디자인**
- 리사이즈 가능한 모듈 위젯
- 빈 레이아웃에서 시작하여 필요한 위젯만 추가하는 패턴

**시그널/알림 표현**
- 기술 지표 기반 차트 알림
- AI/시그널 인텔리전스 없음

**모바일 UX 전략**
- 데스크톱 급 차트를 모바일에 압축
- 실시간 시세 + 다양한 지표 + 커스텀 레이아웃

**배울 점**: 컬러 코딩 그룹 — 관련 위젯 간 데이터를 동기화하는 패턴이 "커맨드 센터" 콘셉트와 유사.
**차별화**: 우리는 큐레이션된 시그널 (커스텀 불필요). Webull은 파워유저 커스터마이징.

> 소스: [Webull 2026 리뷰 - A1 Trading](https://www.a1trading.com/webull-platform-review/), [Webull Desktop](https://www.webull.com/trading-platforms/desktop-app)

---

### 1-11. TradingView

**홈/대시보드 레이아웃**
- 커스텀 대시보드 (사용자가 위젯 배치)
- 기본: 워치리스트 + 차트 + 뉴스 피드 + 경제 캘린더 + 스크리너
- 하단: 커뮤니티 아이디어 (소셜 트레이딩)

**색상 시스템**
- 라이트/다크 토글 (다크가 디폴트)
- 다크: #131722 배경, #D1D4DC 텍스트
- 차트 색상: 사용자 완전 커스텀

**카드/위젯 디자인**
- 위젯 자유 배치 — 파워유저의 성지
- 차트 기술 분석 도구 업계 최고

**시그널/알림 표현**
- 가격/지표 조건 알림 (매우 상세 설정 가능)
- 소셜 아이디어 — 트레이더 의견 공유

**모바일 UX 전략**
- 데스크톱 대비 모바일 경험 크게 열악
- 초보자 진입 장벽 극히 높음

**배울 점**: 스크리너 개념의 강력함. 위젯 단위 사고. 다크모드 #131722 배경은 업계 표준.
**차별화**: 모바일-퍼스트, 큐레이션된 시그널, 한국 시장 특화.

> 소스: [TradingView](https://www.tradingview.com/), [TradingView 다크모드 가이드](https://pineify.app/resources/blog/tradingview-night-mode-the-ultimate-guide-to-dark-theme-trading)

---

### 1-12. Bloomberg Terminal / Mobile

**홈/대시보드 레이아웃**
- LAUNCHPAD: 4~8개 위젯 그리드 동시 표시
- TOP 뉴스 + 실시간 헤드라인 티커
- 커스텀 모니터 (자산 클래스별)

**색상 시스템**
- 클래식 블랙 + 오렌지/화이트 텍스트
- 극한의 정보 밀도를 위한 고대비 컬러

**카드/위젯 디자인**
- 뉴스-시세 실시간 연동 (뉴스 클릭 → 관련 종목 즉시 점프)
- 알림 시스템 고도화 (조건부, 멀티 자산)

**모바일 UX 전략**
- 모바일은 보조적 역할
- 데스크톱 터미널이 주력

**배울 점**: 뉴스-시세 즉시 연동 패턴. 헤드라인 티커의 긴급성 전달.
**차별화**: 무료, 모바일-퍼스트, 큐레이션된 시그널 (학습 곡선 제로).

> 소스: [Bloomberg Terminal](https://www.bloomberg.com/professional/products/bloomberg-terminal/)

---

### 1-13. Coinbase

**홈/대시보드 레이아웃**
- 계좌 잔액 히어로 → 크립토 시세 → Top Movers → Buy & Sell CTA
- 포트폴리오: 총잔액 + 현금 + 크립토 분류 뷰
- 스크롤 다운 시 잔액이 상단 앱 바로 이동 (스티키 패턴)

**색상 시스템**
- 코인베이스 블루 (#0052FF) 브랜드
- 다크모드: 배터리 절약 + 눈 피로 감소
- 심플한 모노톤 + 블루 악센트

**카드/위젯 디자인**
- 5개 메인 페이지에 핵심 기능 그룹핑
- 사용자 멘탈 모델 기반 — "이미 가진 것 / 관심목록에 있는 것" 우선 표시

**시그널/알림 표현**
- 가격 변동 알림 (기본)
- 교육 콘텐츠 ("Learn & Earn") 연계

**모바일 UX 전략**
- 스크롤 시 컨텍스트 유지 (잔액 스티키)
- 직관적 5탭 내비게이션

**배울 점**: **스크롤 시 잔액/핵심 정보 스티키 패턴** — 우리의 시장 온도 바에 적용 가능. 사용자 멘탈 모델 기반 정보 우선순위.
**차별화**: 주식 통합, AI 시그널 인텔리전스.

> 소스: [Coinbase UI - Mobbin](https://mobbin.com/explore/screens/72e8d54e-72ab-4c36-9e0e-0193b8b55f34), [Coinbase UX 리디자인 - Medium](https://jpux.medium.com/case-study-coinbase-ux-redesign-9fa4038f5d52)

---

### 1-14. Binance

**홈/대시보드 레이아웃**
- 계좌 개요 + 잔액 + 시장 정보 대시보드
- 스마트 위젯 기반 커스텀 대시보드 (2025년 가이드)
- 히트맵 + 섹터 퍼포먼스 시각화

**색상 시스템**
- 바이낸스 옐로 (#F0B90B) + 다크 배경 (#0B0E11)
- 다크모드 디폴트 — 트레이딩 앱의 표준

**카드/위젯 디자인**
- 스마트 위젯 — 개인화된 대시보드 구성
- 고밀도 시세 테이블 + 미니 차트

**시그널/알림 표현**
- 다양한 조건부 알림
- 시장 분석 콘텐츠 제공

**모바일 UX 전략**
- 2025년 2월 앱 리프레시 — 더 빠르고 강력한 인터페이스
- AI 뉴스 요약 + 리디자인된 Explore 섹션

**배울 점**: 스마트 위젯 커스터마이징 + 히트맵 섹터 시각화. 다크 배경 #0B0E11은 극한의 다크.
**차별화**: 우리는 3시장 통합 + 시그널 큐레이션. 바이낸스는 코인 전용 + 거래 중심.

> 소스: [Binance 스마트 위젯 가이드](https://www.binance.com/en/square/post/25577724134057), [Binance 대시보드 - Mobbin](https://mobbin.com/explore/screens/27c09c21-1eff-4f70-8c5b-6d295727b514)

---

### 1-15. eToro

**홈/대시보드 레이아웃**
- 소셜 미디어 피드가 대시보드 홈 (커스터마이징 가능)
- Discover: Top Performers, CopyTrader, Smart Portfolios, Daily Movers, Trending Assets
- 웹/모바일 기능 동일 (반응형)

**색상 시스템**
- eToro 그린 (#6CAC3D) 브랜드
- 깔끔하고 밝은 라이트 모드 주력

**카드/위젯 디자인**
- 소셜 피드 카드 (트레이더 포스팅)
- CopyTrader 카드 — 다른 트레이더 수익률 + 복사 CTA
- "심플하면서도 아름다운" 인터페이스 평가

**시그널/알림 표현**
- Popular Investors 피드 — 소셜 시그널
- CopyTrader — 타인의 매매를 자동 복사
- Smart Portfolios — 테마 기반 분산투자

**모바일 UX 전략**
- "Investing made social" — 소셜 네트워크형 투자
- 초보자도 3분 안에 이해하는 직관적 UI
- 실시간 차트 + 계좌 정보를 모든 경험 수준에 맞게 제공

**배울 점**: **소셜 시그널** — Popular Investors 피드 패턴. AI 시그널 + 소셜 의견 결합 가능성.
**차별화**: 우리는 AI 기반 시그널, eToro는 소셜 기반 시그널. 향후 AI 토론 섹션이 이 갭을 연결.

> 소스: [eToro 플랫폼](https://www.etoro.com/trading/platforms/), [eToro 소셜 트레이딩](https://www.tradingpedia.com/social-trading-academy/etoro-social-trading/)

---

### 1-16. Interactive Brokers (IBKR GlobalTrader)

**홈/대시보드 레이아웃**
- 2025년 12월 앱 전면 리디자인 — "더 간단하고 스마트한 모바일 트레이딩"
- 리디자인된 Explore 페이지: 관련 종목/시장 발견
- Investment Themes: S&P 1500 전체를 기업/제품/경쟁사/지역으로 연결
- 히트맵: 섹터 퍼포먼스를 지수 기준으로 시각화

**색상 시스템**
- IBKR 레드 (#E51937) 브랜드
- 다크/라이트 모드 토글

**카드/위젯 디자인**
- 대시보드형 디자인 — 커스터마이징 가능한 위젯
- 접근성 쇼트컷 + 위젯 개인화

**시그널/알림 표현**
- **AI 뉴스 요약** — Explore + 종목 상세 페이지에 자동 생성
- Forecast Contracts 통합
- Market Trends: 시장 Top Movers 한눈에

**모바일 UX 전략**
- GlobalTrader = 심플 버전, IBKR Mobile = 풀 버전 (이중 전략)
- "시장 움직이는 정보를 단일 메뉴에 중앙화"

**배울 점**: **(1) AI 뉴스 요약 — 우리의 AI 시황과 직접 비교 대상. (2) Investment Themes — 종목 간 관계 시각화. (3) 히트맵 섹터 시각화.**
**차별화**: 우리는 한국 시장 특화 + easyLabel 쉬운 언어. IBKR은 글로벌 프로 투자자 타겟.

> 소스: [IBKR GlobalTrader 리디자인 - BusinessWire](https://www.businesswire.com/news/home/20251218345494/en/Interactive-Brokers-Redesigns-IBKR-GlobalTrader-App-for-Simpler-Smarter-Mobile-Trading), [IBKR Mobile](https://www.interactivebrokers.com/en/trading/ibkr-mobile.php)

---

### 1-17. Yahoo Finance

**홈/대시보드 레이아웃**
- 워치리스트 + 포트폴리오 + 인기 시장 데이터를 하나의 설정 가능한 대시보드에 통합
- 큰 헤드라인 + 큰 사진 + 적은 모듈 (최근 리디자인)
- Top Gainers/Losers + Market Overview

**색상 시스템**
- 야후 퍼플 (#6001D2) 브랜드
- 라이트 모드 주력, 다크모드 지원

**카드/위젯 디자인**
- 뉴스 카드: 대형 이미지 + 헤드라인
- 시세 카드: 미니 차트 + 등락률
- 설정 가능한 "My Portfolio & Markets" 독

**시그널/알림 표현**
- 가격 알림 (기본)
- 에디터 추천 뉴스
- 커뮤니티 게시판

**모바일 UX 전략**
- 뉴스 소비 + 시세 확인이 핵심 유스케이스
- 간결한 설정 가능 대시보드

**배울 점**: 뉴스+시세 통합 대시보드의 교과서. "큰 헤드라인 + 적은 모듈" = 정보 과부하 방지.
**차별화**: 우리는 시그널 중심 + 3시장 통합. Yahoo는 뉴스 중심 + 미장 위주.

> 소스: [Yahoo Finance 리디자인](https://finance.yahoo.com/news/yahoo-finances-look-000000816.html), [Yahoo Finance 업데이트](https://finance.yahoo.com/news/yahoo-updates-finance-website-app-170002973.html)

---

### 1-18. Seeking Alpha + Finviz (데이터 분석 플랫폼)

**Seeking Alpha**
- 개인화 대시보드: 포트폴리오 + 워치리스트 + 시장 데이터 통합 뷰
- Factor Grades로 모든 포지션의 종합 "Health Score" 제공
- 커스텀 뉴스 대시보드: 포트폴리오 종목별 최신 리서치/뉴스
- 직관적 UI — 초보자~전문가 모두 접근 가능한 정돈된 레이아웃
- 최근: 가격 알림 옵션을 가격 데이터 옆에 인라인 배치 (컨텍스트 알림)

**Finviz**
- "Financial Visualizations" — 복잡한 금융 데이터를 명확한 비주얼로 변환
- **히트맵**: 시장 전체를 한눈에 파악하는 핵심 기능
- 스크리너: 60~70+ 필터 기준으로 수천 종목을 1초 만에 필터링
- 클릭 최소화 + 정보 밀도 극대화 설계 철학
- 깔끔하고 반응형이며 놀랍도록 심플한 레이아웃

**배울 점**: (1) Seeking Alpha의 포트폴리오 "Health Score" — 우리의 시장 온도 바와 유사 콘셉트. (2) Finviz 히트맵 — 시장 전체를 1초에 파악. (3) 컨텍스트 인라인 알림 설정.
**차별화**: 우리는 모바일-퍼스트 + 시그널 큐레이션. SA/Finviz는 데스크톱 리서치 도구.

> 소스: [Seeking Alpha 포트폴리오](https://seekingalpha.com/portfolio_about), [Finviz 2026 리뷰 - StockBrokers](https://www.stockbrokers.com/review/tools/finviz), [Finviz 2026 리뷰 - InvestorStack](https://www.investorstack.app/research-tools/finviz-review)

---

## 2. 경쟁사 요약 매트릭스

| 항목 | 토스 | 카카오페이 | 삼성mPOP | 키움 | 나무 | 업비트 | 빗썸 | TradingView | Robinhood | Webull | Coinbase | Binance | eToro | IBKR | Yahoo | **마켓레이더** |
|------|------|----------|---------|------|------|--------|------|-------------|-----------|--------|----------|---------|-------|------|-------|-------------|
| 3시장 통합 | X | X | X | X | X | X | X | O | X | O | X | X | O | O | O | **O** |
| 시그널/인텔리전스 | X | AI요약 | X | 조건검색 | X | X | X | 커뮤니티 | X | X | X | X | 소셜 | AI요약 | X | **O (AI 시그널)** |
| "왜 지금" 맥락 | X | AI요약 | X | X | X | X | X | 커뮤니티 | 뉴스만 | X | X | X | 소셜 | AI요약 | 뉴스 | **O (WHY 카드)** |
| 모바일 UX | S+ | A | A | B | A | A+ | B+ | B | A+ | B+ | A | A | A+ | B+ | A | **목표: A+** |
| 다크모드 | O | X | O | O | X | O | O | O | O | O | O | O | X | O | O | **O** |
| 쉬운 언어 | O | O | X | X | X | X | X | X | O(Snacks) | X | O | X | O | X | X | **O (easyLabel)** |
| 진입 장벽 | 매우낮음 | 낮음 | 중간 | 높음 | 중간 | 낮음 | 중간 | 높음 | 낮음 | 중간 | 낮음 | 중간 | 낮음 | 높음 | 낮음 | **목표: 매우낮음** |

---

## 3. 디자인 트렌드 분석 (2025~2026)

### 3-1. 금융 앱 UI 트렌드: 글래스모피즘 vs 뉴모피즘 vs 미니멀리즘

#### 글래스모피즘 (Glassmorphism)
- **현재 위치**: 2026년에도 여전히 트렌디. 미니멀리즘, 심플함, 시각적 매력에 초점.
- **금융 앱 적용**: 반투명 차트/그래프 오버레이, 프로스트 글라스 패널로 데이터 레이어링.
- **장점**: 깊이감 + 계층 구조를 복잡하지 않게 전달.
- **주의**: 투명도와 블러가 대비를 낮춰 가독성 저하 위험. 약간 더 어두운 배경 또는 텍스트 두께 증가로 보완 필수.
- **마켓레이더 적용 판단**: 제한적 사용 권장. 시장 온도 바 등 장식 요소에만. 시세 숫자에는 절대 금지.

#### 뉴모피즘 (Neumorphism / Soft UI)
- **현재 위치**: 미니멀 도구/웰니스 앱에서 여전히 유효. 부드럽고 촉각적인 인터페이스.
- **금융 앱 적용**: 금융 앱, 대시보드, 스마트홈 UI에 사용 가능.
- **장점**: 차분하고 촉각적 느낌. 버튼이 배경에서 돌출/함몰되는 효과.
- **주의**: 접근성 문제 — 대비가 낮아 시각 장애 사용자에게 부적합. 복잡한 UI에 적용 어려움.
- **마켓레이더 적용 판단**: 비권장. 빠른 스캔이 필요한 트레이딩 앱에서 부드러운 그림자는 정보 인지를 늦춤.

#### 미니멀리즘 (Minimalism)
- **현재 위치**: 2026년 핀테크 디자인의 기본 철학. "신뢰, 명확성, 일관성"이 키워드.
- **금융 앱 적용**: 불필요한 요소 제거, 핵심 컴포넌트만 남기기. 사용자 목표 달성에 필요한 최소한.
- **장점**: 빠른 정보 인지. 눈의 피로 감소. 신뢰감 향상.
- **마켓레이더 적용 판단**: **핵심 채택**. 시그널 중심 철학과 완벽히 일치. "시세 데이터는 배경, 시그널이 전경."

**결론**: 미니멀리즘 기반 + 글래스모피즘 터치 (장식 요소에만). 뉴모피즘은 배제.

> 소스: [글래스모피즘 예제 2026](https://onyx8agency.com/blog/glassmorphism-inspiring-examples/), [UI 트렌드 2026 - wearetenet](https://www.wearetenet.com/blog/ui-ux-design-trends), [뉴모피즘 완전 가이드 2026](https://www.bighuman.com/blog/neumorphism)

---

### 3-2. 데이터 대시보드 UX 패턴: 정보 밀도 vs 여백

#### 핵심 발견
- **정보 과부하**는 대시보드 사용자의 46.7%가 경험하는 가장 큰 문제 (Pencil & Paper 리서치)
- 2026년까지 모바일/태블릿 BI 사용이 기업 BI의 60%를 초과할 전망 (Gartner)
- "올바른 데이터를 올바른 계층에, 최소한의 시각적 노이즈로" 표면화하는 것이 핵심

#### 실무 원칙

| 원칙 | 설명 | 마켓레이더 적용 |
|------|------|---------------|
| 3~5 핵심 지표 | 모바일에서는 이동 중 확인하는 핵심 지표만 | Layer 1: 시장 온도 + 최강 시그널 |
| 44x44px 터치 타겟 | 모바일 인터랙티브 요소 최소 크기 | 현재 별 버튼 24px → 개선 필요 |
| 수직 스크롤 우선 | 복잡한 멀티컬럼 대신 세로 스크롤 | 모바일: 단일 컬럼 |
| AI 개인화 | 사용자별 관련 지표 우선 표시 | 관심종목 기반 시그널 우선 표시 |
| 점진적 노출 | 요약 → 드릴다운 패턴 | 히어로 시그널 → 탭으로 상세 |

> 소스: [대시보드 UX 패턴 - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards), [대시보드 디자인 원칙 2026 - DesignRush](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles), [대시보드 UX - DesignRush](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-ux)

---

### 3-3. 모바일-퍼스트 금융 대시보드 베스트 프랙티스 (2025~2026)

| 영역 | 베스트 프랙티스 | 근거 |
|------|--------------|------|
| 온보딩 | 웰컴 투어 없이 UI 자체가 설명 | 핀테크 이탈률의 40%가 첫 3화면에서 발생 |
| 네비게이션 | 터치 퍼스트 설계 → 마우스 적응 | "Design for touch first, then adapt for mouse and keyboard" |
| 보안 UX | 생체인증 + 무비밀번호 로그인 | 빠른 접근과 보안의 균형 |
| 마이크로카피 | "인간적이고, 투명하고, 차분한" 톤 | 금융 전문용어 → 일상 언어 (우리의 easyLabel 철학과 일치) |
| 진행 표시 | 위저드 스타일 + 브레드크럼 | 다단계 프로세스(계좌 개설 등)에서 이탈 감소 |
| 실시간 피드백 | 인라인 밸리데이션 + 로딩 후 성공 메시지 | 원인-결과 커뮤니케이션 |
| 게이미피케이션 | 프로그레스 바, 목표 스트릭, 배지 | 과하지 않게 — 금융 앱에서는 절제가 핵심 |

> 소스: [핀테크 UX 디자인 가이드 2026 - Eleken](https://www.eleken.co/blog-posts/modern-fintech-design-guide), [핀테크 UX 베스트 프랙티스 2025](https://procreator.design/blog/best-fintech-ux-practices-for-mobile-apps/), [뱅킹 앱 디자인 트렌드 2026 - G&Co](https://www.g-co.agency/insights/banking-app-design-trends-2025-ux-ui-mobile-insights)

---

### 3-4. 다크모드 금융 앱 색상 체계 (눈 피로도 최소화)

#### 핵심 원칙

**절대 하지 말 것**
- 순수 검정(#000000) 배경 + 순수 흰색(#FFFFFF) 텍스트 → 극한 대비로 눈 피로 극심
- 비비드한 원색 그대로 사용 → 다크 배경에서 눈이 아픔

**반드시 할 것**
- 다크 그레이 배경: `#121212` (Material Design 권장) 또는 `#131722` (TradingView)
- 오프화이트 텍스트: `#E0E0E0` (순백 대신)
- 악센트 컬러 디새추레이션: 비비드 → 뮤트드 톤

#### 마켓레이더 다크모드 토큰 제안

```
/* 배경 레이어 (elevation 시스템) */
--bg-base:       #121416    /* 앱 전체 배경 */
--bg-surface:    #1A1D21    /* 카드/위젯 배경 */
--bg-elevated:   #22262B    /* 드롭다운/모달 배경 */
--bg-hover:      #2A2E35    /* 호버 상태 */

/* 텍스트 */
--text-primary:  #E3E5E8    /* 주요 텍스트 (순백 아님) */
--text-secondary:#8B95A1    /* 보조 텍스트 (라이트와 동일 유지) */
--text-tertiary: #6B7684    /* 부가 텍스트 */

/* 시세 색상 (다크모드 디새추레이션) */
--rise:          #FF6B6B    /* 상승 — #F04452 대비 약간 밝고 뮤트드 */
--rise-bg:       #2D1F22    /* 상승 배경 */
--fall:          #4E8EF7    /* 하락 — #1764ED 대비 약간 밝고 뮤트드 */
--fall-bg:       #1A2133    /* 하락 배경 */

/* 보더/디바이더 */
--border:        #2A2E35    /* 카드 보더 */
--divider:       #22262B    /* 구분선 */
```

#### 엘리베이션 시스템 (다크모드)
- 다크모드에서는 그림자 대신 배경 밝기로 높이를 표현
- 더 높은 elevation = 약간 더 밝은 서피스
- 미세한 아우터 글로우 (보색 30% 불투명도) 또는 밝은 보더로 CTA 강조

#### 접근성 체크리스트
- [ ] 본문 텍스트 대비: 최소 4.5:1 (WCAG AA)
- [ ] 대형 텍스트/헤딩 대비: 최소 3:1
- [ ] 상승/하락 색상: 색맹 사용자를 위해 아이콘(↑↓) 병행
- [ ] 씬 폰트 사용 금지 — 다크 배경에서 가느다란 텍스트는 보이지 않음
- [ ] 최소 regular/medium 웨이트, 헤딩은 bold

> 소스: [다크모드 디자인 가이드 - UX Design Institute](https://www.uxdesigninstitute.com/blog/dark-mode-design-practical-guide/), [트레이딩 색상 테마 - JustMarkets](https://justmarkets.com/trading-articles/learning/color-themes-for-comfortable-intraday-trading-and-scalping), [다크모드 금융 브랜드 - Financial Marketer](https://financial-marketer.com/finance-brands-designing-dark-mode/)

---

## 4. AI 슬롭 방지 체크리스트

> "AI 슬롭(slop)"이란 AI가 생성한 콘텐츠/디자인에서 나타나는 일반적이고 차별화 없는 패턴을 말한다.
> 근본 원인은 **분포적 수렴(distributional convergence)** — LLM/AI 빌더가 학습 데이터에서 가장 빈번한 패턴을 출력하므로 미학적 단일문화(aesthetic monoculture)가 형성된다.

### 4-1. AI 슬롭 패턴 (이렇게 생기면 AI가 만든 것)

#### 타이포그래피
- [ ] **Inter 폰트 디폴트** — AI 디자인 도구의 99%가 Inter를 기본으로 사용
- [ ] 타이포그래피 계층 부재 — 모든 텍스트가 비슷한 크기와 웨이트
- [ ] 시스템 산세리프 폴백만 사용

#### 색상
- [ ] **퍼플-투-블루 그라데이션** — AI가 생성하는 "가장 안전한" 선택
- [ ] 의미 없는 장식적 색상 사용 (시맨틱 역할 없이 "예쁘게")
- [ ] 히어로, 버튼, 배경에 동일한 그라데이션 반복
- [ ] 색상 과다 사용 — 동시에 5개 이상 컬러

#### 레이아웃
- [ ] **모든 곳에 동일한 16px border-radius** — 카드, 버튼, 인풋 무차별 적용
- [ ] 모든 요소에 동일한 24px 패딩
- [ ] 히어로 섹션에 "Build the future" 같은 모호하고 영감적인 헤드라인
- [ ] 카드 기반 레이아웃에 모든 카드가 동일한 크기와 구조

#### 이미지/일러스트
- [ ] "밝은 사무실에서 노트북 보는 다양한 사람들" 스톡 사진
- [ ] **플라스틱 질감** — 너무 매끈하고 대칭적인 AI 일러스트
- [ ] 실제 제품 스크린샷이나 고유 브랜드 사진 부재

#### 모션/인터랙션
- [ ] 호버에 피드백 없음
- [ ] **버튼이 이징 없이 스냅** — transition: none 또는 기본값
- [ ] 모든 요소에 동일한 fade-in 애니메이션 (또는 애니메이션 전무)
- [ ] 의도적 목적 없는 장식 애니메이션

#### 콘텐츠/카피
- [ ] "혁신적인", "차세대", "강력한" 같은 AI 특유의 수식어 과다
- [ ] 헷징 언어: "~할 수 있습니다", "~에 도움이 될 수 있습니다"
- [ ] 브랜드 고유 목소리 없이 무색투명한 톤

---

### 4-2. 고품질 디자인 패턴 (사람이 만든 것 같은)

#### 타이포그래피
- [x] **브랜드 고유 폰트 시스템** — 디스플레이 + 본문 2종 조합
- [x] 의도적인 타이포 계층: Title(18) > Body(14) > Label(13) > Caption(12) > Micro(11)
- [x] 숫자에 `font-mono + tabular-nums` (금융 앱 필수)
- [x] 예시: Linear의 커스텀 타입, Stripe의 세리프+산세리프 페어링, 빗썸 트레이딩 산스

#### 색상
- [x] **시맨틱 컬러 시스템** — CSS custom properties + 기능적 네이밍 (--color-action-primary)
- [x] 색상이 기능과 상태를 전달 (노란색=하이라이트, 파란색=링크, 빨간색=상승)
- [x] 최소한의 팔레트 — 3~4색 이내로 일관성 유지
- [x] 예시: Notion의 기능적 색상 체계, 토스의 수익률 앵커 색상

#### 레이아웃
- [x] **의도적인 시각 계층** — F-패턴/역피라미드에 따른 정보 배치
- [x] 요소별 차별화된 radius: 카드(16px), 버튼(8px), 인풋(6px), 배지(4px)
- [x] 정보 밀도에 맞는 여백 — 숨쉬는 공간 + 핵심 정보 그룹핑
- [x] 비대칭 레이아웃 — 히어로(크게) + 서브(작게)로 시선 유도

#### 이미지/일러스트
- [x] 실제 제품 스크린샷, 팀 사진, 커스텀 일러스트
- [x] 브랜드 고유의 아이콘 언어 (일관된 선 두께, 스타일)
- [x] 의미 있는 데이터 시각화 (장식이 아닌 정보 전달)

#### 모션/인터랙션
- [x] **상태 변화에만 애니메이션** — 입장, 전환, 주의 환기, 브랜드 개성
- [x] 주요 CTA + 폼 인풋에 마이크로 인터랙션
- [x] 장식 목적 애니메이션 제거
- [x] 이징 함수 설정: ease-out (진입), ease-in-out (전환)

#### 콘텐츠/카피
- [x] **브랜드 고유 목소리** — "우리 CEO가 실제로 이렇게 말하겠는가?" 테스트
- [x] 구체적이고 행동 지향적인 헤드라인
- [x] easyLabel 같은 고유 언어 체계
- [x] 예시: Robinhood의 "Snacks", 마켓레이더의 "시장이 뜨겁다/차갑다"

---

### 4-3. 마켓레이더 v5 자가 진단

| 영역 | 현재 상태 | AI 슬롭 위험도 | 개선 방향 |
|------|----------|--------------|----------|
| 타이포그래피 | 시스템 폰트 + tabular-nums | 중간 | Pretendard/SUIT 등 한국어 최적화 폰트 도입 검토 |
| 색상 | 시맨틱 토큰 시스템 운영 중 | 낮음 | 유지 — 한국식 빨강/파랑 고유 체계 |
| 레이아웃 | 커맨드센터 개편 완료 | 중간 | radius 차별화 필요 (현재 모두 rounded-2xl) |
| 모션 | 최소한 | 낮음 (없으니까) | 상태 변화 마이크로 인터랙션 추가 필요 |
| 콘텐츠 | easyLabel 체계 운영 중 | 낮음 | 유지 + 확장 |
| 아이콘 | 혼합 사용 | 높음 | 통일된 아이콘 라이브러리 필요 |

---

## 5. 핵심 인사이트 종합

### 5-1. 우리만의 포지션 (18개 레퍼런스 기반)

```
토스/카카오 = "쉽고 예쁜데 시그널 없음"
업비트/빗썸 = "코인만, 인텔리전스 없음"
키움/삼성   = "정보 많은데 복잡하고 모바일 약함"
TradingView = "프로 전용, 커스텀 필수, 모바일 약함"
Robinhood  = "쉽고 감성적이지만 시그널/3시장 없음"
IBKR       = "AI 요약 있지만 프로 타겟, 진입 장벽 높음"
eToro      = "소셜 시그널이지만 AI/한국 특화 없음"
Coinbase   = "코인만, 멘탈모델 좋지만 주식 없음"
Finviz     = "데이터 시각화 최고지만 데스크톱/리서치 전용"

마켓레이더 = "3시장 통합 × AI 시그널 × 쉬운 언어 × 모바일-퍼스트"
```

### 5-2. 레퍼런스에서 훔칠 패턴 TOP 10

| 순위 | 패턴 | 출처 | 적용 위치 |
|------|------|------|----------|
| 1 | 히어로 시그널 카드 (가장 강한 시그널 1개 크게) | Robinhood Today's Movers | HeroSignalCard |
| 2 | 스크롤 시 핵심 정보 스티키 | Coinbase 잔액 스티키 | 시장 온도 바 스티키 |
| 3 | 실시간 셀 깜빡임/색상 전환 | 업비트 WebSocket UI | 관심종목 가격 변동 |
| 4 | 히트맵 섹터 시각화 | Finviz, IBKR, Binance | 시장 온도 확장 (향후) |
| 5 | AI 뉴스 요약 인라인 | IBKR GlobalTrader, 카카오페이 | AI 시황 + 시그널 카드 |
| 6 | 수평 카드 캐러셀 (스와이프) | Robinhood, Coinbase | NotableMovers 카드 |
| 7 | 트레이딩 전용 숫자 폰트 (고정폭) | 빗썸 트레이딩 산스 | 전체 시세 표시 영역 |
| 8 | 컨텍스트 인라인 알림 설정 | Seeking Alpha | 시그널 카드 내 알림 토글 |
| 9 | 소셜/AI 토론 피드 | eToro CopyTrader, SA | AI 토론 섹션 |
| 10 | 포트폴리오 Health Score 게이지 | Seeking Alpha | 시장 온도 바 |

### 5-3. 절대 하지 말 것

1. **과도한 글래스모피즘** — 시세 숫자 가독성이 최우선
2. **뉴모피즘** — 트레이딩 앱에서 부드러운 그림자는 정보 인지를 늦춤
3. **퍼플-블루 그라데이션** — AI 슬롭의 대표 시그널
4. **모든 카드 동일 크기** — 히어로/서브 시각 계층 필수
5. **형광/밝은 그린** — 나무증권 사례처럼 눈 피로도 유발
6. **Inter 폰트 디폴트 방치** — 타이포그래피 = 브랜드 차별화 1순위
7. **동일 border-radius 전역 적용** — 요소별 차별화 필수

---

## 부록: 소스 전체 목록

### 국내 서비스
- [토스증권 App Store](https://apps.apple.com/kr/app/toss)
- [카카오페이증권 UX](https://brunch.co.kr/@kakaopaysec/15)
- [카카오페이 기술블로그](https://tech.kakaopay.com/tag/ux/)
- [삼성증권 mPOP Google Play](https://play.google.com/store/apps/details?id=com.samsungpop.android.mpop)
- [키움증권 영웅문S# App Store](https://apps.apple.com/us/app/%ED%82%A4%EC%9B%80%EC%A6%9D%EA%B6%8C-%EC%98%81%EC%9B%85%EB%AC%B8s-new/id1570370057)
- [나무증권 App Store](https://apps.apple.com/kr/app/%EB%82%98%EB%AC%B4%EC%A6%9D%EA%B6%8C-nh%ED%88%AC%EC%9E%90%EC%A6%9D%EA%B6%8C-mts/id486312400)
- [NH위젯 디자인](https://ooooseok.com/work/nhWidgetWatch08)
- [업비트 Google Play](https://play.google.com/store/apps/details?id=com.dunamu.exchange)
- [빗썸 UI 개편](https://www.insightkorea.co.kr/news/articleView.html?idxno=243294)
- [빗썸 차트 UI](https://zdnet.co.kr/view/?no=20230925143126)
- [코인원 App Store](https://apps.apple.com/kr/app/%EC%BD%94%EC%9D%B8%EC%9B%90/id1326526995)

### 해외 서비스
- [Robinhood](https://robinhood.com/us/en/about/)
- [Webull 2026 리뷰](https://www.a1trading.com/webull-platform-review/)
- [TradingView](https://www.tradingview.com/)
- [TradingView 다크모드](https://pineify.app/resources/blog/tradingview-night-mode-the-ultimate-guide-to-dark-theme-trading)
- [Bloomberg Terminal](https://www.bloomberg.com/professional/products/bloomberg-terminal/)
- [Coinbase UI - Mobbin](https://mobbin.com/explore/screens/72e8d54e-72ab-4c36-9e0e-0193b8b55f34)
- [Coinbase UX 리디자인](https://jpux.medium.com/case-study-coinbase-ux-redesign-9fa4038f5d52)
- [Binance 스마트 위젯](https://www.binance.com/en/square/post/25577724134057)
- [Binance 대시보드 - Mobbin](https://mobbin.com/explore/screens/27c09c21-1eff-4f70-8c5b-6d295727b514)
- [eToro 플랫폼](https://www.etoro.com/trading/platforms/)
- [IBKR GlobalTrader 리디자인](https://www.businesswire.com/news/home/20251218345494/en/Interactive-Brokers-Redesigns-IBKR-GlobalTrader-App-for-Simpler-Smarter-Mobile-Trading)
- [Yahoo Finance 리디자인](https://finance.yahoo.com/news/yahoo-finances-look-000000816.html)
- [Seeking Alpha 포트폴리오](https://seekingalpha.com/portfolio_about)
- [Finviz 2026 리뷰](https://www.stockbrokers.com/review/tools/finviz)

### 디자인 트렌드
- [핀테크 디자인 가이드 2026 - Eleken](https://www.eleken.co/blog-posts/modern-fintech-design-guide)
- [핀테크 UX 트렌드 2025 - Adam Fard](https://adamfard.com/blog/fintech-ux-trends)
- [뱅킹 앱 디자인 트렌드 2026 - G&Co](https://www.g-co.agency/insights/banking-app-design-trends-2025-ux-ui-mobile-insights)
- [대시보드 UX 패턴 - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [대시보드 디자인 원칙 2026 - DesignRush](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [다크모드 디자인 가이드 - UX Design Institute](https://www.uxdesigninstitute.com/blog/dark-mode-design-practical-guide/)
- [트레이딩 색상 테마 - JustMarkets](https://justmarkets.com/trading-articles/learning/color-themes-for-comfortable-intraday-trading-and-scalping)
- [글래스모피즘 2026](https://onyx8agency.com/blog/glassmorphism-inspiring-examples/)
- [UI 트렌드 2026 - wearetenet](https://www.wearetenet.com/blog/ui-ux-design-trends)

### AI 슬롭 방지
- [AI 슬롭 웹디자인 가이드 - 925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [AI 슬롭 - Wikipedia](https://en.wikipedia.org/wiki/AI_slop)
- [AI 콘텐츠 휴먼라이징 - BuildShip](https://buildship.com/blog/humanize-your-ai-content)
