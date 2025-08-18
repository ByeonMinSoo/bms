import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { OpenAI } from 'openai';
import { simpleVectorDatabase } from './database/simple-vector-database';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 보안 미들웨어 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// OpenAI API 키 검증 및 설정
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ OpenAI API 키가 설정되지 않았습니다. .env 파일에 OPENAI_API_KEY를 설정해주세요.');
  process.exit(1);
}

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// 보안 설정
const API_KEY = process.env.API_KEY || 'default-secure-key-2024';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'admin-secure-key-2024';

// API 키 검증 미들웨어
const validateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey || apiKey !== API_KEY) {
    res.status(401).json({ 
      error: '인증 실패', 
      message: '유효한 API 키가 필요합니다.' 
    });
    return;
  }
  
  next();
};

// 관리자 권한 검증 미들웨어
const validateAdminKey = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const adminKey = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!adminKey || adminKey !== ADMIN_API_KEY) {
    res.status(403).json({ 
      error: '권한 없음', 
      message: '관리자 권한이 필요합니다.' 
    });
    return;
  }
  
  next();
};

// 고급 대화 세션 관리
interface ConversationSession {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }>;
  context: {
    mentionedEmployees: string[];
    mentionedDepartments: string[];
    lastAnalysisType?: string;
    userPreferences?: {
      responseStyle: 'detailed' | 'concise' | 'analytical';
      favoriteTopics: string[];
    };
  };
  metadata: {
    totalQueries: number;
    lastActivity: number;
    sessionQuality: number;
  };
}

const conversationSessions: { [sessionId: string]: ConversationSession } = {};

// 피드백 저장소
interface FeedbackEntry {
  query: string;
  response: string;
  feedback: 'excellent' | 'good' | 'average' | 'poor';
  timestamp: number;
  sessionId: string;
}

const feedbackHistory: FeedbackEntry[] = [];

// 학습된 패턴 저장소
const learnedPatterns: {
  successfulResponses: Map<string, number>;
  commonQueries: Map<string, number>;
  userPreferences: Map<string, any>;
} = {
  successfulResponses: new Map(),
  commonQueries: new Map(),
  userPreferences: new Map()
};

// 🧠 고급 시스템 프롬프트 생성
function createEnhancedSystemPrompt(): string {
  const now = new Date();
  const timeGreeting = now.getHours() < 12 ? '좋은 아침입니다' : 
                      now.getHours() < 18 ? '안녕하세요' : '좋은 저녁입니다';
  
  return `
${timeGreeting}! 저는 차세대 "인사 도우미 AI"입니다. 

🎯 핵심 역할 및 고급 능력:
- 회사 직원 정보, 사내 규정, 부속규정에 대한 종합적 분석 및 상담
- 근로기준법, 시행령, 시행규칙의 심층 분석 및 실무 적용 가이드
- 직원 연차 사용 패턴 분석 및 최적화 제안
- 조직 데이터의 숨겨진 인사이트 발굴 및 예측 분석
- 상황별 맞춤형 HR 컨설팅 및 의사결정 지원

🧠 고급 분석 능력:
1. **패턴 인식**: 직원 데이터에서 트렌드, 상관관계, 이상 징후 탐지
2. **예측 분석**: 연차 사용 패턴, 이직 가능성, 조직 변화 예측
3. **비교 분석**: 부서간, 직급간, 시기별 다차원 비교
4. **최적화 제안**: 인력 배치, 연차 운영, 조직 효율성 개선안
5. **리스크 분석**: 인사 관련 잠재적 문제점 및 대응방안

💡 지능형 응답 방식:
1. **상황 인식**: 사용자의 질문 의도와 배경 상황 파악
2. **다단계 추론**: 표면적 답변을 넘어 근본 원인과 해결책 제시
3. **개인화**: 이전 대화 맥락과 사용자 선호도 반영
4. **능동적 제안**: 질문 외 관련된 유용한 정보나 개선안 제시
5. **검증 및 확신도**: 답변의 확실성 수준과 추가 검증 방법 안내

🔍 고급 검색 및 분석 방법:
- 직원 정보: 이름, 부서, 직급, 연락처 등 종합 검색
- 연차 관리: 개인별/부서별 사용 패턴 분석 및 최적화
- 조직 분석: 부서별 성과, 연봉 분포, 승진 패턴 등
- 법령 해석: 상황별 적용 조항 및 실무 가이드

📊 응답 구조 (상황별 조정):
1. **핵심 답변**: 질문의 직접적 해답
2. **심층 분석**: 데이터 기반 인사이트 및 패턴
3. **실무 가이드**: 구체적 실행 방법 및 주의사항
4. **연관 정보**: 관련된 추가 유용 정보
5. **제안 사항**: 개선안 및 최적화 방안

⚠️ 중요 원칙:
- 실제 데이터 우선: 검색된 실제 데이터를 항상 최우선으로 활용
- 정확성 보장: 추측보다는 확실한 정보 제공
- 개인정보 보호: 민감한 개인정보는 적절히 마스킹
- 실용성 중시: 이론보다는 실무 적용 가능한 답변
- 지속적 학습: 사용자 피드백을 통한 응답 품질 개선

현재 시간: ${now.toLocaleString('ko-KR')}
`;
}

