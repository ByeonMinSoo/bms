import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { OpenAI } from 'openai';
import { simpleVectorDatabase } from './database/simple-vector-database';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// OpenAI API 키를 환경 변수에서 가져오기
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "your-api-key-here";

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// 대화 세션 저장소 (인메모리)
const conversationHistory: { [sessionId: string]: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> } = {};

// System prompt creation function
function createSystemPrompt(): string {
  const now = new Date();
  const timeGreeting = now.getHours() < 12 ? '좋은 아침입니다' : 
                      now.getHours() < 18 ? '안녕하세요' : '좋은 저녁입니다';
  
  return `
${timeGreeting}! 저는 "인사 도우미"입니다. 

제 역할
- 회사 직원 정보, 사내 규정, 부속규정에 대한 문의를 처리합니다
- 근로기준법, 시행령, 시행규칙의 관련 조항을 찾아 요약하고 설명드립니다
- 직원 연차 사용 현황, 남은 연차 일수, 사용 이력을 조회하고 안내합니다
- 검색된 정보를 바탕으로 최선을 다해 답변합니다
- 법률 자문이 아닌 정보 제공만 수행합니다

응답 구조
1. **질문 요약**: 사용자 질문 내용을 한 문장으로 요약
2. **관련 정보 안내**: 법령 조문, 사내 규정, 직원 정보, 연차 정보 등 관련 내용
3. **상세 설명**: 상황에 맞는 핵심 내용을 쉽게 설명
4. **안내사항**: 법령 관련 질문인 경우에만 포함

중요한 원칙
- 실제 데이터가 있는 경우 반드시 해당 데이터를 우선적으로 사용하여 답변
- 데이터가 없는 경우에만 일반적인 정보 제공
- 추측성 답변을 피하고 구체적이고 정확한 정보 제공
- 법률 관련 질문이 아닌 경우에는 "법률 자문이 아닌 참고용 안내" 문구를 포함하지 않음
- 직원 정보(이름, 부서, 연락처, 이메일 등)는 회사 내부 정보이므로 누구나 조회 가능
- 개인정보 보호 관련 잘못된 안내를 하지 않음

연차 관련 질문 처리 방법
- "김민수의 연차가 얼마나 남았어?" → 직원 이름으로 연차 정보 조회
- "내가 언제 연차를 썼지?" → 직원 이름으로 연차 사용 이력 조회
- "연차 사용 현황" → 전체 연차 데이터 요약
- "김민수가 4월 15일에 연차쓸게" → 연차 사용 등록
- "김민수가 4월 15일 연차 취소해줘" → 연차 사용 취소

직원 정보 검색 방법
- "김영희 차장 연락처" → 직원 이름으로 상세 정보 검색
- "개발팀 직원들" → 부서별 직원 목록 검색
- "김민수 정보" → 특정 직원의 모든 정보 조회

안내사항 (법령 관련 질문인 경우에만 포함)
"이 답변은 법률 자문이 아닌 참고용 안내입니다. 정확한 해석이나 적용은 고용노동부 또는 공인노무사와 상담하시기 바랍니다."

현재 시각: ${now.toLocaleString('ko-KR')}
`;
}

// 새 대화 시작
app.post('/api/chat/start', (_req, res): void => {
  const sessionId = Date.now().toString();
  conversationHistory[sessionId] = [];
  
  res.json({
    success: true,
    sessionId: sessionId,
    message: '새로운 상담 세션이 시작되었습니다.'
  });
});

