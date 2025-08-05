import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { OpenAI } from 'openai';
import { initializeLegalDatabase, searchRelevantArticles } from './database/legal-database-simple';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// OpenAI API 설정
const OPENAI_API_KEY = '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';

if (!process.env.OPENAI_API_KEY) {
  console.log('⚠️  환경변수에서 OPENAI_API_KEY를 찾을 수 없어 기본값 사용 (데모용 - API 호출 실패 예상)');
}
console.log(`🔑 API 키 로드됨: ${OPENAI_API_KEY.length}자`);

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// 대화 세션 저장소 (인메모리)
const conversationHistory: { [sessionId: string]: Array<{ role: string; content: string }> } = {};

// 홈페이지 라우트 (랜딩페이지)
app.get('/', (req, res): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'landing.html'));
});

// 채팅 페이지 라우트
app.get('/chat', (req, res): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

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
    const searchResults = await searchRelevantArticles(message);
    
    // 컨텍스트 메시지 생성
    let contextMessage = `사용자 질문: "${message}"\n\n`;
    
    console.log(`🔍 검색 결과 길이: ${searchResults?.length || 0}자`);
    console.log(`🔍 검색 결과 내용: ${searchResults?.substring(0, 100)}...`);
    
    if (searchResults && searchResults.length > 0 && !searchResults.includes('관련 정보를 찾을 수 없습니다')) {
      // 검색 결과를 토큰 제한에 맞게 줄이기 (최대 2000자)
      const truncatedResults = searchResults.length > 2000 ? searchResults.substring(0, 2000) + '...' : searchResults;
      contextMessage += `🔍 **검색된 관련 정보**:\n${truncatedResults}\n\n`;
      contextMessage += `📋 **답변 지침**:\n1. 위 검색 결과를 반드시 참고하여 답변하세요\n2. 검색된 법령 조문이나 규정이 있으면 정확히 인용하세요\n3. 사용자 질문에 직접적으로 답변하세요\n4. 답변 형식: 질문 요약 → 관련 조항 안내 → 상세 설명 → 안내사항`;
      
      console.log(`✅ 검색 결과를 GPT에게 전달: ${truncatedResults.length}자`);
    } else {
      contextMessage += `⚠️ **관련 정보 없음**: 검색 결과를 찾지 못했습니다.\n\n📋 **답변 지침**:\n1. 질문 유형에 따라 적절히 답변하세요\n2. 직원 정보/사내 규정 질문: "해당 정보는 인사부서에서 확인하실 수 있습니다"라고 안내\n3. 법령 관련 질문: 일반적인 근로기준법 지식을 바탕으로 답변하고 정확한 조문을 찾지 못했음을 명시\n4. 모든 경우에 친절하고 도움이 되는 답변을 제공하세요`;
      
      console.log(`❌ 검색 결과 없음 - GPT에게 전달하지 않음`);
    }

    // 대화 히스토리에 사용자 메시지 추가
    conversationHistory[sessionId].push({ role: 'user', content: message });
    
    // 대화 히스토리가 너무 길면 최근 10개만 유지
    if (conversationHistory[sessionId].length > 20) {
      conversationHistory[sessionId] = conversationHistory[sessionId].slice(-20);
    }

    // OpenAI API 호출을 위한 메시지 배열 생성
    const messages = [
      { role: 'system', content: createSystemPrompt() },
      { role: 'system', content: contextMessage },
      ...conversationHistory[sessionId].slice(-5) // 최근 5개 메시지만 포함 (토큰 제한 해결)
    ];

    let botResponse = '';

        // OpenAI API 호출
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages as any,
        max_tokens: 1500,
        temperature: 0.3,
      });

      botResponse = completion.choices[0].message?.content || '죄송합니다. 응답을 생성할 수 없습니다.';

    } catch (apiError: any) {
      console.error('OpenAI API 오류:', apiError.message);
      
      // API 오류시 검색 결과라도 제공
      if (searchResults && searchResults.length > 0 && !searchResults.includes('관련 정보를 찾을 수 없습니다')) {
        botResponse = `🤖 **검색 결과**\n\n${searchResults}\n\n⚠️ OpenAI API에 문제가 있어 검색 결과만 제공합니다.`;
      } else {
        botResponse = `안녕하세요! 인사팀 MinSooBot입니다.\n\n궁금한 점이 있으시면 언제든지 물어보세요. 도와드리겠습니다!`;
      }
    }

    // 대화 히스토리에 봇 응답 추가
    conversationHistory[sessionId].push({ role: 'assistant', content: botResponse });

    res.json({ 
      success: true,
      message: botResponse,
      sessionId: sessionId
    });

  } catch (error: any) {
    console.error('서버 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
    });
  }
});

// 대화 히스토리 조회
app.get('/api/chat/history/:sessionId', (req, res): void => {
  const { sessionId } = req.params;
  const history = conversationHistory[sessionId] || [];
  
  res.json({
    success: true,
    history: history
  });
});

// 대화 히스토리 초기화
app.delete('/api/chat/history/:sessionId', (req, res): void => {
  const { sessionId } = req.params;
  delete conversationHistory[sessionId];
  
  res.json({
    success: true,
    message: '대화 히스토리가 초기화되었습니다.'
  });
});

// 서버 상태 확인
app.get('/api/health', (req, res): void => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 데이터베이스 상태 조회
app.get('/api/database/status', (req, res): void => {
  res.json({
    success: true,
    status: 'active',
    message: '텍스트 기반 검색 엔진 사용 중'
  });
});

// 검색 결과 테스트 API
app.get('/api/search/test', async (req, res): Promise<void> => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        error: '검색어를 입력해주세요. 예: ?query=출장비'
      });
      return;
    }
    
    console.log(`🔍 검색 테스트: "${query}"`);
    const searchResults = await searchRelevantArticles(query);
    
    res.json({
      success: true,
      query: query,
      searchResults: searchResults,
      resultsLength: searchResults.length,
      hasResults: searchResults !== '관련 정보를 찾을 수 없습니다. 다른 키워드로 다시 시도해주세요.'
    });
    
  } catch (error: any) {
    console.error('검색 테스트 오류:', error);
    res.status(500).json({
      success: false,
      error: '검색 중 오류가 발생했습니다.'
    });
  }
});

// 서버 시작
app.listen(PORT, async () => {
  console.log(`🤖 MinSooBot이 http://localhost:${PORT}에서 실행 중입니다.`);
  console.log(`🌐 웹 상담봇: http://localhost:${PORT}`);
  console.log(`📝 API 문서:`);
  console.log(`  POST /api/chat/start - 새 대화 시작`);
  console.log(`  POST /api/chat/message - 메시지 전송`);
  console.log(`  GET /api/chat/history/:sessionId - 대화 히스토리`);
  console.log(`  DELETE /api/chat/history/:sessionId - 대화 히스토리 초기화`);
  console.log(`  GET /api/health - 서버 상태 확인`);
  console.log(`  GET /api/vector/stats - 벡터 엔진 통계`);
  
  // 백그라운드에서 데이터베이스 초기화 (서버 시작을 블록하지 않음)
  console.log('🔄 데이터베이스 초기화를 백그라운드에서 시작합니다...');
  initializeLegalDatabase().then(() => {
    console.log('✅ 데이터베이스 초기화 완료!');
  }).catch((error) => {
    console.error('❌ 데이터베이스 초기화 실패:', error);
  });
}); 