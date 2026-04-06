# Code Review: fix/#22 코스피 혼합 기사 관련종목

VERDICT: PASS

## 변경 요약
- newsTopicMap.js: kr_stock_market 토픽 추가 (코스피/코스닥 키워드 → KR 섹터)
- NewsSidePanel.jsx: allowedMarkets 혼합 기사 감지 (mentionsKrMarket)
- NewsSidePanel.jsx: TOPIC_TO_ASSET_SECTORS KR 섹터 매핑 추가

## 검토 결과
- 로직 정확: coin 카테고리 + 코스피 언급 시 KR 허용
- 사이드이펙트 없음: coin-only 기사는 기존과 동일
- 빌드 에러 0
