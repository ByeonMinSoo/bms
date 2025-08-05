# TS Chatbot - Vercel 배포 가이드

## 프로젝트 소개
민수bot - GPT API를 이용한 웹 챗봇입니다. 회사 직원 정보, 사내 규정, 근로기준법 등에 대한 문의를 처리합니다.

## Vercel 배포 방법

### 1. 사전 준비
- Vercel 계정이 필요합니다 (https://vercel.com)
- GitHub/GitLab/Bitbucket에 코드가 업로드되어 있어야 합니다

### 2. 환경 변수 설정
Vercel 대시보드에서 다음 환경 변수를 설정하세요:

```
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=production
```

### 3. 배포 단계

1. **Vercel CLI 설치** (선택사항)
   ```bash
   npm i -g vercel
   ```

2. **프로젝트 연결**
   - Vercel 대시보드에서 "New Project" 클릭
   - GitHub 저장소 연결
   - 프로젝트 설정 확인

3. **자동 배포**
   - 코드를 GitHub에 푸시하면 자동으로 배포됩니다
   - 또는 Vercel CLI 사용:
   ```bash
   vercel
   ```

### 4. 로컬 개발
```bash
npm install
npm run dev
```

### 5. 빌드 및 배포
```bash
npm run build
npm run deploy
```

## 프로젝트 구조
```
ts-chatbot/
├── api/                 # Vercel API 라우트
│   └── index.ts        # 메인 API 핸들러
├── src/                # 소스 코드
│   ├── database/       # 데이터베이스 관련
│   ├── engines/        # 벡터 엔진
│   └── utils/          # 유틸리티
├── public/             # 정적 파일
├── dataset/            # 데이터셋
├── vercel.json         # Vercel 설정
└── package.json        # 프로젝트 설정
```

## API 엔드포인트
- `GET /` - 랜딩 페이지
- `GET /chat` - 채팅 페이지
- `POST /api/chat/start` - 새 대화 시작
- `POST /api/chat/message` - 메시지 전송

## 주의사항
- OpenAI API 키는 반드시 환경 변수로 설정하세요
- 대화 세션은 인메모리로 저장되므로 서버 재시작 시 초기화됩니다
- 프로덕션 환경에서는 데이터베이스 사용을 권장합니다

## 문제 해결
- 배포 실패 시 Vercel 로그를 확인하세요
- 환경 변수가 올바르게 설정되었는지 확인하세요
- API 키가 유효한지 확인하세요 