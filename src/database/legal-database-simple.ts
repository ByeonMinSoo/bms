import * as fs from 'fs-extra';    
import * as path from 'path';      
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';      
import {
  initializeVectorDatabase,
  searchVectors, 
  saveVectorDatabase,
  loadVectorDatabase,
  VectorSearchResult
} from '../engines/vector-engine-chunked';

const pdfParse = require('pdf-parse');

// 기존 인터페이스들
interface LegalDocument {
  title: string;
  content: string;
  articles: { [key: string]: string };
}

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  hireDate: string;
  employeeNumber: string;
}

interface EmployeeData {
  totalCount: number;
  byPosition: { [position: string]: number };
  byDepartment: { [department: string]: number };
  employees: Employee[];
}

interface CompanyRegulation {
  title: string;
  content: string;
  effectiveDate: string;
}

// 데이터베이스
const legalDocuments: LegalDocument[] = [];
let employeeData: EmployeeData = {
  totalCount: 0,
  byPosition: {},
  byDepartment: {},
  employees: []
};
let companyRegulations: CompanyRegulation[] = [];

// PDF 문서 파싱
async function parsePDFDocument(filePath: string): Promise<LegalDocument> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    
    const fileName = path.basename(filePath, '.pdf');
    console.log(`✅ ${fileName}: PDF 파싱 완료 (${data.text.length}자)`);
    
    return {
      title: fileName,
      content: data.text,
      articles: {}
    };
  } catch (error: any) {
    console.error(`❌ ${path.basename(filePath)} PDF 파싱 실패:`, error.message);
    throw error;
  }
}