// Send message and get response
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

    // Create session if it doesn't exist
    if (!conversationHistory[sessionId]) {
      conversationHistory[sessionId] = [];
    }

    // 연차 관련 질문 감지 및 처리
    let annualLeaveInfo = '';
    let employeeInfo = ''; // 직원 정보 추가
    const messageLower = message.toLowerCase();
    
    // 직원 정보 검색 요청 감지
    if (messageLower.includes('연락처') || messageLower.includes('정보') || messageLower.includes('직원') || 
        messageLower.includes('차장') || messageLower.includes('부장') || messageLower.includes('팀장') ||
        messageLower.includes('이메일') || messageLower.includes('전화번호')) {
        
        // 직원 이름 추출 (더 정확한 매칭)
        let employeeName = '';
        if (messageLower.includes('김영희') || messageLower.includes('영희')) {
            employeeName = '김영희';
        } else if (messageLower.includes('김민수') || messageLower.includes('민수')) {
            employeeName = '김민수';
        } else if (messageLower.includes('박철수') || messageLower.includes('철수')) {
            employeeName = '박철수';
        } else if (messageLower.includes('최정숙')) {
            employeeName = '최정숙';
        } else if (messageLower.includes('김예지')) {
            employeeName = '김예지';
        }
        
        if (employeeName) {
            // 직원 정보 검색 (이름으로 정확히 검색)
            const employees = await simpleVectorDatabase.searchEmployees(employeeName, 5);
            if (employees.length > 0) {
                const emp = employees.find(e => e.name === employeeName) || employees[0];
                employeeInfo = `\n\n직원 정보:\n${emp.name} ${emp.position}\n부서: ${emp.department}\n이메일: ${emp.email}\n연락처: ${emp.phone}\n입사일: ${emp.hireDate}`;
            }
        }
        
        // 부서별 직원 검색
        if (messageLower.includes('부서') || messageLower.includes('개발팀') || messageLower.includes('인사팀') || 
            messageLower.includes('마케팅팀') || messageLower.includes('IT팀') || messageLower.includes('영업팀')) {
            let department = '';
            if (messageLower.includes('개발팀')) department = '개발팀';
            else if (messageLower.includes('인사팀')) department = '인사팀';
            else if (messageLower.includes('마케팅팀')) department = '마케팅팀';
            else if (messageLower.includes('IT팀')) department = 'IT팀';
            else if (messageLower.includes('영업팀')) department = '영업팀';
            
            if (department) {
                const deptEmployees = await simpleVectorDatabase.searchEmployees(department, 10);
                if (deptEmployees.length > 0) {
                    employeeInfo = `\n\n${department} 직원 목록:\n${deptEmployees.map(emp => 
                        `${emp.name} ${emp.position} (${emp.email})`
                    ).join('\n')}`;
                }
            }
        }
        
        // 직급별 검색
        if (messageLower.includes('차장') || messageLower.includes('부장') || messageLower.includes('과장') || 
            messageLower.includes('대리') || messageLower.includes('사원')) {
            let position = '';
            if (messageLower.includes('차장')) position = '차장';
            else if (messageLower.includes('부장')) position = '부장';
            else if (messageLower.includes('과장')) position = '과장';
            else if (messageLower.includes('대리')) position = '대리';
            else if (messageLower.includes('사원')) position = '사원';
            
            if (position) {
                const posEmployees = await simpleVectorDatabase.searchEmployees(position, 15);
                if (posEmployees.length > 0) {
                    employeeInfo = `\n\n${position} 직원 목록:\n${posEmployees.map(emp => 
                        `${emp.name} (${emp.department}) - ${emp.email}`
                    ).join('\n')}`;
                }
            }
        }
    }
    
    if (messageLower.includes('연차') || messageLower.includes('휴가') || messageLower.includes('남았') || messageLower.includes('사용')) {
      // 연차 사용 등록 요청 감지
      if (messageLower.includes('쓸게') || messageLower.includes('신청') || messageLower.includes('등록')) {
        const dateMatch = message.match(/(\d{1,2})월\s*(\d{1,2})일/);
        const employeeNumberMatch = message.match(/사번[:\s]*(\d+)/);
        
        if (dateMatch) {
            const month = dateMatch[1].padStart(2, '0');
            const day = dateMatch[2].padStart(2, '0');
            const useDate = `2025-${month}-${day}`;
            let employeeName = '';
            let employeeNumber = '';
            
            if (messageLower.includes('김민수') || messageLower.includes('민수')) { employeeName = '김민수'; }
            else if (messageLower.includes('이영희') || messageLower.includes('영희')) { employeeName = '이영희'; }
            else if (messageLower.includes('박철수') || messageLower.includes('철수')) { employeeName = '박철수'; }

            if (employeeNumberMatch) {
                employeeNumber = employeeNumberMatch[1];
            }

            if (employeeName && employeeNumber) {
                const result = await simpleVectorDatabase.registerAnnualLeaveUse(employeeName, employeeNumber, useDate);
                if (result.success) { annualLeaveInfo = `\n\n연차 사용 등록 완료!\n${result.message}`; }
                else { annualLeaveInfo = `\n\n연차 사용 등록 실패: ${result.message}`; }
            } else if (employeeName && !employeeNumber) {
                annualLeaveInfo = `\n\n연차 사용 등록을 위해서는 사번을 명시해주세요.\n예시: "김민수가 4월 15일에 연차쓸게 사번:123456"`;
            } else if (!employeeName && employeeNumber) {
                annualLeaveInfo = `\n\n연차 사용 등록을 위해서는 직원 이름을 명시해주세요.\n예시: "김민수가 4월 15일에 연차쓸게 사번:123456"`;
            } else {
                annualLeaveInfo = `\n\n연차 사용 등록을 위해서는 직원 이름과 사번을 명시해주세요.\n예시: "김민수가 4월 15일에 연차쓸게 사번:123456"`;
            }
        } else { annualLeaveInfo = `\n\n연차 사용 등록을 위해서는 날짜를 명시해주세요.\n예시: "4월 15일에 연차쓸게"`; }
      }
      // 연차 취소 요청 감지
      else if (messageLower.includes('취소') || messageLower.includes('반납')) {
        const dateMatch = message.match(/(\d{1,2})월\s*(\d{1,2})일/);
        if (dateMatch) {
          const month = dateMatch[1].padStart(2, '0');
          const day = dateMatch[2].padStart(2, '0');
          const cancelDate = `2025-${month}-${day}`;
          
          let employeeName = '';
          if (messageLower.includes('김민수') || messageLower.includes('민수')) {
            employeeName = '김민수';
          } else if (messageLower.includes('이영희') || messageLower.includes('영희')) {
            employeeName = '이영희';
          } else if (messageLower.includes('박철수') || messageLower.includes('철수')) {
            employeeName = '박철수';
          }
          
          if (employeeName) {
            // 사번 추출 (임시로 기본값 사용)
            const employeeNumber = "123456"; // 실제로는 사용자 입력에서 추출해야 함
            const result = await simpleVectorDatabase.cancelAnnualLeaveUse(employeeName, employeeNumber, cancelDate);
            if (result.success) {
              annualLeaveInfo = `\n\n연차 사용 취소 완료!\n${result.message}`;
            } else {
              annualLeaveInfo = `\n\n연차 사용 취소 실패: ${result.message}`;
            }
          } else {
            annualLeaveInfo = `\n\n연차 사용 취소를 위해서는 직원 이름을 명시해주세요.\n예시: "김민수가 4월 15일 연차 취소해줘"`;
          }
        } else {
          annualLeaveInfo = `\n\n연차 사용 취소를 위해서는 날짜를 명시해주세요.\n예시: "4월 15일 연차 취소해줘"`;
        }
      }
      // 기존 연차 조회 로직
      else if (messageLower.includes('김민수') || messageLower.includes('민수')) {
        const record = simpleVectorDatabase.getAnnualLeaveByEmployeeName('김민수');
        if (record) {
          annualLeaveInfo = `\n\n연차 정보:\n김민수님의 연차 현황:\n- 총 연차: ${record.totalDays}일\n- 사용한 연차: ${record.usedDays}일\n- 남은 연차: ${record.remainingDays}일\n- 사용한 날짜: ${record.usedDates.join(', ')}\n- 마지막 사용일: ${record.lastUsedDate}`;
        }
      } else if (messageLower.includes('이영희') || messageLower.includes('영희')) {
        const record = simpleVectorDatabase.getAnnualLeaveByEmployeeName('이영희');
        if (record) {
          annualLeaveInfo = `\n\n연차 정보:\n이영희님의 연차 현황:\n- 총 연차: ${record.totalDays}일\n- 사용한 연차: ${record.usedDays}일\n- 남은 연차: ${record.remainingDays}일\n- 사용한 날짜: ${record.usedDates.join(', ')}\n- 마지막 사용일: ${record.lastUsedDate}`;
        }
      } else if (messageLower.includes('박철수') || messageLower.includes('철수')) {
        const record = simpleVectorDatabase.getAnnualLeaveByEmployeeName('박철수');
        if (record) {
          annualLeaveInfo = `\n\n연차 정보:\n박철수님의 연차 현황:\n- 총 연차: ${record.totalDays}일\n- 사용한 연차: ${record.usedDays}일\n- 남은 연차: ${record.remainingDays}일\n- 사용한 날짜: ${record.usedDates.join(', ')}\n- 마지막 사용일: ${record.lastUsedDate}`;
        }
      } else if (messageLower.includes('전체') || messageLower.includes('현황') || messageLower.includes('요약')) {
        const allRecords = simpleVectorDatabase.getAllAnnualLeaveRecords();
        annualLeaveInfo = `\n\n전체 연차 현황:\n${allRecords.map(record => 
          `${record.employeeName}님: 총 ${record.totalDays}일, 사용 ${record.usedDays}일, 남음 ${record.remainingDays}일`
        ).join('\n')}`;
      }
    }

    // Search for relevant information using vector database
    const relevantInfo = await simpleVectorDatabase.search(message, 3);

    // Add user message to conversation history
    conversationHistory[sessionId].push({ role: 'user', content: message });
    
    // Create prompt by combining system prompt and relevant information
    const systemPrompt = createSystemPrompt();
    const contextPrompt = relevantInfo.length > 0 
      ? `\n\n관련 정보:\n${relevantInfo.map(info => `[${info.metadata.title}]\n${info.content}`).join('\n\n')}`
      : '';
    
    // 연차 정보 추가
    const fullContextPrompt = contextPrompt + annualLeaveInfo + employeeInfo; // 직원 정보 추가

    // 데이터 우선 사용을 위한 강화된 프롬프트
    let dataPriorityPrompt = '';
    if (contextPrompt || annualLeaveInfo || employeeInfo) {
      dataPriorityPrompt = `
            
중요: 위에 제공된 실제 데이터가 있습니다. 반드시 이 데이터를 기반으로 답변하고, 추측이나 일반적인 정보는 제공하지 마세요.

데이터 우선 사용 원칙:
1. 직원 정보가 있으면 해당 정보를 정확히 인용하여 답변
2. 연차 데이터가 있으면 해당 데이터를 정확히 인용하여 답변  
3. 법령 정보가 있으면 해당 조항을 정확히 인용하여 답변
4. 데이터가 없는 경우에만 일반적인 정보 제공
5. 절대로 "개인정보 보호를 위해 공개되지 않습니다" 같은 거짓말 하지 마세요

예시:
- "김영희 차장 연락처" 질문에 직원 정보가 있으면 → 정확한 연락처 정보 제공
- "개발팀 직원들" 질문에 부서 정보가 있으면 → 정확한 직원 목록 제공
- "김민수 연차" 질문에 연차 데이터가 있으면 → 정확한 연차 현황 제공`;
    }

    // 법률 관련 질문인지 판단
    const isLegalQuestion = messageLower.includes('법') || 
                           messageLower.includes('근로기준법') || 
                           messageLower.includes('시행령') || 
                           messageLower.includes('시행규칙') ||
                           messageLower.includes('조항') ||
                           messageLower.includes('조문');

    // 법률 관련 질문이 아닌 경우 안내사항 제거
    const finalSystemPrompt = isLegalQuestion ? systemPrompt : systemPrompt.replace(/안내사항.*?바랍니다\./s, '');

    // Call OpenAI API
    const systemMessage = { role: 'system' as 'system', content: finalSystemPrompt + fullContextPrompt + dataPriorityPrompt };
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
    
    // Add assistant response to conversation history
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