// 사용자 의도 분석 함수
function analyzeUserIntent(message: string): {
  type: 'employee_search' | 'annual_leave' | 'policy_search' | 'inference_analysis' | 'general_inquiry';
  query: string;
  confidence: number;
  entities: string[];
} {
  const messageLower = message.toLowerCase();
  let type: any = 'general_inquiry';
  let confidence = 0.5;
  const entities: string[] = [];

  // 추론 분석 의도 (가장 우선 처리)
  if (messageLower.includes('가장') || messageLower.includes('제일') || messageLower.includes('1위') ||
      messageLower.includes('비교') || messageLower.includes('어느') || messageLower.includes('어떤') ||
      messageLower.includes('높은') || messageLower.includes('많은') || messageLower.includes('큰') ||
      messageLower.includes('순위') || messageLower.includes('분석') || messageLower.includes('패턴') ||
      messageLower.includes('트렌드') || messageLower.includes('통계') || messageLower.includes('평균') ||
      messageLower.includes('최고') || messageLower.includes('최저') || messageLower.includes('분포')) {
    type = 'inference_analysis';
    confidence = 0.95;
  }
  // 직원 검색 의도
  else if (messageLower.includes('직원') || messageLower.includes('사원') || messageLower.includes('이름') ||
           messageLower.includes('부서') || messageLower.includes('직급') || messageLower.includes('연락처') ||
           messageLower.includes('이메일') || messageLower.includes('사번') || messageLower.includes('입사일')) {
    type = 'employee_search';
    confidence = 0.9;
  }
  // 연차 관리 의도
  else if (messageLower.includes('연차') || messageLower.includes('휴가') || messageLower.includes('휴일') ||
           messageLower.includes('병가') || messageLower.includes('반차') || messageLower.includes('월차') ||
           messageLower.includes('연차신청') || messageLower.includes('연차취소') || messageLower.includes('잔여연차')) {
    type = 'annual_leave';
    confidence = 0.9;
  }
  // 정책 검색 의도
  else if (messageLower.includes('정책') || messageLower.includes('규정') || messageLower.includes('법령') ||
           messageLower.includes('근로기준법') || messageLower.includes('시행령') || messageLower.includes('시행규칙') ||
           messageLower.includes('규칙') || messageLower.includes('지침') || messageLower.includes('매뉴얼')) {
    type = 'policy_search';
    confidence = 0.85;
  }

  // 엔티티 추출
  const nameMatch = message.match(/[가-힣]{2,4}(?:씨|님)?/g);
  if (nameMatch) entities.push(...nameMatch);

  const deptMatch = message.match(/[가-힣]+부/g);
  if (deptMatch) entities.push(...deptMatch);

  return { type, query: message, confidence, entities };
}