// DOCX 문서 파싱 (직원 정보)
async function parseDOCXDocument(filePath: string): Promise<EmployeeData> {
  try {
    const fileName = path.basename(filePath, '.docx');
    console.log(`📄 ${fileName}: DOCX 파싱 시작...`);
    
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    // 텍스트를 줄 단위로 분리
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    const employees: Employee[] = [];
    let headerIndex = -1;
    
    // 헤더 찾기
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('이름') || lines[i].includes('직급') || lines[i].includes('부서')) {
        headerIndex = i;
        break;
      }
    }
    
    if (headerIndex === -1) {
      console.warn(`⚠️  ${fileName}: 헤더를 찾을 수 없어 더미 데이터로 폴백`);
      return parseEmployeeDocumentFallback();
    }
    
    // 데이터 처리 (더미 데이터 폴백)
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 5) continue; // 빈 줄이나 너무 짧은 줄은 건너뛰기

      // 탭이나 쉼표로 분리
      const parts = line.split(/\t|,|, /).map(part => part.trim()).filter(part => part);
      
      if (parts.length >= 3) {
        const employee: Employee = {
          id: `EMP${employees.length + 1}`,
          name: parts[0] || `직원${employees.length + 1}`,
          position: parts[1] || '사원',
          department: parts[2] || '개발팀',
          email: parts[3] || `${parts[0] || `employee${employees.length + 1}`}@company.com`,
          phone: parts[4] || `010-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          hireDate: parts[5] || '2023-01-01',
          employeeNumber: parts[6] || `EMP${String(employees.length + 1).padStart(3, '0')}`
        };
        employees.push(employee);
      }
    }
    
    console.log(`✅ ${fileName}: ${employees.length}명 직원 정보 로드 완료`);
    
    // 직원 정보가 0명이면 더미 데이터로 폴백
    if (employees.length === 0) {
      console.warn(`⚠️  ${fileName}: 직원 정보가 0명이어서 더미 데이터로 폴백`);
      return parseEmployeeDocumentFallback();
    }
    
    // 통계 계산
    const byPosition: { [position: string]: number } = {};
    const byDepartment: { [department: string]: number } = {};
    
    employees.forEach(emp => {
      byPosition[emp.position] = (byPosition[emp.position] || 0) + 1;
      byDepartment[emp.department] = (byDepartment[emp.department] || 0) + 1;
    });
    
    return {
      totalCount: employees.length,
      byPosition,
      byDepartment,
      employees
    };
    
  } catch (error: any) {
    console.warn(`⚠️  ${path.basename(filePath)} DOCX 파싱 실패 - 더미 데이터 사용:`, error.message);
    return parseEmployeeDocumentFallback();
  }
}

// XLSX 파일 파싱 (회사 규정)
async function parseXLSXDocument(filePath: string): Promise<CompanyRegulation[]> {
  try {
    const fileName = path.basename(filePath, '.xlsx');
    console.log(`📊 ${fileName}: XLSX 파싱 시작...`);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // JSON으로 변환
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    const regulations: CompanyRegulation[] = [];
    let headers: string[] = [];
    
    // 헤더 찾기
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (row && row.some(cell => cell && typeof cell === 'string' && (cell.includes('제목') || cell.includes('규정') || cell.includes('내용')))) {
        headers = row.map(cell => String(cell || ''));
        break;
      }
    }
    
    if (headers.length === 0) {
      console.warn(`⚠️  ${fileName}: 헤더를 찾을 수 없어 더미 데이터로 폴백`);
      return parseRegulationDocumentFallback();
    }
    
    // 데이터 처리
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length < 2) continue;
      
      const title = String(row[0] || `규정${i}`);
      const content = String(row[1] || '규정 내용이 없습니다.');
      const effectiveDate = String(row[2] || '2024-01-01');
      
      if (title && content && title !== '제목' && content !== '내용') {
        regulations.push({
          title,
          content,
          effectiveDate
        });
      }
    }
    
    console.log(`✅ ${fileName}: ${regulations.length}개 규정 로드 완료`);
    
    if (regulations.length === 0) {
      console.warn(`⚠️  ${fileName}: 규정이 0개이어서 더미 데이터로 폴백`);
      return parseRegulationDocumentFallback();
    }
    
    return regulations;
    
  } catch (error: any) {
    console.warn(`⚠️  ${path.basename(filePath)} XLSX 파싱 실패 - 더미 데이터 사용:`, error.message);
    return parseRegulationDocumentFallback();
  }
}

// 더미 직원 데이터 생성
function parseEmployeeDocumentFallback(): EmployeeData {
  console.log(`🔄 더미 직원 데이터 생성 시작...`);
  
  const employees: Employee[] = [];
  const positions = ['사원', '대리', '과장', '차장', '부장', '이사'];
  const departments = ['개발팀', '기획팀', '인사팀', '영업팀', '마케팅팀', '경영팀'];
  
  for (let i = 1; i <= 100; i++) {
    const position = positions[Math.floor(Math.random() * positions.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    
    const employee: Employee = {
      id: `EMP${i}`,
      name: `직원${i}`,
      position,
      department,
      email: `employee${i}@company.com`,
      phone: `010-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      hireDate: '2023-01-01',
      employeeNumber: `EMP${String(i).padStart(3, '0')}`
    };
    employees.push(employee);
  }
  
  // 통계 계산
  const byPosition: { [position: string]: number } = {};
  const byDepartment: { [department: string]: number } = {};
  
  employees.forEach(emp => {
    byPosition[emp.position] = (byPosition[emp.position] || 0) + 1;
    byDepartment[emp.department] = (byDepartment[emp.department] || 0) + 1;
  });
  
  console.log(`✅ 더미 직원 데이터 생성 완료: ${employees.length}명`);
  
  return {
    totalCount: employees.length,
    byPosition,
    byDepartment,
    employees
  };
}

// 더미 규정 데이터 생성
function parseRegulationDocumentFallback(): CompanyRegulation[] {
  console.log(`🔄 더미 규정 데이터 생성 시작...`);
  
  const regulations: CompanyRegulation[] = [
    {
      title: '인사규정',
      content: '제1조 (목적) 본 규정은 회사의 인사관리에 관한 기본사항을 정함을 목적으로 한다. 제2조 (적용범위) 본 규정은 회사에 근무하는 모든 직원에게 적용한다.',
      effectiveDate: '2024-01-01'
    },
    {
      title: '출장비 지급 규정',
      content: '제1조 (출장비) 직원의 출장 시 발생하는 교통비, 숙박비, 식비 등을 지급한다. 제2조 (지급기준) 출장비는 실제 지출액을 기준으로 하되, 일일 한도액을 초과할 수 없다.',
      effectiveDate: '2024-01-01'
    },
    {
      title: '재택근무 규정',
      content: '제1조 (재택근무) 업무 성격상 사무실 출근이 불필요한 경우 재택근무를 허용한다. 제2조 (신청절차) 재택근무는 사전에 부서장의 승인을 받아야 한다.',
      effectiveDate: '2024-01-01'
    },
    {
      title: '교육훈련 규정',
      content: '제1조 (교육목적) 직원의 능력 향상과 전문성 개발을 위한 교육을 실시한다. 제2조 (교육종류) 신입교육, 직무교육, 리더십 교육 등이 있다.',
      effectiveDate: '2024-01-01'
    },
    {
      title: '복리후생 규정',
      content: '제1조 (복리후생) 직원의 생활 안정과 복지 향상을 위한 제도를 운영한다. 제2조 (복리후생 종류) 건강보험, 국민연금, 퇴직연금, 각종 수당 등이 포함된다.',
      effectiveDate: '2024-01-01'
    }
  ];
  
  console.log(`✅ 더미 규정 데이터 생성 완료: ${regulations.length}개`);
  return regulations;
}