// 데이터베이스 상태 확인
app.get('/api/database/status', async (_req, res): Promise<void> => {
  try {
    const stats = simpleVectorDatabase.getStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '데이터베이스 상태 확인 실패'
    });
  }
});

// Annual leave search (새로 추가)
app.get('/api/annual-leave/search', async (req, res): Promise<void> => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      res.status(400).json({
        success: false,
        error: '검색어가 필요합니다.'
      });
      return;
    }

    const records = await simpleVectorDatabase.searchAnnualLeave(query as string, Number(limit));

    res.json({
      success: true,
      records: records,
      total: records.length
    });

  } catch (error) {
    console.error('연차 검색 중 오류:', error);
    res.status(500).json({
      success: false,
      error: '연차 검색 실패'
    });
  }
});

// Get annual leave by employee name (새로 추가)
app.get('/api/annual-leave/employee/:name', async (req, res): Promise<void> => {
  try {
    const { name } = req.params;

    if (!name) {
      res.status(400).json({
        success: false,
        error: '직원 이름이 필요합니다.'
      });
      return;
    }

    const record = simpleVectorDatabase.getAnnualLeaveByEmployeeName(name);

    if (!record) {
      res.status(404).json({
        success: false,
        error: '해당 직원의 연차 정보를 찾을 수 없습니다.'
      });
      return;
    }

    res.json({
      success: true,
      record: record
    });

  } catch (error) {
    console.error('직원 연차 조회 중 오류:', error);
    res.status(500).json({
      success: false,
      error: '직원 연차 조회 실패'
    });
  }
});