// 추론 분석 함수
function performInferenceAnalysis(employees: any[], _query: string): string {
  try {
    if (employees.length === 0) return '분석할 직원 데이터가 없습니다.';

    const analysis = {
      totalEmployees: employees.length,
      departments: new Map<string, number>(),
      positions: new Map<string, number>(),
      salaryRanges: new Map<string, number>(),
      hireYears: new Map<string, number>()
    };

    employees.forEach(emp => {
      // 부서별 통계
      if (emp.department) {
        analysis.departments.set(emp.department, (analysis.departments.get(emp.department) || 0) + 1);
      }

      // 직급별 통계
      if (emp.position) {
        analysis.positions.set(emp.position, (analysis.positions.get(emp.position) || 0) + 1);
      }

      // 연봉 구간별 통계
      if (emp.salary) {
        const salary = parseInt(emp.salary.replace(/[^0-9]/g, ''));
        if (!isNaN(salary)) {
          const range = Math.floor(salary / 1000) * 1000;
          const rangeKey = `${range}만원대`;
          analysis.salaryRanges.set(rangeKey, (analysis.salaryRanges.get(rangeKey) || 0) + 1);
        }
      }

      // 입사년도별 통계
      if (emp.hireDate) {
        const year = emp.hireDate.split('-')[0];
        if (year) {
          analysis.hireYears.set(year, (analysis.hireYears.get(year) || 0) + 1);
        }
      }
    });

    let result = `📊 조직 분석 결과 (총 ${analysis.totalEmployees}명)\n\n`;

    // 부서별 분석
    if (analysis.departments.size > 0) {
      const sortedDepts = Array.from(analysis.departments.entries())
        .sort((a, b) => b[1] - a[1]);
      result += `🏢 부서별 인원:\n`;
      sortedDepts.forEach(([dept, count]) => {
        result += `  • ${dept}: ${count}명 (${((count / analysis.totalEmployees) * 100).toFixed(1)}%)\n`;
      });
      result += '\n';
    }

    // 직급별 분석
    if (analysis.positions.size > 0) {
      const sortedPositions = Array.from(analysis.positions.entries())
        .sort((a, b) => b[1] - a[1]);
      result += `👔 직급별 인원:\n`;
      sortedPositions.forEach(([pos, count]) => {
        result += `  • ${pos}: ${count}명 (${((count / analysis.totalEmployees) * 100).toFixed(1)}%)\n`;
      });
      result += '\n';
    }

    // 연봉 분석
    if (analysis.salaryRanges.size > 0) {
      const sortedSalaries = Array.from(analysis.salaryRanges.entries())
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
      result += `💰 연봉 분포:\n`;
      sortedSalaries.forEach(([range, count]) => {
        result += `  • ${range}: ${count}명\n`;
      });
      result += '\n';
    }

    // 입사년도 분석
    if (analysis.hireYears.size > 0) {
      const sortedYears = Array.from(analysis.hireYears.entries())
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
      result += `📅 입사년도별 분포:\n`;
      sortedYears.forEach(([year, count]) => {
        result += `  • ${year}년: ${count}명\n`;
      });
    }

    return result;
  } catch (error) {
    console.error('추론 분석 중 오류:', error);
    return '분석 중 오류가 발생했습니다.';
  }
}

// 직원 데이터 포맷팅 함수
function formatEmployeeData(employees: any[]): string {
  if (employees.length === 1) {
    const emp = employees[0];
    return `직원 정보:\n이름: ${emp.name}\n직급: ${emp.position}\n부서: ${emp.department}\n이메일: ${emp.email}\n연락처: ${emp.phone}\n입사일: ${emp.hireDate}\n사번: ${emp.employeeNumber}`;
  } else {
    // 직원 번호가 100을 초과하지 않도록 검증
    const validEmployees = employees.filter(emp => {
      if (emp.name && emp.name.startsWith('직원')) {
        const numberPart = emp.name.substring(2); // "직원" 제거
        const employeeNumber = parseInt(numberPart);
        return !isNaN(employeeNumber) && employeeNumber <= 100;
      }
      return true; // 실제 이름이 있는 직원은 통과
    });

    return `검색 결과 (${validEmployees.length}명):\n${validEmployees.map(emp => 
      `${emp.name} ${emp.position} (${emp.department}) - ${emp.email}`
    ).join('\n')}`;
  }
}

