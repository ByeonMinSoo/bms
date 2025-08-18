import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenAI } from 'openai';

// 직원 데이터 인터페이스
interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  hireDate: string;
  employeeNumber: string;
  salary: string;
  status: string;
}

// 연차 데이터 인터페이스
interface AnnualLeave {
  employeeId: string;
  employeeName: string;
  department: string;
  employeeNumber: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  usedDates: string[];
  lastUsedDate?: string;
}

// 사용자 의도 분석
function analyzeUserIntent(message: string): {
  type: 'employee_search' | 'annual_leave' | 'department_info' | 'general_inquiry';
  query: string;
  entities: string[];
} {
  const messageLower = message.toLowerCase();
  let type: any = 'general_inquiry';
  const entities: string[] = [];

  // 직원 검색 의도
  if (messageLower.includes('직원') || messageLower.includes('사원') || messageLower.includes('이름') ||
      messageLower.includes('연락처') || messageLower.includes('이메일') || messageLower.includes('사번') ||
      messageLower.includes('연봉') || messageLower.includes('입사일')) {
    type = 'employee_search';
  }
  // 연차 관리 의도
  else if (messageLower.includes('연차') || messageLower.includes('휴가') || messageLower.includes('잔여연차') ||
           messageLower.includes('사용한 연차') || messageLower.includes('연차 현황')) {
    type = 'annual_leave';
  }
  // 부서 정보 의도
  else if (messageLower.includes('부서') || messageLower.includes('팀') || messageLower.includes('인원') ||
           messageLower.includes('몇 명') || messageLower.includes('구성')) {
    type = 'department_info';
  }

  // 엔티티 추출 (이름, 부서)
  const nameMatch = message.match(/[가-힣]{2,4}(?:씨|님)?/g);
  if (nameMatch) entities.push(...nameMatch);

  const deptMatch = message.match(/[가-힣]+(?:팀|부)/g);
  if (deptMatch) entities.push(...deptMatch);

  return { type, query: message, entities };
}

// 직원 검색 함수
async function searchEmployees(query: string, entities: string[]): Promise<Employee[]> {
  try {
    const response = await fetch('/employees.json');
    const employees: Employee[] = await response.json();
    
    if (!query && entities.length === 0) return employees;

    return employees.filter(emp => {
      // 이름으로 검색
      if (entities.some(entity => emp.name.includes(entity))) return true;
      
      // 부서로 검색
      if (entities.some(entity => emp.department.includes(entity))) return true;
      
      // 일반 검색어로 검색
      if (query && (
        emp.name.includes(query) ||
        emp.department.includes(query) ||
        emp.position.includes(query) ||
        emp.email.includes(query)
      )) return true;
      
      return false;
    });
  } catch (error) {
    console.error('직원 검색 오류:', error);
    return [];
  }
}

// 연차 검색 함수
async function searchAnnualLeave(query: string, entities: string[]): Promise<AnnualLeave[]> {
  try {
    const response = await fetch('/annual-leave.json');
    const annualLeaves: AnnualLeave[] = await response.json();
    
    if (!query && entities.length === 0) return annualLeaves;

    return annualLeaves.filter(leave => {
      // 이름으로 검색
      if (entities.some(entity => leave.employeeName.includes(entity))) return true;
      
      // 부서로 검색
      if (entities.some(entity => leave.department.includes(entity))) return true;
      
      // 일반 검색어로 검색
      if (query && (
        leave.employeeName.includes(query) ||
        leave.department.includes(query)
      )) return true;
      
      return false;
    });
  } catch (error) {
    console.error('연차 검색 오류:', error);
    return [];
  }
}

// 부서 정보 함수
async function getDepartmentInfo(department: string): Promise<{ employees: Employee[], annualLeaves: AnnualLeave[] }> {
  try {
    const [employeesResponse, annualLeaveResponse] = await Promise.all([
      fetch('/employees.json'),
      fetch('/annual-leave.json')
    ]);
    
    const employees: Employee[] = await employeesResponse.json();
    const annualLeaves: AnnualLeave[] = await annualLeaveResponse.json();
    
    const deptEmployees = employees.filter(emp => emp.department.includes(department));
    const deptAnnualLeaves = annualLeaves.filter(leave => leave.department.includes(department));
    
    return { employees: deptEmployees, annualLeaves: deptAnnualLeaves };
  } catch (error) {
    console.error('부서 정보 조회 오류:', error);
    return { employees: [], annualLeaves: [] };
  }
}

// 데이터 포맷팅 함수
function formatEmployeeData(employees: Employee[]): string {
  if (employees.length === 0) return '검색 결과가 없습니다.';
  
  if (employees.length === 1) {
    const emp = employees[0];
    return `직원 정보:\n이름: ${emp.name}\n직급: ${emp.position}\n부서: ${emp.department}\n이메일: ${emp.email}\n연락처: ${emp.phone}\n입사일: ${emp.hireDate}\n사번: ${emp.employeeNumber}\n연봉: ${emp.salary}원\n상태: ${emp.status}`;
  }
  
  return `검색 결과 (${employees.length}명):\n${employees.map(emp => 
    `${emp.name} ${emp.position} (${emp.department}) - ${emp.email}`
  ).join('\n')}`;
}