// Get all annual leave records (새로 추가)
app.get('/api/annual-leave', async (_req, res): Promise<void> => {
  try {
    const records = simpleVectorDatabase.getAllAnnualLeaveRecords();

    res.json({
      success: true,
      records: records,
      total: records.length
    });

  } catch (error) {
    console.error('연차 데이터 조회 중 오류:', error);
    res.status(500).json({
      success: false,
      error: '연차 데이터 조회 실패'
    });
  }
});

// 연차 사용 등록 (새로 추가)
app.post('/api/annual-leave/use', async (req, res): Promise<void> => {
  try {
    const { employeeName, employeeNumber, useDate } = req.body;

    if (!employeeName || !employeeNumber || !useDate) {
      res.status(400).json({
        success: false,
        error: '직원 이름, 사번, 사용 날짜가 필요합니다.'
      });
      return;
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(useDate)) {
      res.status(400).json({
        success: false,
        error: '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.'
      });
      return;
    }

    // 연차 사용 등록
    const result = await simpleVectorDatabase.registerAnnualLeaveUse(employeeName, employeeNumber, useDate);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        updatedRecord: result.updatedRecord
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }

  } catch (error) {
    console.error('연차 사용 등록 중 오류:', error);
    res.status(500).json({
      success: false,
      error: '연차 사용 등록 실패'
    });
  }
});

