# 코딩 컨벤션

Claude Code가 코드를 작성할 때 반드시 따르는 규칙이다.

---

## 📁 파일 구조

```
src/
├── components/   # UI 컴포넌트
├── hooks/        # 커스텀 훅 (데이터 페칭)
├── utils/        # 유틸 함수
└── constants/    # 상수 (종목 목록 등)
```

## 📝 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 파일 | PascalCase | `StockCard.jsx` |
| 훅 파일 | camelCase + use | `useCoinData.js` |
| 유틸 파일 | camelCase | `formatNumber.js` |
| 상수 | UPPER_SNAKE_CASE | `COIN_SYMBOLS` |
| CSS 클래스 | TailwindCSS 유틸 클래스만 사용 | |

## ⚛️ 컴포넌트 규칙

- 한 파일은 200줄 이하로 유지
- props는 구조분해할당으로 받는다
- 불필요한 리렌더 방지: `React.memo`, `useMemo`, `useCallback` 활용
- 주석은 한국어로

```jsx
// ✅ 좋은 예
const StockCard = ({ name, price, changeRate }) => {
  // 급상승 여부 판단 (5% 이상)
  const isSurge = changeRate >= 5;
  ...
}

export default React.memo(StockCard);
```

## 🎨 스타일 규칙

- TailwindCSS 유틸 클래스만 사용 (인라인 style 금지)
- 색상은 반드시 디자인 시스템 기준값 사용
  - 상승: `text-red-500` 또는 `#FF4136`
  - 하락: `text-blue-500` 또는 `#1A73E8`

## 🔢 숫자 포맷

- 가격: `₩72,300` (천 단위 콤마)
- 등락률: `+4.2%` / `-2.1%` (부호 포함)
- 거래량: `18.3M` / `1.2B` (K/M/B 단위 축약)
- 시가총액: `431조` (조 단위)

## 🌐 API 호출 규칙

- 모든 API 호출은 `hooks/` 폴더의 커스텀 훅에서만
- React Query 사용: `staleTime`, `refetchInterval` 명시
- 실패 시 반드시 에러 핸들링 + 마지막 정상 데이터 유지
- 환경변수는 `import.meta.env.VITE_XXX` 형식

```js
// ✅ 좋은 예
const { data: coins } = useQuery({
  queryKey: ['coins'],
  queryFn: fetchCoins,
  staleTime: 10_000,        // 10초
  refetchInterval: 10_000,  // 10초마다 자동 갱신
});
```

## 📦 Git 커밋 메시지

```
feat: 종목 카드 스파크라인 추가
fix: 급상승 배너 클릭 이동 버그 수정
style: 카드 hover 애니메이션 개선
refactor: useCoinData 훅 분리
chore: 환경변수 예시 파일 추가
```