// 데이터베이스 초기화
export async function initializeLegalDatabase(): Promise<void> {
  console.log('🚀 법률 데이터베이스 초기화 시작...');
  
  try {
    // PDF 파일들 파싱
    const pdfFiles = [
      '근로기준법(법률)(제20520호)(20250223).pdf',
      '근로기준법 시행령(대통령령)(제35276호)(20250223).pdf',
      '근로기준법 시행규칙(고용노동부령)(제00436호)(20250223).pdf'
    ];
    
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(__dirname, '..', '..', 'dataset', pdfFile);
      if (await fs.pathExists(pdfPath)) {
        try {
          const document = await parsePDFDocument(pdfPath);
          legalDocuments.push(document);
        } catch (error) {
          console.warn(`⚠️  ${pdfFile} PDF 파싱 실패, 건너뜀:`, error.message);
        }
      } else {
        console.warn(`⚠️  ${pdfFile} 파일을 찾을 수 없어 건너뜀`);
      }
    }
    
    // DOCX 파일 파싱 (직원 정보)
    const docxFile = '직원정보_샘플_100명.docx';
    const docxPath = path.join(__dirname, '..', '..', 'dataset', docxFile);
    if (await fs.pathExists(docxPath)) {
      employeeData = await parseDOCXDocument(docxPath);
    } else {
      console.warn(`⚠️  ${docxFile} 파일을 찾을 수 없어 더미 데이터 사용`);
      employeeData = parseEmployeeDocumentFallback();
    }
    
    // XLSX 파일 파싱 (회사 규정)
    const xlsxFile = '부속규정_샘플_재생성.xlsx';
    const xlsxPath = path.join(__dirname, '..', '..', 'dataset', xlsxFile);
    if (await fs.pathExists(xlsxPath)) {
      companyRegulations = await parseXLSXDocument(xlsxPath);
    } else {
      console.warn(`⚠️  ${xlsxFile} 파일을 찾을 수 없어 더미 데이터 사용`);
      companyRegulations = parseRegulationDocumentFallback();
    }
    
    // 벡터 데이터베이스 초기화
    await initializeVectorDatabase(legalDocuments, employeeData, companyRegulations);
    
    console.log(`✅ 데이터베이스 초기화 완료:`);
    console.log(`   - 법률 문서: ${legalDocuments.length}개`);
    console.log(`   - 직원 정보: ${employeeData.totalCount}명`);
    console.log(`   - 회사 규정: ${companyRegulations.length}개`);
    
  } catch (error: any) {
    console.error('❌ 데이터베이스 초기화 실패:', error.message);
    throw error;
  }
}

// 쿼리 타입 분류
function classifyQueryType(query: string): 'legal' | 'employee' | 'regulation' | 'mixed' {
  const legalKeywords = ['근로기준법', '법률', '법령', '조문', '조항', '임금', '근무시간', '휴가', '연차', '휴일', '해고', '부당해고', '노동법'];
  const employeeKeywords = ['직원', '사원', '대리', '과장', '차장', '부장', '이사', '개발팀', '기획팀', '인사팀', '영업팀', '마케팅팀', '경영팀'];
  const regulationKeywords = ['사규', '회사규정', '사내규정', '업무규정', '근무규정', '인사규정', '출장비', '재택근무', '교육훈련', '복리후생', '부속규정'];
  
  const queryLower = query.toLowerCase();
  let legalCount = 0, employeeCount = 0, regulationCount = 0;
  
  legalKeywords.forEach(keyword => {
    if (queryLower.includes(keyword)) legalCount++;
  });
  
  employeeKeywords.forEach(keyword => {
    if (queryLower.includes(keyword)) employeeCount++;
  });
  
  regulationKeywords.forEach(keyword => {
    if (queryLower.includes(keyword)) regulationCount++;
  });
  
  if (legalCount > 0 && (employeeCount > 0 || regulationCount > 0)) return 'mixed';
  if (legalCount > 0) return 'legal';
  if (employeeCount > 0) return 'employee';
  if (regulationCount > 0) return 'regulation';
  
  return 'mixed'; // 기본값
}

