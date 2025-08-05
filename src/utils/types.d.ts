// 기본 타입 정의
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ChatApiResponse extends ApiResponse {
  response?: string;
  sessionId?: string;
}

// 환경 변수 타입
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY?: string;
      NODE_ENV?: 'development' | 'production';
      PORT?: string;
    }
  }
} 