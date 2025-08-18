# Bot - 인사/노무 상담 도우미

GPT API를 이용한 웹 챗봇으로, 근로기준법, 사내 규정, 직원 정보에 대한 문의를 처리합니다.

## 주요 기능

- **법령 정보**: 근로기준법 62개 조문 검색 및 설명
- **직원 정보**: 회사 직원들의 부서, 직급, 연락처 조회
- **사내 규정**: 출장비, 재택근무, 교육훈련 등 규정 안내
- **AI 응답**: 구조화된 답변 (질문 요약, 관련 정보, 상세 설명)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## 사용 방법

1. **홈페이지** (`/`): 서비스 소개 및 기능 안내
2. **채팅 페이지** (`/chat`): Bot과 대화 시작
3. **질문 예시**:
   - "연차 유급휴가는 어떻게 계산되나요?"
   - "김민수 차장의 연락처가 궁금해요"
   - "출장비 지급 기준은 어떻게 되나요?"

## 프로젝트 구조

```
minsu-bot/
├── src/
│   ├── server.ts              # Express 서버
│   └── database/
│       └── legal-database.ts  # 법령 데이터베이스
├── public/
│   ├── index.html             # 채팅 페이지
│   ├── landing.html           # 랜딩 페이지
│   └── legal-ui.css          # 스타일시트
├── package.json               # 프로젝트 설정
├── tsconfig.json             # TypeScript 설정
└── vercel.json               # Vercel 배포 설정
```

## 환경 변수

```env
OPENAI_API_KEY=your_openai_api_key_here
```

## 배포

- **Vercel**: 자동 배포 지원
- **로컬**: `npm run dev`로 개발 서버 실행

## 주의사항

이 서비스는 **법률 자문이 아닌 참고용 안내**입니다.
정확한 해석이나 적용은 고용노동부 또는 공인노무사와 상담하시기 바랍니다.

## 라이선스

MIT License

## 개발자

ByeonMinSoo 