// 관련 문서 검색
export async function searchRelevantArticles(query: string): Promise<string> {
  try {
    const queryType = classifyQueryType(query);
    console.log(`🔍 쿼리 타입: ${queryType} (질문: "${query}")`);
    
    // 벡터 검색 우선 시도
    const vectorResults = await searchVectors(query);
    if (vectorResults && vectorResults.length > 0) {
      console.log(`✅ 벡터 검색 결과: ${vectorResults.length}개`);
      return vectorResults.map(result => result.chunk.content).join('\n\n');
    }
    
    // 벡터 검색 실패 시 텍스트 검색으로 폴백
    console.log(`⚠️  벡터 검색 실패, 텍스트 검색으로 폴백`);
    
    let results: string[] = [];
    
    // 직원 정보 검색
    if (queryType === 'employee' || queryType === 'mixed') {
      // 개별 직원 검색
      const employeeMatch = query.match(/직원(\d+)/);
      if (employeeMatch) {
        const employeeId = parseInt(employeeMatch[1]);
        const employee = employeeData.employees.find(emp => emp.id === `EMP${employeeId}`);
        if (employee) {
          results.push(`📋 직원 정보:\n이름: ${employee.name}\n직급: ${employee.position}\n부서: ${employee.department}\n이메일: ${employee.email}\n전화번호: ${employee.phone}\n입사일: ${employee.hireDate}\n사번: ${employee.employeeNumber}`);
        }
      }
      
      // 직급별 검색
      if (query.includes('대리') || query.includes('과장') || query.includes('차장') || query.includes('부장') || query.includes('이사')) {
        const positionStats = Object.entries(employeeData.byPosition)
          .map(([position, count]) => `${position}: ${count}명`)
          .join(', ');
        results.push(`📊 직급별 인원 현황:\n${positionStats}`);
      }
      
      // 부서별 검색
      if (query.includes('팀') || query.includes('부서')) {
        const departmentStats = Object.entries(employeeData.byDepartment)
          .map(([department, count]) => `${department}: ${count}명`)
          .join(', ');
        results.push(`📊 부서별 인원 현황:\n${departmentStats}`);
      }
      
      // 전체 직원 수
      if (query.includes('전체') || query.includes('총')) {
        results.push(`📊 전체 직원 현황:\n총 직원 수: ${employeeData.totalCount}명`);
      }
    }
    
    // 회사 규정 검색
    if (queryType === 'regulation' || queryType === 'mixed') {
      const regulationResults = companyRegulations.filter(regulation => 
        query.includes('사규') || 
        query.includes('회사규정') || 
        query.includes('사내규정') ||
        regulation.title.toLowerCase().includes(query.toLowerCase()) ||
        regulation.content.toLowerCase().includes(query.toLowerCase())
      );
      
      if (regulationResults.length > 0) {
        const regulationText = regulationResults.map(regulation => 
          `📋 ${regulation.title}:\n${regulation.content}`
        ).join('\n\n');
        results.push(regulationText);
      }
    }
    
    // 법률 문서 검색
    if (queryType === 'legal' || queryType === 'mixed') {
      for (const doc of legalDocuments) {
        const searchTerms = query.toLowerCase().split(' ');
        const matches = searchTerms.filter(term => 
          doc.content.toLowerCase().includes(term)
        );
        
        if (matches.length > 0) {
          // 관련 부분 추출 (간단한 키워드 매칭)
          const lines = doc.content.split('\n');
          const relevantLines = lines.filter(line => 
            searchTerms.some(term => line.toLowerCase().includes(term))
          ).slice(0, 10); // 최대 10줄
          
          if (relevantLines.length > 0) {
            results.push(`📋 ${doc.title}:\n${relevantLines.join('\n')}`);
          }
        }
      }
    }
    
    if (results.length > 0) {
      return results.join('\n\n');
    } else {
      return '관련 정보를 찾을 수 없습니다.';
    }
    
  } catch (error: any) {
    console.error('❌ 검색 중 오류 발생:', error.message);
    return '검색 중 오류가 발생했습니다.';
  }
}

// 데이터 내보내기 (디버깅용)
export function getDatabaseInfo() {
  return {
    legalDocuments: legalDocuments.length,
    employeeData: {
      totalCount: employeeData.totalCount,
      byPosition: employeeData.byPosition,
      byDepartment: employeeData.byDepartment,
      sampleEmployees: employeeData.employees.slice(0, 5) // 처음 5명만
    },
    companyRegulations: companyRegulations.length
  };
} 