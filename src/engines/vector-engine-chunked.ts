import * as fs from 'fs-extra';
import * as path from 'path';
import { OpenAI } from 'openai';

// 인터페이스 정의
export interface Chunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    type: 'legal' | 'employee' | 'regulation';
    articleNumber?: string;
    title?: string;
    context?: string;
  };
  vector?: number[];
}

export interface VectorSearchResult {
  chunk: Chunk;
  similarity: number;
}

// OpenAI 클라이언트
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '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'
});

// 청킹 설정
const CHUNK_SIZE = 1000; // 토큰 수 (약 750단어)
const CHUNK_OVERLAP = 200; // 오버랩 토큰 수

// 벡터 저장소
let chunks: Chunk[] = [];
let vectors: number[][] = [];

// 텍스트를 청크로 분할하는 함수
function splitIntoChunks(text: string, metadata: Chunk['metadata']): Chunk[] {
  const chunks: Chunk[] = [];
  
  // 문장 단위로 분할
  const sentences = text.split(/[.!?。！？]/).filter(s => s.trim().length > 10);
  
  let currentChunk = '';
  let chunkId = 0;
  
  for (const sentence of sentences) {
    const sentenceWithPunctuation = sentence + '.';
    
    // 현재 청크에 문장을 추가했을 때 크기 확인
    if ((currentChunk + sentenceWithPunctuation).length > CHUNK_SIZE) {
      if (currentChunk.trim()) {
        chunks.push({
          id: `${metadata.source}_chunk_${chunkId++}`,
          content: currentChunk.trim(),
          metadata: { ...metadata }
        });
      }
      
      // 오버랩을 위해 마지막 부분을 유지
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 5)); // 단어당 약 5글자로 추정
      currentChunk = overlapWords.join(' ') + ' ' + sentenceWithPunctuation;
    } else {
      currentChunk += sentenceWithPunctuation + ' ';
    }
  }
  
  // 마지막 청크 추가
  if (currentChunk.trim()) {
    chunks.push({
      id: `${metadata.source}_chunk_${chunkId++}`,
      content: currentChunk.trim(),
      metadata: { ...metadata }
    });
  }
  
  return chunks;
}

// 법령 문서를 청킹하는 함수
function chunkLegalDocument(title: string, articles: { [key: string]: string }): Chunk[] {
  const chunks: Chunk[] = [];
  
  for (const [articleNumber, content] of Object.entries(articles)) {
    const articleChunks = splitIntoChunks(content, {
      source: title,
      type: 'legal',
      articleNumber,
      title: `${title} ${articleNumber}`
    });
    
    chunks.push(...articleChunks);
  }
  
  return chunks;
}

// 직원 정보를 청킹하는 함수
function chunkEmployeeData(employees: any[], source: string): Chunk[] {
  const chunks: Chunk[] = [];
  
  // 직원들을 그룹으로 나누어 청킹
  const groupSize = 10; // 10명씩 그룹화
  
  for (let i = 0; i < employees.length; i += groupSize) {
    const group = employees.slice(i, i + groupSize);
    const groupContent = group.map(emp => 
      `${emp.name} (${emp.position}, ${emp.department}) - ${emp.email}`
    ).join('\n');
    
    chunks.push({
      id: `${source}_employee_group_${Math.floor(i / groupSize)}`,
      content: groupContent,
      metadata: {
        source,
        type: 'employee',
        title: `직원 정보 그룹 ${Math.floor(i / groupSize) + 1}`,
        context: `${group.length}명의 직원 정보`
      }
    });
  }
  
  return chunks;
}

// 부속규정을 청킹하는 함수
function chunkRegulations(regulations: any[], source: string): Chunk[] {
  const chunks: Chunk[] = [];
  
  for (const regulation of regulations) {
    const regulationChunks = splitIntoChunks(regulation.content, {
      source,
      type: 'regulation',
      title: regulation.title,
      context: `시행일: ${regulation.effectiveDate}`
    });
    
    chunks.push(...regulationChunks);
  }
  
  return chunks;
}

// 벡터 생성 함수 (배치 처리)
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  console.log(`🔢 ${texts.length}개 텍스트의 벡터 생성 중...`);
  
  const embeddings: number[][] = [];
  
  // 배치 크기 (메모리 효율성을 위해 작게 설정)
  const batchSize = 5;
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
        encoding_format: 'float'
      });
      
      const batchEmbeddings = response.data.map(item => item.embedding);
      embeddings.push(...batchEmbeddings);
      
      console.log(`✅ 배치 ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} 완료`);
      
      // API 호출 제한을 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`❌ 배치 ${Math.floor(i / batchSize) + 1} 벡터 생성 실패:`, error.message);
      
      // 실패한 배치에 대해 더미 벡터 생성
      for (let j = 0; j < batch.length; j++) {
        embeddings.push(new Array(1536).fill(0)); // text-embedding-3-small은 1536차원
      }
    }
  }
  
  return embeddings;
}

