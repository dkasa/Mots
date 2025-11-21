export interface Word {
  french: string;
  chinese: string;
  phonetic: string;
  part_of_speech: string;
  category?: string;
}

export interface WordWithStatus extends Word {
  id: string;
  grade: 71 | 72 | 81 | 82 | 91 | 92;
  isLearned: boolean;
  isMastered: boolean;
}

export type Grade = 71 | 72 | 81 | 82 | 91 | 92;
export type FilterType = 'all' | 'mastered' | 'not-mastered';
export type ViewMode = 'learn' | 'list';

export interface AppState {
  currentGrade: Grade;
  currentViewMode: ViewMode;
  currentFilter: FilterType;
  wordsWithStatus: WordWithStatus[];
  learnedWords: Record<string, boolean>; // word id -> learned status
  masteredWords: Record<string, boolean>; // word id -> mastered status
}

export interface ProgressData {
  total: number;
  learned: number;
  mastered: number;
  percentage: number;
}
