export interface User {
  id: number;
  username: string;
  email: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  user: User;
  token: string;
}

export interface ProgressSyncData {
  learnedWords: Record<string, boolean>;
  masteredWords: Record<string, boolean>;
  currentGrade: number;
  currentViewMode: 'learn' | 'list';
  currentFilter: 'all' | 'mastered' | 'not-mastered';
  clientTimestamp?: string; // 客户端时间戳
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  syncInProgress: boolean;
  hasUnsyncedChanges: boolean;
}