function formatAnnualLeaveData(annualLeaves: AnnualLeave[]): string {
  if (annualLeaves.length === 0) return '연차 기록이 없습니다.';
  
  if (annualLeaves.length === 1) {
    const leave = annualLeaves[0];
    return `연차 현황:\n이름: ${leave.employeeName}\n부서: ${leave.department}\n총 연차: ${leave.totalDays}일\n사용한 연차: ${leave.usedDays}일\n잔여 연차: ${leave.remainingDays}일\n마지막 사용일: ${leave.lastUsedDate || '없음'}`;
  }
  
  return `연차 현황 (${annualLeaves.length}명):\n${annualLeaves.map(leave => 
    `${leave.employeeName} (${leave.department}): ${leave.usedDays}/${leave.totalDays}일 사용, ${leave.remainingDays}일 남음`
  ).join('\n')}`;
}

function formatDepartmentInfo(department: string, employees: Employee[], annualLeaves: AnnualLeave[]): string {
  if (employees.length === 0) return `${department} 부서 정보를 찾을 수 없습니다.`;
  
  const totalEmployees = employees.length;
  const totalAnnualLeaves = annualLeaves.length;
  
  let result = `${department} 부서 정보:\n`;
  result += `총 인원: ${totalEmployees}명\n`;
  result += `연차 기록: ${totalAnnualLeaves}건\n\n`;
  
  result += `직원 목록:\n${employees.map(emp => 
    `${emp.name} (${emp.position}) - ${emp.email}`
  ).join('\n')}`;
  
  if (annualLeaves.length > 0) {
    result += `\n\n연차 현황:\n${annualLeaves.map(leave => 
      `${leave.employeeName}: ${leave.usedDays}/${leave.totalDays}일 사용`
    ).join('\n')}`;
  }
  
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { message, sessionId } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: '메시지가 필요합니다.' });
    }

    // 사용자 의도 분석
    const userIntent = analyzeUserIntent(message);
    let relevantData = '';
    let dataSource = '';

    // 의도에 따른 데이터 검색 및 응답 생성
    if (userIntent.type === 'employee_search') {
      const employees = await searchEmployees(userIntent.query, userIntent.entities);
      if (employees.length > 0) {
        relevantData = formatEmployeeData(employees);
        dataSource = '직원 데이터베이스';
      }
    } else if (userIntent.type === 'annual_leave') {
      const annualLeaves = await searchAnnualLeave(userIntent.query, userIntent.entities);
      if (annualLeaves.length > 0) {
        relevantData = formatAnnualLeaveData(annualLeaves);
        dataSource = '연차 데이터베이스';
      }
    } else if (userIntent.type === 'department_info') {
      const deptEntity = userIntent.entities.find(entity => entity.includes('팀') || entity.includes('부'));
      if (deptEntity) {
        const deptInfo = await getDepartmentInfo(deptEntity);
        if (deptInfo.employees.length > 0) {
          relevantData = formatDepartmentInfo(deptEntity, deptInfo.employees, deptInfo.annualLeaves);
          dataSource = '부서 데이터베이스';
        }
      }
    }

    // OpenAI API 키 확인
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // API 키가 없는 경우 데이터만 반환
      if (relevantData) {
        return res.status(200).json({
          success: true,
          response: relevantData,
          sessionId: sessionId || null,
          dataSource
        });
      }
      
      return res.status(200).json({
        success: true,
        response: `"${message}"에 대한 처리를 위해 OpenAI API 키가 필요합니다. 관리자에게 문의해주세요.`,
        sessionId: sessionId || null
      });
    }

    // OpenAI API 호출
    const openai = new OpenAI({ apiKey });
    
    // 시스템 프롬프트 생성
    let systemPrompt = '당신은 HR 도메인 어시스턴트입니다. 간결하고 정확히 한국어로 답해주세요.';
    
    if (relevantData) {
      systemPrompt += `\n\n📊 관련 데이터 (${dataSource}):\n${relevantData}\n\n위 데이터를 바탕으로 정확하고 구체적인 답변을 제공해주세요.`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 800,
      temperature: 0.2
    });

    const content = completion.choices?.[0]?.message?.content || '응답을 생성할 수 없습니다.';

    // 데이터가 있는 경우 GPT 응답과 함께 제공
    if (relevantData) {
      const enhancedResponse = `${content}\n\n${relevantData}`;
      return res.status(200).json({ 
        success: true, 
        response: enhancedResponse, 
        sessionId: sessionId || null,
        dataSource 
      });
    }

    return res.status(200).json({ 
      success: true, 
      response: content, 
      sessionId: sessionId || null 
    });

  } catch (error) {
    console.error('chat/message error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}


