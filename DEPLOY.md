# 배포 가이드

---

## 🖥 로컬 개발 서버

```bash
cd ~/Documents/market-dashboard-v2
npm run dev
# → http://localhost:5173 에서 확인
```

- 파일 저장 시 브라우저 자동 새로고침 (HMR)
- 내 맥에서만 접속 가능

---

## 🚀 Vercel 배포 (추천)

### 최초 1회 설정

1. vercel.com 회원가입 (GitHub 계정으로)
2. 터미널에서:
```bash
npm install -g vercel
cd ~/Documents/market-dashboard-v2
vercel
```
3. 질문에 답변:
   - Set up and deploy? → Y
   - Which scope? → 내 계정 선택
   - Link to existing project? → N
   - Project name? → market-dashboard-v2
   - Directory? → ./
4. 완료 후 URL 생성: `https://market-dashboard-v2.vercel.app`

### 환경변수 설정 (중요!)
1. vercel.com 대시보드 접속
2. 해당 프로젝트 클릭
3. Settings → Environment Variables
4. `.env` 파일의 키/값을 동일하게 입력:
   - `VITE_KIS_APP_KEY`
   - `VITE_KIS_APP_SECRET`
   - `VITE_NEWS_API_KEY`

### 이후 배포 (자동)
```bash
git add .
git commit -m "기능 추가"
git push origin main
# → Vercel이 자동으로 감지해서 빌드 + 배포
```

---

## 🔄 전체 개발 → 배포 흐름

```
1. 로컬에서 코드 작성
       ↓
2. npm run dev → localhost:5173 에서 확인
       ↓
3. git commit & push
       ↓
4. Vercel 자동 빌드 (2~3분)
       ↓
5. https://your-app.vercel.app 에서 누구나 접속
```

---

## ⚠️ 배포 전 체크리스트

- [ ] `npm run build` 에러 없이 완료되는가
- [ ] `.env` 파일이 GitHub에 올라가지 않았는가
- [ ] Vercel 환경변수에 키값이 입력되어 있는가
- [ ] `localhost:5173` 에서 정상 동작 확인했는가

---

## 🛠 빌드 에러 발생 시

```bash
# 빌드 테스트
npm run build

# 에러 메시지 확인 후 Claude Code에 붙여넣기
# "이 에러 해결해줘"
```
