export interface Word {
  french: string;
  chinese: string;
  phonetic: string;
  part_of_speech: string;
  category?: string;
  unit?: number; // 单元编号
  lesson?: string | number; // 课次编号，可以是数字或字符串（如"Atelier"）
  examples?: string[]; // 例句，可选
}

export interface WordWithStatus extends Word {
  id: string;
  grade: 71 | 72 | 81 | 82 | 91 | 92;
  isLearned: boolean;
  isMastered: boolean;
}

export type Grade = 71 | 72 | 81 | 82 | 91 | 92;
export type FilterType = 'all' | 'mastered' | 'not-mastered';
export type ViewMode = 'learn' | 'list' | 'search' | 'quiz';

// 新增范围选择类型
export type SelectionMode = 'grade-all' | 'grade-course' | 'grade-unit' | 'grade-lesson' | 'grade-count';

// 单元选择范围
export interface UnitRange {
  startUnit: number;
  endUnit: number;
}

// 课次选择范围
export interface LessonRange {
  unit: number; // 所属单元
  startLesson: string | number; // 开始课次
  endLesson: string | number; // 结束课次
}

// 课程选择（合并单元和课次）
export interface CourseSelection {
  selectedUnits: number[]; // 选中的单元列表
  selectedLessons: string[]; // 选中的课次列表
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
  courseSelection?: CourseSelection;
  countSelection?: CountSelection;
}

export interface ProgressData {
  total: number;
  learned: number;
  mastered: number;
  percentage: number;
}