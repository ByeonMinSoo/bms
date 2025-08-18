import * as fs from 'fs';
import * as path from 'path';

interface ChunkedDocument {
  content: string;
  metadata: {
    source: string;
    chunkIndex: number;
    title: string;
  };
  score?: number; // score 속성 추가
}

interface ProcessedData {
  chunks: ChunkedDocument[];
  totalChunks: number;
  processedAt: string;
}

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  hireDate: string;
  employeeNumber: string; // 사번 추가
  salary: string;
  status: string;
}

// 새로운 연차 데이터 인터페이스 추가
interface AnnualLeaveRecord {
  employeeId: string;
  employeeName: string;
  department: string;
  employeeNumber: string; // 사번 추가
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  usedDates: string[]; // 사용한 연차 날짜들
  lastUsedDate?: string; // 마지막 사용일
}

class SimpleVectorDatabase {
  private chunks: ChunkedDocument[] = [];
  private employees: Employee[] = [];
  private annualLeaveRecords: AnnualLeaveRecord[] = []; // 연차 데이터 추가
  private isInitialized = false;

  // Database initialization
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check for processed data file
      const processedDataPath = path.join(__dirname, '..', '..', 'processed-data.json');

      if (fs.existsSync(processedDataPath)) {
        // Load existing processed data
        const data = JSON.parse(fs.readFileSync(processedDataPath, 'utf-8')) as ProcessedData;
        this.chunks = data.chunks;
      } else {
        // Process HWP files directly (simulated)
        await this.processHWPFiles();
      }

      // Load employee data
      await this.loadEmployeeData();

      // Load annual leave data
      await this.loadAnnualLeaveData();

