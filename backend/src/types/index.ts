export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface UserProgress {
  id: number;
  user_id: number;
  word_id: string;
  grade: number;
  is_learned: boolean;
  is_mastered: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: number;
  user_id: number;
  current_grade: number;
  current_view_mode: 'learn' | 'list' | 'search';
  current_filter: 'all' | 'mastered' | 'not-mastered';
  created_at: string;
  updated_at: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user: {
    id: number;
    username: string;
    email: string;
  };
  token: string;
}

export interface ProgressSyncRequest {
  learnedWords: Record<string, boolean>;
  masteredWords: Record<string, boolean>;
  currentGrade: number;
  currentViewMode: 'learn' | 'list' | 'search' | 'quiz' | 'listening';
  currentFilter: 'all' | 'mastered' | 'not-mastered';
  clientTimestamp?: string; // 客户端时间戳
  wordProgressTimestamps?: Record<string, string>; // 单词级别的时间戳
}

export interface ProgressSyncResponse {
  success: boolean;
  data: {
    learnedWords: Record<string, boolean>;
    masteredWords: Record<string, boolean>;
    currentGrade: number;
    currentViewMode: 'learn' | 'list' | 'search';
    currentFilter: 'all' | 'mastered' | 'not-mastered';
  };
}