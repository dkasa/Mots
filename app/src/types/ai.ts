// AI配置类型定义

export interface AIConnectionConfig {
  id: string;
  name: string;
  type: AIProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AIProviderType = 'openai' | 'siliconflow';

export interface AIProvider {
  type: AIProviderType;
  name: string;
  description: string;
  baseUrl: string;
  supportedModels: string[];
}

export interface AICompletionRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SentenceQuestion {
  id: string;
  type: 'sentence-completion' | 'sentence-reordering';
  wordId: string;
  targetWord: string;
  originalSentence: string;
  modifiedSentence: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  aiGenerated: boolean;
  // AI生成的数据字段
  wordBlocks?: string[];
  shuffledBlocks?: string[];
}

export interface SentenceGenerationRequest {
  word: string;
  meaning: string;
  frenchWord: string;
  grade: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'completion' | 'reordering';
}

export interface SentenceGenerationResponse {
  originalSentence: string;
  modifiedSentence: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

// 预设的AI提供商配置
export const AI_PROVIDERS: AIProvider[] = [
  {
    type: 'openai',
    name: 'OpenAI',
    description: 'OpenAI API服务，兼容多种模型',
    baseUrl: 'https://api.openai.com/v1',
    supportedModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
  },
  {
    type: 'siliconflow',
    name: '硅基流动',
    description: '硅基流动AI服务，国内高速访问',
    baseUrl: 'https://api.siliconflow.cn/v1',
    supportedModels: ['deepseek-llm-7b-chat', 'deepseek-coder-6.7b-instruct']
  }
];