// 后端AI配置类型定义

export interface AIConnectionConfig {
  id: string;
  user_id: number;
  name: string;
  type: AIProviderType;
  base_url: string;
  api_key: string;
  model: string;
  max_tokens?: number;
  temperature?: number;
  enabled: boolean;
  is_system_default?: boolean; // 是否为系统默认配置
  created_at: string;
  updated_at: string;
}

export type AIProviderType = 'openai' | 'siliconflow';

export interface AICompletionRequest {
  prompt: string;
  model: string;
  max_tokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface SentenceGenerationRequest {
  word: string;
  meaning: string;
  frenchWord: string;
  grade: number;
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: 'sentence-completion' | 'sentence-reordering';
}

export interface SentenceGenerationResponse {
  original_sentence: string;
  modified_sentence?: string;
  options?: string[];
  correct_answer?: string;
  word_blocks?: string[];
  shuffled_blocks?: string[];
  explanation: string;
  questionId?: number; // 添加题库ID字段
}

export interface AIService {
  generateSentenceQuestion(request: SentenceGenerationRequest): Promise<SentenceGenerationResponse>;
  testConnection(config: AIConnectionConfig): Promise<boolean>;
}