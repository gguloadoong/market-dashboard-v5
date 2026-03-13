# 보안 지침

## 🔑 API 키 관리 원칙

### 저장 위치
- 모든 키값은 반드시 `.env` 파일에만 저장한다
- `.env.example` 파일에는 키 이름만 적고 값은 비워둔다

### 공유 금지
- `.env` 파일은 절대 GitHub, Slack, 카카오톡 등 어디에도 전송하지 않는다
- 스크린샷에 키값이 보이지 않도록 주의한다

### .gitignore 확인
- 프로젝트 시작 시 반드시 `.gitignore` 에 아래 항목 등록 여부 확인
```
.env
.env.local
.env.production
```

### Claude Code 작업 시
- 항상 "환경변수 방식으로 코딩해달라"고 명시한다
- 코드 리뷰 시 하드코딩된 키가 없는지 확인한다

---

## 🚨 실수로 키가 노출됐을 때

### 절대 "삭제"만 하면 안 된다
Git에 한 번 올라간 키는 삭제해도 히스토리에 남는다.

### 올바른 대응 순서
1. **즉시 무효화(Revoke)** — 해당 서비스 대시보드에서 키 삭제
2. **새 키 발급** — 새로운 키를 즉시 발급
3. **`.env` 업데이트** — 새 키로 교체
4. **Git 히스토리 정리** — `git filter-branch` 또는 GitHub 지원팀에 문의
5. **Vercel 환경변수 업데이트** — 배포 환경도 새 키로 교체

---

## 📋 이 프로젝트 환경변수 목록

| 변수명 | 설명 | 발급처 |
|--------|------|--------|
| `VITE_KIS_APP_KEY` | 한국투자증권 앱 키 | securities.koreainvestment.com |
| `VITE_KIS_APP_SECRET` | 한국투자증권 앱 시크릿 | 동일 |
| `VITE_NEWS_API_KEY` | 뉴스 API 키 | newsapi.org |

### .env 파일 예시
```
VITE_KIS_APP_KEY=여기에_발급받은_키_입력
VITE_KIS_APP_SECRET=여기에_발급받은_시크릿_입력
VITE_NEWS_API_KEY=여기에_발급받은_키_입력
```

---

## ✅ 배포 시 체크리스트

- [ ] `.env` 파일이 `.gitignore` 에 등록되어 있는가
- [ ] `git status` 에 `.env` 가 포함되어 있지 않은가
- [ ] 코드에 키값이 직접 적혀있지 않은가
- [ ] Vercel 환경변수에 키값이 입력되어 있는가