      this.isInitialized = true;

    } catch (error) {
      console.error('데이터베이스 초기화 실패:', error);
      throw error;
    }
  }

  // Load employee data
  private async loadEmployeeData(): Promise<void> {
    try {
      // 여러 경로 시도
      const possiblePaths = [
        path.join(__dirname, '..', '..', 'data', 'employee_data_full.csv'),
        path.join(process.cwd(), 'data', 'employee_data_full.csv'),
        path.join(__dirname, '..', '..', 'data', 'dummy_employees_100.csv'),
        path.join(process.cwd(), 'data', 'dummy_employees_100.csv'),
        path.join(__dirname, '..', '..', 'data', 'actual_employees_100.csv'),
        path.join(process.cwd(), 'data', 'actual_employees_100.csv')
      ];
      
      let csvPath = '';
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          csvPath = testPath;
          break;
        }
      }
      
      if (!csvPath) {
        console.log('CSV 파일을 찾을 수 없음. 샘플 데이터 생성...');
        this.createSampleEmployees();
        return;
      }
        
      console.log(`CSV 파일 로드: ${csvPath}`);
        
        // 여러 인코딩으로 시도하여 한글 깨짐 방지
        let csvContent = '';
        
        try {
          csvContent = fs.readFileSync(csvPath, 'utf8');
        console.log('UTF-8 인코딩으로 로드 성공');
        } catch (error) {
          try {
            const buffer = fs.readFileSync(csvPath);
            csvContent = buffer.toString('euc-kr' as any);
          console.log('EUC-KR 인코딩으로 로드 성공');
          } catch (error2) {
            try {
              const buffer = fs.readFileSync(csvPath);
              csvContent = buffer.toString('cp949' as any);
            console.log('CP949 인코딩으로 로드 성공');
            } catch (error3) {
              try {
                const buffer = fs.readFileSync(csvPath);
                csvContent = buffer.toString('latin1' as any);
              console.log('LATIN1 인코딩으로 로드 성공');
              } catch (error4) {
              console.log('모든 인코딩 시도 실패. 샘플 데이터 생성...');
              this.createSampleEmployees();
                return;
              }
            }
          }
        }

        const lines = csvContent.split('\n').filter(line => line.trim());
      console.log(`총 라인 수: ${lines.length}`);

      // CSV 구조: 첫 번째 줄이 헤더, 두 번째 줄부터 데이터
      // 헤더 제외하고 데이터 파싱 (두 번째 줄부터 시작)
      let employeeCount = 0;
      for (let i = 1; i < lines.length; i++) { // i = 1부터 시작 (두 번째 줄)
          const line = lines[i];
        
        // EMP-로 시작하는 직원 데이터만 처리
        if (line.startsWith('EMP-')) {
          // 쉼표로 구분된 데이터 파싱
          const columns = line.split(',').map(col => col.trim());
          
          console.log(`라인 ${i}: 컬럼 수 = ${columns.length}, 첫 번째 컬럼 = ${columns[0]}`);
          
          if (columns.length >= 21) { // 최소 필수 컬럼 수 확인 (21개 컬럼)
            // 직원 이름이 "직원XX" 형태인 경우 실제 이름으로 변환
            let employeeName = columns[1];
            if (employeeName.startsWith('직원') && employeeName.length > 2) {
              const employeeNumber = employeeName.substring(2); // "직원" 제거
              employeeName = `직원${employeeNumber}`; // 원래 형태 유지
            }
            
            const employee = {
              id: columns[0],
              name: employeeName,
              position: columns[2],
              department: columns[3],
              email: columns[5] || '',
              phone: columns[6] || '',
              hireDate: columns[7] || '',
              employeeNumber: columns[8] || '',
              salary: columns[13] || '',
              status: columns[20] || '재직중'
            };
            
            this.employees.push(employee);
            employeeCount++;
            
            if (employeeCount <= 5) { // 처음 5명만 로그 출력
              console.log(`직원 로드: ${employee.id} - ${employee.name} (${employee.department})`);
            }
          } else {
            console.log(`컬럼 수 부족 (${columns.length}): ${line.substring(0, 100)}...`);
          }
        }
      }

      console.log(`${employeeCount}명의 직원 데이터 로드 완료 (인코딩: utf8)`);

      if (this.employees.length === 0) {
        console.log('직원 데이터가 로드되지 않음. 샘플 데이터 생성...');
        this.createSampleEmployees();
      }
      
    } catch (error) {
      console.error('직원 데이터 로드 실패:', error);
      this.createSampleEmployees();
    }
  }

  // 기본 샘플 직원 데이터 생성 (백업용)
  private createSampleEmployees(): void {
    this.employees = [
      {
        id: "EMP-0001",
        name: "김민수",
        position: "과장",
        department: "인사팀",
        email: "kim.minsu@company.com",
        phone: "010-1234-5678",
        hireDate: "2020-01-15",
        employeeNumber: "123456",
        salary: "45000000",
        status: "재직중"
      },
      {
        id: "EMP-0002",
        name: "이영희",
        position: "대리",
        department: "개발팀",
        email: "lee.younghee@company.com",
        phone: "010-2345-6789",
        hireDate: "2019-03-20",
        employeeNumber: "234567",
        salary: "40000000",
        status: "재직중"
      },
      {
        id: "EMP-0003",
        name: "박철수",
        position: "사원",
        department: "마케팅팀",
        email: "park.chulsoo@company.com",
        phone: "010-3456-7890",
        hireDate: "2021-07-10",
        employeeNumber: "345678",
        salary: "35000000",
        status: "재직중"
      }
    ];
  }

  // Load annual leave data (새로 추가)
  private async loadAnnualLeaveData(): Promise<void> {
    try {
      // 연차 데이터 파일 경로
      const annualLeaveDataPath = path.join(__dirname, '..', '..', 'data', 'annual-leave-data.json');
      
      if (fs.existsSync(annualLeaveDataPath)) {
        // 기존 연차 데이터 파일에서 로드
        const data = JSON.parse(fs.readFileSync(annualLeaveDataPath, 'utf-8'));
        // 파일이 비어있거나 데이터가 부족하면 새로 생성
        if (data && data.length > 0 && data.length >= this.employees.filter(emp => emp.status === '재직중').length) {
          this.annualLeaveRecords = data;
        } else {
          // 새로 생성 로직 실행
          await this.generateAnnualLeaveData();
        }
      } else {
        // 연차 데이터 파일이 없으면 새로 생성
        await this.generateAnnualLeaveData();
      }
    } catch (error) {
      console.error('연차 데이터 로드 실패:', error);
      // 오류 발생 시 새로 생성
      await this.generateAnnualLeaveData();
    }
  }

  // 연차 데이터 생성 메서드 (새로 추가)
  private async generateAnnualLeaveData(): Promise<void> {
    this.annualLeaveRecords = [];
    
    // Excel 파일에서 연차 데이터 로드 시도
    try {
      const excelPath = path.join(__dirname, '..', '..', 'data', 'employee_annual_leave_2025.xlsx');
      if (fs.existsSync(excelPath)) {
        // Excel 파일이 있으면 기본 데이터 생성
        await this.loadAnnualLeaveFromExcel();
      }
    } catch (error) {
      // Excel에서 로드하지 못한 경우 기본 데이터 생성
    }
    
    // Excel에서 로드하지 못한 경우 기본 데이터 생성
    if (this.annualLeaveRecords.length === 0 && this.employees.length > 0) {
      // 재직중인 직원만 연차 데이터 생성
      const activeEmployees = this.employees.filter(emp => emp.status === '재직중');
      
      for (const emp of activeEmployees) {
        // 랜덤하게 사용한 연차 일수 생성 (0~15일)
        const usedDays = Math.floor(Math.random() * 16);
        const totalDays = 25; // 기본 연차 25일
        const remainingDays = totalDays - usedDays;
        
        // 사용한 연차 날짜들 생성 (2025년 기준)
        const usedDates: string[] = [];
        if (usedDays > 0) {
          for (let i = 0; i < usedDays; i++) {
            const month = Math.floor(Math.random() * 12) + 1;
            const day = Math.floor(Math.random() * 28) + 1;
            const date = `2025-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            if (!usedDates.includes(date)) {
              usedDates.push(date);
            }
          }
        }
        
        // 마지막 사용일 설정
        const lastUsedDate = usedDates.length > 0 ? usedDates[usedDates.length - 1] : undefined;
        
          this.annualLeaveRecords.push({
            employeeId: emp.id,
            employeeName: emp.name,
            department: emp.department,
            employeeNumber: emp.employeeNumber,
          totalDays: totalDays,
          usedDays: usedDays,
          remainingDays: remainingDays,
          usedDates: usedDates,
          lastUsedDate: lastUsedDate
        });
      }
    }
    
    // 파일에 저장
    await this.saveAnnualLeaveData();
  }

  // Excel 파일에서 연차 데이터 로드 (새로 추가)
  private async loadAnnualLeaveFromExcel(): Promise<void> {
    try {
      // xlsx 패키지가 설치되어 있지 않으면 기본 데이터 생성
      // 임시로 기본 데이터 생성 (상태 체크 없이)
      for (const emp of this.employees) {
        this.annualLeaveRecords.push({
          employeeId: emp.id,
          employeeName: emp.name,
          department: emp.department,
          employeeNumber: emp.employeeNumber,
          totalDays: 25,
          usedDays: Math.floor(Math.random() * 10),
          remainingDays: 25 - Math.floor(Math.random() * 10),
          usedDates: [],
          lastUsedDate: undefined
        });
      }
    } catch (error) {
      console.error('Excel 파일 로드 실패:', error);
    }
  }

  // 연차 데이터를 파일에 저장 (새로 추가)
  private async saveAnnualLeaveData(): Promise<void> {
    try {
      const annualLeaveDataPath = path.join(__dirname, '..', '..', 'data', 'annual-leave-data.json');
      const data = JSON.stringify(this.annualLeaveRecords, null, 2);
      fs.writeFileSync(annualLeaveDataPath, data, 'utf-8');
    } catch (error) {
      console.error('연차 데이터 저장 실패:', error);
    }
  }

  // 연차 사용 등록 (사번 인증 추가)
  async registerAnnualLeaveUse(employeeName: string, employeeNumber: string, useDate: string): Promise<{ success: boolean; message: string; updatedRecord?: AnnualLeaveRecord }> {
    try {
      // 사번으로 본인인증
      const record = this.annualLeaveRecords.find(r => 
        r.employeeName.toLowerCase().includes(employeeName.toLowerCase()) && 
        r.employeeNumber === employeeNumber
      );
      
      if (!record) {
        return { success: false, message: '직원 이름과 사번이 일치하지 않습니다. 본인인증을 확인해주세요.' };
      }
      
      if (record.usedDates.includes(useDate)) {
        return { success: false, message: '이미 사용한 날짜입니다.' };
      }
      
      if (record.remainingDays <= 0) {
        return { success: false, message: '사용 가능한 연차가 없습니다.' };
      }
      
      record.usedDates.push(useDate);
      record.usedDays += 1;
      record.remainingDays -= 1;
      record.lastUsedDate = useDate;
      
      await this.saveAnnualLeaveData();
      
      return { 
        success: true, 
        message: `${record.employeeName}님이 ${useDate}에 연차를 사용했습니다. 남은 연차: ${record.remainingDays}일`, 
        updatedRecord: record 
      };
    } catch (error) {
      console.error('연차 사용 등록 실패:', error);
      return { success: false, message: '연차 사용 등록 중 오류가 발생했습니다.' };
    }
  }

  // 연차 취소 (사번 인증 추가)
  async cancelAnnualLeaveUse(employeeName: string, employeeNumber: string, cancelDate: string): Promise<{ success: boolean; message: string; updatedRecord?: AnnualLeaveRecord }> {
    try {
      // 사번으로 본인인증
      const record = this.annualLeaveRecords.find(r => 
        r.employeeName.toLowerCase().includes(employeeName.toLowerCase()) &&
        r.employeeNumber === employeeNumber
      );

      if (!record) {
        return { success: false, message: '직원 이름과 사번이 일치하지 않습니다. 본인인증을 확인해주세요.' };
      }

      // 사용한 날짜인지 확인
      if (!record.usedDates.includes(cancelDate)) {
        return { success: false, message: '해당 날짜에 사용한 연차가 없습니다.' };
      }

      // 연차 사용 취소
      record.usedDates = record.usedDates.filter(date => date !== cancelDate);
      record.usedDays -= 1;
      record.remainingDays += 1;
      
      // 마지막 사용일 업데이트
      if (record.usedDates.length > 0) {
        record.lastUsedDate = record.usedDates[record.usedDates.length - 1];
      } else {
        record.lastUsedDate = undefined;
      }

      // 데이터를 파일에 저장
      await this.saveAnnualLeaveData();

      return { 
        success: true, 
        message: `${record.employeeName}님이 ${cancelDate} 연차 사용을 취소했습니다. 남은 연차: ${record.remainingDays}일`,
        updatedRecord: record
      };

    } catch (error) {
      console.error('연차 사용 취소 실패:', error);
      return { success: false, message: '연차 사용 취소 중 오류가 발생했습니다.' };
    }
  }

  // Process HWP files directly (simulated)
  private async processHWPFiles(): Promise<void> {
    // Simplified sample data for HWP files (10 articles)
    const sampleChunks: ChunkedDocument[] = [
      { content: '근로기준법 제1조(목적) - 이 법은 근로조건의 기준을 정함으로써 근로자의 기본적 생활을 보장, 향상시키며 균형 있는 국민경제의 발전에 도움이 되도록 하는 것을 목적으로 한다.', metadata: { source: '근로기준법', chunkIndex: 0, title: '근로기준법 제1조' } },
      { content: '근로기준법 제2조(정의) - 이 법에서 "근로자"란 직업의 종류와 관계없이 임금을 목적으로 사업이나 사업장에 근로를 제공하는 자를 말한다.', metadata: { source: '근로기준법', chunkIndex: 1, title: '근로기준법 제2조' } },
      { content: '근로기준법 제3조(적용 범위) - 이 법은 상시 5명 이상의 근로자를 사용하는 모든 사업 또는 사업장에 적용한다.', metadata: { source: '근로기준법', chunkIndex: 2, title: '근로기준법 제3조' } },
      { content: '근로기준법 제4조(적용 범위) - 이 법은 상시 4명 이하의 근로자를 사용하는 사업 또는 사업장에 대하여는 대통령령으로 정하는 바에 따라 이 법의 일부 규정을 적용할 수 있다.', metadata: { source: '근로기준법', chunkIndex: 3, title: '근로기준법 제4조' } },
      { content: '근로기준법 제5조(적용 범위) - 이 법은 상시 1명의 근로자를 사용하는 사업 또는 사업장에 대하여는 대통령령으로 정하는 바에 따라 이 법의 일부 규정을 적용할 수 있다.', metadata: { source: '근로기준법', chunkIndex: 4, title: '근로기준법 제5조' } },
      { content: '근로기준법 제6조(적용 범위) - 이 법은 상시 1명 이하의 근로자를 사용하는 사업 또는 사업장에 대하여는 대통령령으로 정하는 바에 따라 이 법의 일부 규정을 적용할 수 있다.', metadata: { source: '근로기준법', chunkIndex: 5, title: '근로기준법 제6조' } },
      { content: '근로기준법 제7조(적용 범위) - 이 법은 상시 1명 미만의 근로자를 사용하는 사업 또는 사업장에 대하여는 대통령령으로 정하는 바에 따라 이 법의 일부 규정을 적용할 수 있다.', metadata: { source: '근로기준법', chunkIndex: 6, title: '근로기준법 제7조' } },
      { content: '근로기준법 제8조(적용 범위) - 이 법은 상시 1명 미만의 근로자를 사용하는 사업 또는 사업장에 대하여는 대통령령으로 정하는 바에 따라 이 법의 일부 규정을 적용할 수 있다.', metadata: { source: '근로기준법', chunkIndex: 7, title: '근로기준법 제8조' } },
      { content: '근로기준법 제9조(적용 범위) - 이 법은 상시 1명 미만의 근로자를 사용하는 사업 또는 사업장에 대하여는 대통령령으로 정하는 바에 따라 이 법의 일부 규정을 적용할 수 있다.', metadata: { source: '근로기준법', chunkIndex: 8, title: '근로기준법 제9조' } },
      { content: '근로기준법 제10조(적용 범위) - 이 법은 상시 1명 미만의 근로자를 사용하는 사업 또는 사업장에 대하여는 대통령령으로 정하는 바에 따라 이 법의 일부 규정을 적용할 수 있다.', metadata: { source: '근로기준법', chunkIndex: 9, title: '근로기준법 제10조' } }
    ];

    this.chunks = sampleChunks;
  }

  // Similarity search (simple keyword matching)
  async search(query: string, limit: number = 5): Promise<ChunkedDocument[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const queryLower = query.toLowerCase();
    const results: ChunkedDocument[] = [];

    // Keyword-based search
    for (const chunk of this.chunks) {
      const score = this.calculateSimilarity(queryLower, chunk.content.toLowerCase());
      if (score > 0.1) { // Threshold
        results.push({ ...chunk, score });
      }
    }

    // Sort by score and return up to limit
    return results
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, limit)
      .map(({ score, ...chunk }) => chunk);
  }

  // Employee search
  async searchEmployees(query: string, limit: number = 10): Promise<Employee[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const queryLower = query.toLowerCase();
    const results: Employee[] = [];

    // 1. 정확한 이름 매칭을 우선 (가장 정확함)
    const exactNameMatches = this.employees.filter(emp => 
      emp.name.toLowerCase() === queryLower
    );
    
    if (exactNameMatches.length > 0) {
      console.log(`정확한 이름 매칭 발견: ${exactNameMatches[0].name}`);
      return exactNameMatches.slice(0, limit);
    }

    // 2. 부분 이름 매칭 (두 번째로 정확함)
    const nameMatches = this.employees.filter(emp => 
      emp.name.toLowerCase().includes(queryLower)
    );
    
    if (nameMatches.length > 0) {
      console.log(`이름 부분 매칭 발견: ${nameMatches[0].name}`);
      return nameMatches.slice(0, limit);
    }

    // 3. 기타 매칭 (직급, 부서, 이메일)
    for (const emp of this.employees) {
      if (emp.position.toLowerCase().includes(queryLower) ||
          emp.department.toLowerCase().includes(queryLower) ||
          emp.email.toLowerCase().includes(queryLower)) {
        results.push(emp);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  // Annual leave search (새로 추가)
  async searchAnnualLeave(query: string, limit: number = 10): Promise<AnnualLeaveRecord[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const queryLower = query.toLowerCase();
    const results: AnnualLeaveRecord[] = [];

    for (const record of this.annualLeaveRecords) {
      if (record.employeeName.toLowerCase().includes(queryLower) ||
          record.department.toLowerCase().includes(queryLower) ||
          record.employeeId.toLowerCase().includes(queryLower)) {
        results.push(record);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  // Get annual leave by employee ID (새로 추가)
  getAnnualLeaveByEmployeeId(employeeId: string): AnnualLeaveRecord | null {
    return this.annualLeaveRecords.find(record => record.employeeId === employeeId) || null;
  }

  // Get annual leave by employee name (새로 추가)
  getAnnualLeaveByEmployeeName(employeeName: string): AnnualLeaveRecord | null {
    return this.annualLeaveRecords.find(record =>
      record.employeeName.toLowerCase().includes(employeeName.toLowerCase())
    ) || null;
  }

  // Simple similarity calculation (keyword matching)
  private calculateSimilarity(query: string, content: string): number {
    const queryWords = query.split(/\s+/).filter(word => word.length > 1);
    let matchCount = 0;

    for (const word of queryWords) {
      if (content.includes(word)) {
        matchCount++;
      }
    }

    return matchCount / queryWords.length;
  }

  // Return all chunked data
  getAllChunks(): ChunkedDocument[] {
    return [...this.chunks];
  }

  // Return all employee data
  getAllEmployees(): Employee[] {
    return [...this.employees];
  }

  // Return all annual leave data (새로 추가)
  getAllAnnualLeaveRecords(): AnnualLeaveRecord[] {
    return [...this.annualLeaveRecords];
  }

  // Statistics information
  getStats() {
    return {
      totalChunks: this.chunks.length,
      totalEmployees: this.employees.length,
      totalAnnualLeaveRecords: this.annualLeaveRecords.length, // 연차 데이터 수 추가
      sources: [...new Set(this.chunks.map(chunk => chunk.metadata.source))],
      departments: [...new Set(this.employees.map(emp => emp.department))],
      isInitialized: this.isInitialized
    };
  }
}

// Singleton instance
const simpleVectorDatabase = new SimpleVectorDatabase();

export { simpleVectorDatabase, SimpleVectorDatabase, ChunkedDocument, Employee, AnnualLeaveRecord }; // AnnualLeaveRecord 인터페이스 추가
export default simpleVectorDatabase; 