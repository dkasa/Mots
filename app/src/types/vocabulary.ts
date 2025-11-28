export interface Word {
  french: string;
  chinese: string;
  phonetic: string;
  part_of_speech: string;
  category?: string;
  unit?: number; // 单元编号
}

export interface WordWithStatus extends Word {
  id: string;
  grade: 71 | 72 | 81 | 82 | 91 | 92;
  isLearned: boolean;
  isMastered: boolean;
}

export type Grade = 71 | 72 | 81 | 82 | 91 | 92;
export type FilterType = 'all' | 'mastered' | 'not-mastered';
export type ViewMode = 'learn' | 'list' | 'search';

// 新增范围选择类型
export type SelectionMode = 'grade-all' | 'grade-unit' | 'grade-count';

// 单元选择范围
export interface UnitRange {
  startUnit: number;
  endUnit: number;
}

// 单词数量选择
export interface CountSelection {
  count: 10 | 20 | 50 | 100;
}

export interface AppState {
  currentGrade: Grade;
  currentViewMode: ViewMode;
  currentFilter: FilterType;
  wordsWithStatus: WordWithStatus[];
  learnedWords: Record<string, boolean>; // word id -> learned status
  masteredWords: Record<string, boolean>; // word id -> mastered status
  
  // 新增范围选择状态
  selectionMode: SelectionMode;
  unitRange?: UnitRange;
  countSelection?: CountSelection;
}

export interface ProgressData {
  total: number;
  learned: number;
  mastered: number;
  percentage: number;
}