// 코사인 유사도 계산
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 벡터 검색 함수
export function searchVectors(query: string, topK: number = 5): VectorSearchResult[] {
  if (chunks.length === 0 || vectors.length === 0) {
    console.warn('⚠️  벡터가 초기화되지 않았습니다.');
    return [];
  }
  
  // 쿼리 벡터 생성 (동기적으로 처리)
  const queryVector = generateQueryVector(query);
  
  // 모든 청크와의 유사도 계산
  const similarities: VectorSearchResult[] = chunks.map((chunk, index) => ({
    chunk,
    similarity: cosineSimilarity(queryVector, vectors[index])
  }));
  
  // 유사도 순으로 정렬하고 상위 K개 반환
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter(result => result.similarity > 0.1); // 임계값 이상만
}

// 쿼리 벡터 생성 (개선된 키워드 가중치 기반)
function generateQueryVector(query: string): number[] {
  const vector = new Array(1536).fill(0);
  const words = query.toLowerCase().split(/\s+/);
  
  // 키워드 가중치 정의
  const keywordWeights: { [key: string]: number } = {
    // 법령 관련 키워드 (높은 가중치)
    '근로기준법': 3.0, '법률': 2.5, '법령': 2.5, '조문': 2.0, '조항': 2.0,
    '임금': 2.0, '근무시간': 2.0, '휴가': 2.0, '연차': 2.0, '휴일': 2.0,
    
    // 부속규정 관련 키워드 (높은 가중치)
    '인사규정': 3.0, '사내규정': 2.5, '부속규정': 2.5, '회사규정': 2.5,
    '출장비': 2.0, '재택근무': 2.0, '교육훈련': 2.0, '복리후생': 2.0,
    
    // 직원 관련 키워드 (중간 가중치)
    '직원': 1.5, '사원': 1.5, '대리': 1.5, '과장': 1.5, '차장': 1.5,
    '부장': 1.5, '이사': 1.5, '개발팀': 1.5, '기획팀': 1.5, '인사팀': 1.5,
    
    // 일반 키워드 (기본 가중치)
    '규정': 1.0, '지침': 1.0, '가이드라인': 1.0, '정책': 1.0
  };
  
  for (const word of words) {
    // 키워드 가중치 적용
    const weight = keywordWeights[word] || 1.0;
    
    // 해시 함수로 벡터 위치 결정
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0xffffffff;
    }
    const index = Math.abs(hash) % 1536;
    
    // 가중치를 벡터에 반영
    vector[index] = Math.min(vector[index] + weight, 3.0); // 최대 3.0으로 제한
  }
  
  return vector;
}

// 벡터 데이터베이스 초기화
export async function initializeVectorDatabase(
  legalDocuments: any[],
  employeeData: any,
  companyRegulations: any[]
): Promise<void> {
  console.log('🚀 벡터 데이터베이스 초기화 중...');
  
  chunks = [];
  
  // 1. 법령 문서 청킹
  for (const doc of legalDocuments) {
    const legalChunks = chunkLegalDocument(doc.title, doc.articles);
    chunks.push(...legalChunks);
    console.log(`📋 ${doc.title}: ${legalChunks.length}개 청크 생성`);
  }
  
  // 2. 직원 정보 청킹
  const employeeChunks = chunkEmployeeData(employeeData.employees, '직원정보');
  chunks.push(...employeeChunks);
  console.log(`👥 직원 정보: ${employeeChunks.length}개 청크 생성`);
  
  // 3. 부속규정 청킹
  const regulationChunks = chunkRegulations(companyRegulations, '부속규정');
  chunks.push(...regulationChunks);
  console.log(`📋 부속규정: ${regulationChunks.length}개 청크 생성`);
  
  console.log(`📊 총 ${chunks.length}개 청크 생성 완료`);
  
  // 4. 벡터 생성
  const texts = chunks.map(chunk => chunk.content);
  vectors = await generateEmbeddings(texts);
  
  // 5. 벡터를 청크에 연결
  chunks.forEach((chunk, index) => {
    chunk.vector = vectors[index];
  });
  
  console.log('✅ 벡터 데이터베이스 초기화 완료!');
}

// 벡터 데이터 저장
export async function saveVectorDatabase(): Promise<void> {
  try {
    const data = {
      chunks: chunks.map(chunk => ({
        ...chunk,
        vector: chunk.vector
      })),
      timestamp: new Date().toISOString()
    };
    
    await fs.writeJSON('./vector-database.json', data, { spaces: 2 });
    console.log('💾 벡터 데이터베이스 저장 완료');
  } catch (error: any) {
    console.error('❌ 벡터 데이터베이스 저장 실패:', error.message);
  }
}

// 벡터 데이터 로드
export async function loadVectorDatabase(): Promise<boolean> {
  try {
    if (await fs.pathExists('./vector-database.json')) {
      const data = await fs.readJSON('./vector-database.json');
      chunks = data.chunks;
      vectors = chunks.map(chunk => chunk.vector || []);
      console.log('📂 벡터 데이터베이스 로드 완료');
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('❌ 벡터 데이터베이스 로드 실패:', error.message);
    return false;
  }
} 