// 연차 사용 취소 (새로 추가)
app.post('/api/annual-leave/cancel', async (req, res): Promise<void> => {
  try {
    const { employeeName, employeeNumber, cancelDate } = req.body;

    if (!employeeName || !employeeNumber || !cancelDate) {
      res.status(400).json({
        success: false,
        error: '직원 이름, 사번, 취소할 날짜가 필요합니다.'
      });
      return;
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(cancelDate)) {
      res.status(400).json({
        success: false,
        error: '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.'
      });
      return;
    }

    // 연차 사용 취소
    const result = await simpleVectorDatabase.cancelAnnualLeaveUse(employeeName, employeeNumber, cancelDate);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        updatedRecord: result.updatedRecord
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }

  } catch (error) {
    console.error('연차 사용 취소 중 오류:', error);
    res.status(500).json({
      success: false,
      error: '연차 사용 취소 실패'
    });
  }
});

// 직원 검색
app.get('/api/employees/search', async (req, res): Promise<void> => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      res.status(400).json({
        success: false,
        error: '검색어가 필요합니다.'
      });
      return;
    }

    const employees = await simpleVectorDatabase.searchEmployees(query as string, Number(limit));

    res.json({
      success: true,
      employees: employees,
      total: employees.length
    });

  } catch (error) {
    console.error('직원 검색 중 오류:', error);
    res.status(500).json({
      success: false,
      error: '직원 검색 실패'
    });
  }
});

// 모든 직원 조회
app.get('/api/employees', async (_req, res): Promise<void> => {
  try {
    const employees = simpleVectorDatabase.getAllEmployees();

    res.json({
      success: true,
      employees: employees,
      total: employees.length
    });

  } catch (error) {
    console.error('직원 조회 중 오류:', error);
    res.status(500).json({
      success: false,
      error: '직원 조회 실패'
    });
  }
});

// 홈페이지 라우트 (랜딩페이지)
app.get('/', (_req, res): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'landing.html'));
});

// 채팅 페이지 라우트
app.get('/chat', (_req, res): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 서버 시작
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, async () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);

    // 간단한 벡터 데이터베이스 초기화
    try {
      await simpleVectorDatabase.initialize();
      const stats = simpleVectorDatabase.getStats();
      console.log(`간단한 벡터 데이터베이스 준비 완료: ${stats.totalChunks}개 청킹`);
    } catch (error) {
      console.error('간단한 벡터 데이터베이스 초기화 실패:', error);
    }
  });
}

export default app; 