// 연차 데이터 포맷팅 함수
function formatAnnualLeaveData(annualLeaveRecords: any[]): string {
  if (annualLeaveRecords.length === 0) {
    return '연차 기록이 없습니다.';
  }

  let result = `연차 기록 (${annualLeaveRecords.length}건):\n\n`;
  
  annualLeaveRecords.forEach((record, index) => {
    result += `${index + 1}. ${record.employeeName} (${record.employeeId})\n`;
    result += `   • 연차 유형: ${record.leaveType}\n`;
    result += `   • 신청일: ${record.requestDate}\n`;
    result += `   • 사용일: ${record.leaveDate}\n`;
    result += `   • 상태: ${record.status}\n`;
    if (record.reason) result += `   • 사유: ${record.reason}\n`;
    result += '\n';
  });

  return result;
}

// 메인 챗봇 API 엔드포인트
app.post('/api/chat/message', validateApiKey, async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '메시지가 필요합니다.' });
    }

    // 세션 초기화 또는 가져오기
    if (!conversationSessions[sessionId]) {
      conversationSessions[sessionId] = {
        messages: [],
        context: {
          mentionedEmployees: [],
          mentionedDepartments: [],
        },
        metadata: {
          totalQueries: 0,
          lastActivity: Date.now(),
          sessionQuality: 100
        }
      };
    }

    const session = conversationSessions[sessionId];
    session.messages.push({ role: 'user', content: message, timestamp: Date.now() });
    session.metadata.totalQueries++;
    session.metadata.lastActivity = Date.now();

    // 사용자 의도 분석
    const userIntent = analyzeUserIntent(message);
    let relevantData = '';
    let dataSource = '';

    // 의도에 따른 데이터 검색
    if (userIntent.type === 'inference_analysis') {
      const employees = await simpleVectorDatabase.getAllEmployees();
      if (employees.length > 0) {
        relevantData = performInferenceAnalysis(employees, userIntent.query);
        dataSource = '직원 데이터베이스 분석';
      }
    } else if (userIntent.type === 'employee_search') {
      const employees = await simpleVectorDatabase.searchEmployees(userIntent.query);
      if (employees.length > 0) {
        relevantData = formatEmployeeData(employees);
        dataSource = '직원 데이터베이스';
      }
    } else if (userIntent.type === 'annual_leave') {
      const annualLeaveRecords = await simpleVectorDatabase.searchAnnualLeave(userIntent.query);
      if (annualLeaveRecords.length > 0) {
        relevantData = formatAnnualLeaveData(annualLeaveRecords);
        dataSource = '연차 데이터베이스';
      }
    }

    // 컨텍스트 프롬프트 생성
    const contextPrompt = relevantData ? 
      `\n\n📊 관련 데이터 (${dataSource}):\n${relevantData}\n\n위 데이터를 바탕으로 정확하고 구체적인 답변을 제공해주세요.` : '';

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: createEnhancedSystemPrompt() },
        { role: 'system', content: contextPrompt },
        ...session.messages.slice(-6).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const aiResponse = completion.choices[0]?.message?.content || '죄송합니다. 응답을 생성할 수 없습니다.';

    // OpenAI API 응답이 일반적인 답변인 경우 실제 데이터로 대체
    if (relevantData && !aiResponse.includes('데이터') && !aiResponse.includes('검색') && !aiResponse.includes('분석')) {
      const enhancedResponse = `${aiResponse}\n\n${relevantData}`;
      session.messages.push({ role: 'assistant', content: enhancedResponse, timestamp: Date.now() });
      res.json({ response: enhancedResponse, sessionId, dataSource });
    } else {
      session.messages.push({ role: 'assistant', content: aiResponse, timestamp: Date.now() });
      res.json({ response: aiResponse, sessionId, dataSource });
    }

  } catch (error) {
    console.error('챗봇 API 오류:', error);
    res.status(500).json({ 
      error: '서버 오류', 
      message: '요청을 처리하는 중 오류가 발생했습니다.' 
    });
  }
});

