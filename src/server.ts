import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { OpenAI } from 'openai';
import { initializeLegalDatabase, searchRelevantArticles } from './database/legal-database-simple';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// OpenAI API 설정
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.log('⚠️  환경변수에서 OPENAI_API_KEY를 찾을 수 없습니다. Vercel 환경변수를 설정해주세요.');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// 대화 세션 저장소 (인메모리) - 타입 수정
const conversationHistory: { [sessionId: string]: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> } = {};

// 시스템 프롬프트 생성 함수
function createSystemPrompt(): string {
  const now = new Date();
  const timeGreeting = now.getHours() < 12 ? '좋은 아침입니다' : 
                      now.getHours() < 18 ? '안녕하세요' : '좋은 저녁입니다';
  
  return `
${timeGreeting}! 저는 "인사 도우미"입니다. 

📌 제 역할
- 회사 직원 정보, 사내 규정, 부속규정에 대한 문의를 처리합니다
- 근로기준법, 시행령, 시행규칙의 관련 조항을 찾아 요약하고 설명드립니다
- 검색된 정보를 바탕으로 최선을 다해 답변합니다
- 법률 자문이 아닌 정보 제공만 수행합니다

📌 응답 구조
1. **질문 요약**: 사용자 질문 내용을 한 문장으로 요약
2. **관련 정보 안내**: 법령 조문, 사내 규정, 직원 정보 등 관련 내용
3. **상세 설명**: 상황에 맞는 핵심 내용을 쉽게 설명
4. **안내사항**: 법령 관련 질문인 경우에만 포함

📌 안내사항 (법령 관련 질문인 경우에만 포함)
"이 답변은 법률 자문이 아닌 참고용 안내입니다. 정확한 해석이나 적용은 고용노동부 또는 공인노무사와 상담하시기 바랍니다."

현재 시각: ${now.toLocaleString('ko-KR')}
`;
}

// 새 대화 시작
app.post('/api/chat/start', (req, res): void => {
  const sessionId = Date.now().toString();
  conversationHistory[sessionId] = [];
  
  res.json({
    success: true,
    sessionId: sessionId,
    message: '새로운 상담 세션이 시작되었습니다.'
  });
});

// 메시지 전송 및 응답
app.post('/api/chat/message', async (req, res): Promise<void> => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      res.status(400).json({ 
        success: false, 
        error: '메시지와 세션 ID가 필요합니다.' 
      });
      return;
    }

    // 현재 세션이 없으면 생성
    if (!conversationHistory[sessionId]) {
      conversationHistory[sessionId] = [];
    }

    // 벡터 기반 검색으로 관련 정보 찾기
    const relevantInfo = await searchRelevantArticles(message);
    
    // 대화 히스토리에 사용자 메시지 추가
    conversationHistory[sessionId].push({ role: 'user', content: message });

    // 시스템 프롬프트와 관련 정보를 결합한 프롬프트 생성
    const systemPrompt = createSystemPrompt();
    const contextPrompt = relevantInfo.length > 0 
      ? `\n\n관련 정보:\n${relevantInfo.join('\n\n')}` 
      : '';

    // OpenAI API 호출 - 타입 수정
    const systemMessage = { role: 'system' as 'system', content: systemPrompt + contextPrompt };
    const conversationMessages = conversationHistory[sessionId].map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    })) as any;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [systemMessage, ...conversationMessages] as any,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const assistantResponse = completion.choices[0]?.message?.content || '죄송합니다. 응답을 생성할 수 없습니다.';
    
    // 대화 히스토리에 어시스턴트 응답 추가
    conversationHistory[sessionId].push({ role: 'assistant', content: assistantResponse });

    res.json({
      success: true,
      response: assistantResponse,
      sessionId: sessionId
    });

  } catch (error) {
    console.error('채팅 처리 중 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// 홈페이지 라우트 (랜딩페이지)
app.get('/', (req, res): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'landing.html'));
});

// 채팅 페이지 라우트
app.get('/chat', (req, res): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 서버 시작
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  });
}

export default app; 