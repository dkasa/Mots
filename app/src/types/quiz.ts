export interface QuizQuestion {
  id: string;
  type: QuizType;
  wordId: string;
  question: string;
  correctAnswer: string;
  options: string[];
  audioUrl?: string;
  explanation?: string;
  voiceType?: 'male' | 'female';
  aiGenerated?: boolean;
  wordBlocks?: string[];
  shuffledBlocks?: string[];
  // 题库ID（如果是从题库中抽取的）
  questionId?: number;
}

export interface QuizResult {
  questionId: string;
  wordId: string;
  isCorrect: boolean;
  timeSpent: number; // 毫秒
  selectedAnswer?: string;
  timestamp: number;
}

export interface QuizSession {
  id: string;
  mode: QuizMode;
  grade?: number;
  courseSelection?: any;
  questions: QuizQuestion[];
  results: QuizResult[];
  startTime: number;
  endTime?: number;
  isCompleted: boolean;
}

export interface WordMemory {
  wordId: string;
  totalAttempts: number;
  correctAttempts: number;
  lastAttempted: number;
  lastCorrect: number;
  consecutiveCorrect: number;
  memoryLevel: MemoryLevel;
  averageTime: number;
}

export type QuizType = 
  | 'chinese-to-french'      // 看中文选外语
  | 'french-to-chinese'      // 看外语选中文
  | 'audio-to-chinese'       // 听音频选中文意思
  | 'audio-to-french'        // 听音频选外语拼写
  | 'spelling'               // 拼写/填空
  | 'sentence-completion'    // 句子填空补全
  | 'sentence-reordering';    // 词卡重组句子

export type QuizMode = 
  | 'current-range'          // 当前范围小测
  | 'previous-errors'        // 错词复测

export type MemoryLevel = 0 | 1 | 2 | 3 | 4;

export type QuizConfig = {
  mode: QuizMode;
  questionCount: number;
  questionTypes: QuizType[];
  timeLimit?: number; // 分钟
  includeAudio: boolean;
  includeSpelling: boolean;
  includeSentence: boolean;
};

export interface QuizStats {
  totalQuizzes: number;
  totalQuestions: number;
  correctAnswers: number;
  averageTime: number;
  bestStreak: number;
  accuracyRate: number;
}

// 记忆等级定义
const MEMORY_LEVELS = {
  0: { name: '新词', reviewInterval: 1 }, // 1天后
  1: { name: '错过', reviewInterval: 1 }, // 1天后
  2: { name: '正确1次', reviewInterval: 3 }, // 3天后
  3: { name: '连续正确', reviewInterval: 7 }, // 7天后
  4: { name: '熟练', reviewInterval: 30 } // 30天后
} as const;