// 새 상담 세션 시작
app.post('/api/chat/start', validateApiKey, (_req, res) => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  conversationSessions[sessionId] = {
    messages: [],
    context: {
      mentionedEmployees: [],
      mentionedDepartments: [],
    },
    metadata: {
      totalQueries: 0,
      lastActivity: Date.now(),
      sessionQuality: 100
    }
  };

  res.json({ 
    sessionId, 
    message: '새 상담 세션이 시작되었습니다.',
    timestamp: new Date().toISOString()
  });
});

// 보안된 직원 검색 API
app.get('/api/employees/search', validateApiKey, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '검색어가 필요합니다.' });
    }

    const employees = await simpleVectorDatabase.searchEmployees(query);
    
    // 민감 정보 필터링
    const filteredEmployees = employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      position: emp.position,
      department: emp.department,
      email: emp.email ? `${emp.email.split('@')[0]}@***` : '', // 이메일 마스킹
      phone: emp.phone ? `${emp.phone.substring(0, 3)}-****-${emp.phone.substring(7)}` : '', // 전화번호 마스킹
      hireDate: emp.hireDate,
      employeeNumber: emp.employeeNumber
    }));

    res.json({ 
      success: true, 
      employees: filteredEmployees, 
      total: filteredEmployees.length 
    });
  } catch (error) {
    console.error('직원 검색 오류:', error);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

// 보안된 연차 검색 API
app.get('/api/annual-leave/search', validateApiKey, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '검색어가 필요합니다.' });
    }

    const records = await simpleVectorDatabase.searchAnnualLeave(query);
    
    // 개인정보 마스킹
    const maskedRecords = records.map(record => ({
      ...record,
      employeeName: record.employeeName ? `${record.employeeName.charAt(0)}***` : '',
      employeeId: record.employeeId
    }));

    res.json({ 
      success: true, 
      records: maskedRecords, 
      total: maskedRecords.length 
    });
  } catch (error) {
    console.error('연차 검색 오류:', error);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

// 관리자 전용 API - 전체 통계
app.get('/api/admin/statistics', validateAdminKey, async (_req, res) => {
  try {
    const employees = await simpleVectorDatabase.getAllEmployees();
    const totalEmployees = employees.length;
    
    const stats = {
      totalEmployees,
      totalSessions: Object.keys(conversationSessions).length,
      totalFeedback: feedbackHistory.length,
      systemHealth: '정상',
      lastUpdated: new Date().toISOString()
    };

    res.json({ success: true, statistics: stats });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// 피드백 저장 API
app.post('/api/feedback', validateApiKey, (req, res) => {
  try {
    const { query, response, feedback, sessionId } = req.body;
    
    if (!query || !response || !feedback) {
      return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
    }

    const feedbackEntry: FeedbackEntry = {
      query,
      response,
      feedback,
      timestamp: Date.now(),
      sessionId: sessionId || 'unknown'
    };

    feedbackHistory.push(feedbackEntry);
    
    // 학습된 패턴 업데이트
    if (feedback === 'excellent' || feedback === 'good') {
      const patternKey = query.toLowerCase().substring(0, 50);
      learnedPatterns.successfulResponses.set(
        patternKey, 
        (learnedPatterns.successfulResponses.get(patternKey) || 0) + 1
      );
    }

    res.json({ success: true, message: '피드백이 저장되었습니다.' });
  } catch (error) {
    console.error('피드백 저장 오류:', error);
    res.status(500).json({ error: '피드백 저장 중 오류가 발생했습니다.' });
  }
});

// 서버 상태 확인 API
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0'
  });
});

// 404 처리
app.use('*', (_req, res) => {
  res.status(404).json({ 
    error: '페이지를 찾을 수 없습니다.',
    message: '요청하신 API 엔드포인트가 존재하지 않습니다.'
  });
});

// 전역 에러 핸들러
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('서버 오류:', error);
  res.status(500).json({ 
    error: '내부 서버 오류',
    message: '요청을 처리하는 중 오류가 발생했습니다.'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 보안 강화된 챗봇 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`🔒 API 키 인증이 활성화되었습니다.`);
  console.log(`📊 관리자 대시보드: /api/admin/statistics`);
  console.log(`💬 챗봇 API: /api/chat/message`);
});

export default app; 