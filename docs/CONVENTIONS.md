# 코딩 컨벤션 (v5 기준)

Claude Code가 코드를 작성할 때 반드시 따르는 규칙이다.

---

## 📁 파일 구조

```
src/
├── components/        # UI 컴포넌트 (탭별 하위 디렉토리)
│   ├── home/          # 홈 위젯 (HOME_CONTRACT.md 참조 필수)
│   ├── stocks/        # 국내/미국 주식 탭
│   ├── coins/         # 코인 탭
│   └── common/        # 공용 컴포넌트
├── engine/            # 시그널 엔진 (알고리즘 파일 — 수정 시 npm run architect 필수)
├── hooks/             # 커스텀 훅 (데이터 페칭, 시그널 계산)
├── utils/             # 유틸 함수 (알고리즘 파일 다수 포함)
├── data/              # 정적 데이터 (종목 목록, 관련 자산 맵)
└── constants/         # 상수 (signalThresholds 등 알고리즘 파일 포함)

api/                   # Vercel Edge Functions / Serverless Functions
workers/               # Cloudflare Workers (시그널 사전계산 크론)
```

### 알고리즘 파일 (수정 시 `npm run architect` 필수 — PR 자동 차단)

```
src/engine/
src/constants/signalThresholds.js
src/utils/marketHours.js
src/utils/newsAlias.js
src/utils/newsTopicMap.js
src/utils/newsSignal.js
src/utils/signalCardRenderer.js
src/data/relatedAssets.js
src/hooks/useSignals.js
src/hooks/useDerivativeSignals.js
src/hooks/useInvestorSignals.js
```

---

## 📝 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 파일 | PascalCase | `StockCard.jsx` |
| 훅 파일 | camelCase + use 접두사 | `useCoinData.js` |
| 유틸 파일 | camelCase | `formatNumber.js` |
| 상수 (원시값) | UPPER_SNAKE_CASE | `COIN_SYMBOLS` |
| 상수 (객체/배열) | UPPER_SNAKE_CASE | `SIGNAL_THRESHOLDS` |
| CSS 클래스 | TailwindCSS 유틸 클래스만 사용 | — |
| 이벤트 핸들러 | on + 동사 | `onClick`, `onTabChange` |

---

## ⚛️ 컴포넌트 규칙

- 일반 컴포넌트: **300줄 이하** (대형 위젯은 300줄까지 허용, 초과 시 서브컴포넌트 분리)
- props는 구조분해할당으로 받는다
- 불필요한 리렌더 방지: `React.memo`, `useMemo`, `useCallback` 활용
- 주석은 한국어로
- 홈 컴포넌트 수정 전 반드시 `src/components/home/HOME_CONTRACT.md` 먼저 읽기
- HOME_CONTRACT.md의 "영구 삭제된 컴포넌트" 목록에 있는 컴포넌트 절대 재추가 금지

```jsx
// ✅ 좋은 예
const StockCard = ({ name, price, changeRate }) => {
  // 급상승 여부 판단 (5% 이상)
  const isSurge = changeRate >= 5;
  // ...
};

export default React.memo(StockCard);
```

---

## 🎨 스타일 규칙

- **TailwindCSS 유틸 클래스 우선**, 인라인 `style={{}}` 금지
- 색상은 반드시 CSS 변수 또는 디자인 시스템 기준값 사용

### 색상 시스템 (한국 증권 컨벤션 — 변경 금지)

| 상태 | CSS 변수 | 색상값 | Tailwind 클래스 |
|------|----------|--------|----------------|
| 상승 | `var(--color-up)` | `#ff6b77` | `text-red-400` |
| 하락 | `var(--color-down)` | `#5b9cf6` | `text-blue-400` |
| 보합 | `var(--color-neutral)` | `#9ca3af` | `text-gray-400` |

