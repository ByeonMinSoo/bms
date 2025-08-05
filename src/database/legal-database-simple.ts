import * as fs from 'fs-extra';
import * as path from 'path';
import * as XLSX from 'xlsx';

// 인터페이스 정의
export interface LegalArticle {
  title: string;
  content: string;
  source: string;
}

export interface Employee {
  name: string;
  position: string;
  department: string;
  email: string;
}

export interface Regulation {
  title: string;
  content: string;
  effectiveDate: string;
}

// 데이터 저장소
let legalArticles: LegalArticle[] = [];
let employees: Employee[] = [];
let regulations: Regulation[] = [];

// 법령 데이터 (더미 데이터)
const legalData = {
  '근로기준법': {
    '제60조': '사용자는 1년간 8할 이상 출근한 근로자에게 15일의 유급휴가를 주어야 한다.',
    '제61조': '사용자는 근로자가 1년간 8할 미만 출근한 경우에는 1개월 개근한 수에 비례하여 유급휴가를 주어야 한다.',
    '제62조': '사용자는 근로자가 1년간 8할 이상 출근한 경우에는 1년간 80퍼센트 이상 출근한 근로자에게는 1년간 80퍼센트 미만 출근한 근로자보다 3일을 더한 유급휴가를 주어야 한다.'
  },
  '근로기준법 시행령': {
    '제25조': '연차 유급휴가는 근로자가 1년간 8할 이상 출근한 경우에 발생한다.',
    '제26조': '연차 유급휴가는 근로자가 1년간 8할 이상 출근한 경우에 발생한다.'
  }
};

// 직원 데이터 (더미 데이터)
const employeeData = {
  employees: [
    { name: '김철수', position: '대리', department: '개발팀', email: 'kim@company.com' },
    { name: '이영희', position: '과장', department: '기획팀', email: 'lee@company.com' },
    { name: '박민수', position: '차장', department: '인사팀', email: 'park@company.com' },
    { name: '정수진', position: '대리', department: '마케팅팀', email: 'jung@company.com' },
    { name: '최동욱', position: '부장', department: '영업팀', email: 'choi@company.com' }
  ]
};

// 부속규정 데이터 (더미 데이터)
const regulationData = [
  {
    title: '출장비 지급 규정',
    content: '출장비는 실비 기준으로 지급하며, 교통비, 숙박비, 식비를 포함한다. 국내 출장의 경우 일일 5만원, 해외 출장의 경우 일일 10만원을 기본으로 지급한다.',
    effectiveDate: '2024-01-01'
  },
  {
    title: '재택근무 규정',
    content: '재택근무는 주 2일까지 허용되며, 사전 승인을 받아야 한다. 재택근무 시에도 정상 근무시간을 준수해야 하며, 업무 연락이 가능한 상태를 유지해야 한다.',
    effectiveDate: '2024-01-01'
  },
  {
    title: '교육훈련비 지원 규정',
    content: '직무 관련 교육훈련비는 연간 100만원까지 지원한다. 지원 대상은 사전 승인을 받은 교육과정이며, 수료 후 증빙서류를 제출해야 한다.',
    effectiveDate: '2024-01-01'
  }
];

// 데이터베이스 초기화
export async function initializeLegalDatabase(): Promise<void> {
  console.log('🔄 법령 데이터베이스 초기화 중...');
  
  try {
    // 법령 데이터 로드
    legalArticles = [];
    for (const [lawName, articles] of Object.entries(legalData)) {
      for (const [articleNumber, content] of Object.entries(articles)) {
        legalArticles.push({
          title: `${lawName} ${articleNumber}`,
          content: content,
          source: lawName
        });
      }
    }
    
    // 직원 데이터 로드
    employees = employeeData.employees;
    
    // 부속규정 데이터 로드
    regulations = regulationData;
    
    console.log(`✅ 데이터베이스 초기화 완료:`);
    console.log(`  - 법령 조문: ${legalArticles.length}개`);
    console.log(`  - 직원 정보: ${employees.length}명`);
    console.log(`  - 부속규정: ${regulations.length}개`);
    
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    // 더미 데이터로 초기화
    console.log('⚠️ 더미 데이터로 초기화합니다.');
  }
}

// 키워드 기반 검색
export async function searchRelevantArticles(query: string): Promise<string[]> {
  if (legalArticles.length === 0) {
    await initializeLegalDatabase();
  }
  
  const results: string[] = [];
  const queryLower = query.toLowerCase();
  
  // 법령 검색
  const legalMatches = legalArticles.filter(article => 
    article.title.toLowerCase().includes(queryLower) ||
    article.content.toLowerCase().includes(queryLower)
  );
  
  if (legalMatches.length > 0) {
    results.push('=== 📋 관련 법령 정보 ===');
    legalMatches.forEach(article => {
      results.push(`[${article.title}]\n${article.content}`);
    });
  }
  
  // 직원 정보 검색
  const employeeMatches = employees.filter(emp => 
    emp.name.toLowerCase().includes(queryLower) ||
    emp.position.toLowerCase().includes(queryLower) ||
    emp.department.toLowerCase().includes(queryLower)
  );
  
  if (employeeMatches.length > 0) {
    results.push('=== 👥 관련 직원 정보 ===');
    employeeMatches.forEach(emp => {
      results.push(`${emp.name} (${emp.position}, ${emp.department}) - ${emp.email}`);
    });
  }
  
  // 부속규정 검색
  const regulationMatches = regulations.filter(reg => 
    reg.title.toLowerCase().includes(queryLower) ||
    reg.content.toLowerCase().includes(queryLower)
  );
  
  if (regulationMatches.length > 0) {
    results.push('=== 📜 관련 사내 규정 ===');
    regulationMatches.forEach(reg => {
      results.push(`[${reg.title}]\n${reg.content}\n시행일: ${reg.effectiveDate}`);
    });
  }
  
  if (results.length === 0) {
    results.push('관련 정보를 찾을 수 없습니다. 다른 키워드로 다시 시도해주세요.');
  }
  
  return results;
} 