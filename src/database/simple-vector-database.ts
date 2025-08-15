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

    console.log('간단한 벡터 데이터베이스 초기화 중...');

    try {
      // Check for processed data file
      const processedDataPath = path.join(__dirname, '..', '..', 'processed-data.json');

      if (fs.existsSync(processedDataPath)) {
        // Load existing processed data
        const data = JSON.parse(fs.readFileSync(processedDataPath, 'utf-8')) as ProcessedData;
        this.chunks = data.chunks;
        console.log(`기존 처리된 데이터 로드: ${this.chunks.length}개 청킹`);
      } else {
        // Process HWP files directly (simulated)
        await this.processHWPFiles();
      }

      // Load employee data
      await this.loadEmployeeData();

      // Load annual leave data
      await this.loadAnnualLeaveData();

      this.isInitialized = true;
      console.log('간단한 벡터 데이터베이스 초기화 완료');

    } catch (error) {
      console.error('간단한 벡터 데이터베이스 초기화 실패:', error);
      throw error;
    }
  }

  // Load employee data
  private async loadEmployeeData(): Promise<void> {
    try {
      const csvPath = path.join(__dirname, '..', '..', 'data', 'dummy_employees_100.csv');
      if (fs.existsSync(csvPath)) {
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        // Parse data, skipping header
        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',');
          if (columns.length >= 21) { // Ensure enough columns
            this.employees.push({
              id: columns[0],
              name: columns[1],
              position: columns[2],
              department: columns[3],
              email: columns[5],
              phone: columns[6],
              hireDate: columns[7],
              employeeNumber: columns[8], // 사번 추가
              salary: columns[13],
              status: columns[20] // 퇴직여부 컬럼
            });
          }
        }

        console.log(`${this.employees.length}명의 직원 데이터 로드 완료`);
      }
    } catch (error) {
      console.error('직원 데이터 로드 실패:', error);
    }
  }

  // Load annual leave data (새로 추가)
  private async loadAnnualLeaveData(): Promise<void> {
    try {
      // 연차 데이터 파일 경로
      const annualLeaveDataPath = path.join(__dirname, '..', '..', 'data', 'annual-leave-data.json');
      
      if (fs.existsSync(annualLeaveDataPath)) {
        // 기존 연차 데이터 파일에서 로드
        const data = JSON.parse(fs.readFileSync(annualLeaveDataPath, 'utf-8'));
        this.annualLeaveRecords = data;
        console.log(`기존 연차 데이터 로드: ${this.annualLeaveRecords.length}명`);
      } else {
        // 100명의 모든 직원에 대해 연차 데이터 자동 생성
        this.annualLeaveRecords = [];
        
        // 직원 데이터가 로드된 후에 실행되어야 함
        if (this.employees.length > 0) {
          for (const emp of this.employees) {
            // 퇴직한 직원은 제외
            if (emp.status === '재직중') {
              this.annualLeaveRecords.push({
                employeeId: emp.id,
                employeeName: emp.name,
                department: emp.department,
                employeeNumber: emp.id, // 사번 추가
                totalDays: 25,
                usedDays: 0,
                remainingDays: 25,
                usedDates: [],
                lastUsedDate: undefined
              });
            }
          }
        } else {
          // 기본 샘플 데이터 (직원 데이터가 아직 로드되지 않은 경우)
          this.annualLeaveRecords = [
            {
              employeeId: "EMP001",
              employeeName: "김민수",
              department: "인사팀",
              employeeNumber: "123456",
              totalDays: 25,
              usedDays: 8,
              remainingDays: 17,
              usedDates: ["2025-01-15", "2025-02-20", "2025-03-10"],
              lastUsedDate: "2025-03-10"
            },
            {
              employeeId: "EMP002",
              employeeName: "이영희",
              department: "개발팀",
              employeeNumber: "234567",
              totalDays: 25,
              usedDays: 12,
              remainingDays: 13,
              usedDates: ["2025-01-20", "2025-02-15", "2025-03-05"],
              lastUsedDate: "2025-03-05"
            },
            {
              employeeId: "EMP003",
              employeeName: "박철수",
              department: "마케팅팀",
              employeeNumber: "345678",
              totalDays: 25,
              usedDays: 5,
              remainingDays: 20,
              usedDates: ["2025-02-10"],
              lastUsedDate: "2025-02-10"
            }
          ];
        }
        
        // 초기 데이터를 파일에 저장
        await this.saveAnnualLeaveData();
        console.log(`${this.annualLeaveRecords.length}명의 연차 데이터 초기화 및 저장 완료`);
      }
    } catch (error) {
      console.error('연차 데이터 로드 실패:', error);
    }
  }

  // 연차 데이터를 파일에 저장 (새로 추가)
  private async saveAnnualLeaveData(): Promise<void> {
    try {
      const annualLeaveDataPath = path.join(__dirname, '..', '..', 'data', 'annual-leave-data.json');
      const data = JSON.stringify(this.annualLeaveRecords, null, 2);
      fs.writeFileSync(annualLeaveDataPath, data, 'utf-8');
      console.log('연차 데이터 파일 저장 완료');
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
    console.log('HWP 파일 직접 처리 중...');

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
    console.log(`${this.chunks.length}개 샘플 청킹 생성 완료`);
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

    for (const emp of this.employees) {
      if (emp.name.toLowerCase().includes(queryLower) ||
          emp.position.toLowerCase().includes(queryLower) ||
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