```jsx
// ✅ CSS 변수 사용 (권장)
<span style={{ color: 'var(--color-up)' }}>+4.2%</span>

// ✅ Tailwind 클래스 사용 (권장)
<span className="text-red-400">+4.2%</span>

// ❌ 하드코딩 금지
<span style={{ color: '#ff6b77' }}>+4.2%</span>
```

### 다크모드

- 다크모드 기본, CSS 변수 기반 테마 시스템 사용
- `dark:` Tailwind 접두사 활용
- 배경/텍스트/보더 색상은 항상 다크모드 클래스 병기

---

## 🔢 숫자 포맷

- 가격: `₩72,300` (천 단위 콤마)
- 등락률: `+4.2%` / `-2.1%` (부호 포함)
- 거래량: `18.3M` / `1.2B` (K/M/B 단위 축약)
- 시가총액: `431조` (조 단위)
- 포맷 함수는 `src/utils/` 에서 공통 함수 사용 (중복 구현 금지)

---

## 🌐 API 호출 규칙

- 모든 API 호출은 `hooks/` 폴더의 커스텀 훅에서만
- React Query 사용: `staleTime`, `refetchInterval` 명시
- 실패 시 반드시 에러 핸들링 + 마지막 정상 데이터 유지
- 환경변수:
  - 프론트엔드 (Vite): `import.meta.env.VITE_XXX`
  - API Edge Functions / Workers: `process.env.XXX`
- API 키 하드코딩 절대 금지

```js
// ✅ 좋은 예
const { data: coins } = useQuery({
  queryKey: ['coins'],
  queryFn: fetchCoins,
  staleTime: 10_000,        // 10초
  refetchInterval: 10_000,  // 10초마다 자동 갱신
});
```

---

## 🚦 시그널 객체 스펙 (ADR-017)

시그널 객체는 다음 필드를 포함한다:

```ts
{
  type: string,           // 시그널 타입 (e.g. 'VOLUME_SURGE')
  source: 'client' | 'server' | 'hybrid',  // 계산 주체
  confidence: number,     // 신뢰도 0~1
  reasons: string[],      // 근거 목록 (UI 표시용)
  // ... 기타 타입별 필드
}
```

---

## 📦 Git 커밋 메시지

```
feat: 종목 카드 스파크라인 추가
fix: 급상승 배너 클릭 이동 버그 수정
refactor: useCoinData 훅 분리
docs: CONVENTIONS.md v5 기준 업데이트
chore: 환경변수 예시 파일 추가
```

### feat: / fix: 작업 시 필수 절차

1. `gh issue create` → Issue 생성 (라벨: ai-generated + 작업 성격)
2. `git checkout -b feature/#이슈번호-설명`
3. 작업 완료 후 커밋 & 푸시
4. `npm run review:code` — Claude Opus 독립 리뷰
5. `npm run pr "PR 제목"` — PR 생성 (직접 `gh pr create` 금지)

`refactor:` / `docs:` / `chore:` 는 main 직접 커밋 허용.

---

## 🔐 보안

- 시크릿(API 키/토큰) 하드코딩 절대 금지
- `.env` 파일 읽기: `cat .env` 금지 → `grep -c "KEY_NAME" .env` 로 존재 확인만
- `git add -A` / `git add .` 금지 → 파일명 명시적 지정만 허용

---

## ⚠️ 금지 사항

| 금지 | 대신 |
|------|------|
| 인라인 `style={{}}` | Tailwind 클래스 또는 CSS 변수 |
| `any` 타입 | 구체적 타입 정의 |
| 빈 `catch {}` | 에러 로깅 또는 상태 업데이트 |
| 매직 넘버 | 상수로 분리 (`constants/`) |
| `git add -A` | 파일명 명시 |
| `cat .env` | `grep -c "KEY" .env` |
| Codex CLI / omc ask codex | Claude Opus code-reviewer + Gemini gate |
| 알고리즘 파일 직접 수정 | `npm run architect` 먼저 실행 |
