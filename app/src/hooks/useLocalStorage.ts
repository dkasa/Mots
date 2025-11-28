import { useState, useEffect, useCallback } from 'react';
import { Grade, FilterType, ViewMode, SelectionMode, UnitRange, CountSelection } from '../types/vocabulary';
import { ProgressSyncData } from '../types/auth';

const STORAGE_KEYS = {
  CURRENT_GRADE: 'french-app-current-grade',
  CURRENT_VIEW_MODE: 'french-app-current-view-mode',
  CURRENT_FILTER: 'french-app-current-filter',
  LEARNED_WORDS: 'french-app-learned-words',
  MASTERED_WORDS: 'french-app-mastered-words',
  SELECTION_MODE: 'french-app-selection-mode',
  UNIT_RANGE: 'french-app-unit-range',
  COUNT_SELECTION: 'french-app-count-selection',
  DARK_MODE: 'french-app-dark-mode',
};

export function useLocalStorage() {
  const [currentGrade, setCurrentGrade] = useState<Grade>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_GRADE);
    const grade = saved ? parseInt(saved) as Grade : 81;
    return (grade === 71 || grade === 72 || grade === 81 || grade === 82 || grade === 91 || grade === 92) ? grade : 81;
  });

  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_VIEW_MODE);
    return (saved === 'learn' || saved === 'list') ? saved : 'learn';
  });

  const [currentFilter, setCurrentFilter] = useState<FilterType>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_FILTER);
    return (saved === 'all' || saved === 'mastered' || saved === 'not-mastered') ? saved : 'all';
  });

  const [learnedWords, setLearnedWords] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LEARNED_WORDS);
    return saved ? JSON.parse(saved) : {};
  });

  const [masteredWords, setMasteredWords] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MASTERED_WORDS);
    return saved ? JSON.parse(saved) : {};
  });

  const [selectionMode, setSelectionMode] = useState<SelectionMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SELECTION_MODE);
    const mode = (saved === 'grade-all' || saved === 'grade-unit' || saved === 'grade-count') ? saved : 'grade-all';
    console.log('初始化 selectionMode:', mode);
    return mode;
  });

  // 包装 setSelectionMode 以添加调试
  const wrappedSetSelectionMode = useCallback((mode: SelectionMode) => {
    console.log('setSelectionMode 被调用:', mode);
    setSelectionMode(mode);
  }, []);

  const [unitRange, setUnitRange] = useState<UnitRange>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.UNIT_RANGE);
    const defaultRange = { startUnit: 1, endUnit: 6 };
    const range = saved ? JSON.parse(saved) : defaultRange;
    console.log('初始化 unitRange:', range);
    return range;
  });

  // 包装 setUnitRange 以添加调试
  const wrappedSetUnitRange = useCallback((range: UnitRange) => {
    console.log('setUnitRange 被调用:', range);
    setUnitRange(range);
  }, []);

  const [countSelection, setCountSelection] = useState<CountSelection>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COUNT_SELECTION);
    return saved ? JSON.parse(saved) : { count: 20 };
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
    return saved ? JSON.parse(saved) : false;
  });

  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_GRADE, currentGrade.toString());
  }, [currentGrade]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_VIEW_MODE, currentViewMode);
  }, [currentViewMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_FILTER, currentFilter);
  }, [currentFilter]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LEARNED_WORDS, JSON.stringify(learnedWords));
  }, [learnedWords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MASTERED_WORDS, JSON.stringify(masteredWords));
  }, [masteredWords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTION_MODE, selectionMode);
  }, [selectionMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.UNIT_RANGE, JSON.stringify(unitRange));
  }, [unitRange]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COUNT_SELECTION, JSON.stringify(countSelection));
  }, [countSelection]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(darkMode));
  }, [darkMode]);

  // 标记单词为已学
  const markAsLearned = useCallback((wordId: string) => {
    setLearnedWords(prev => ({
      ...prev,
      [wordId]: true,
    }));
  }, []);

  // 标记单词为已掌握
  const markAsMastered = useCallback((wordId: string) => {
    setMasteredWords(prev => ({
      ...prev,
      [wordId]: true,
    }));
    // 已掌握的同时标记为已学
    setLearnedWords(prev => ({
      ...prev,
      [wordId]: true,
    }));
  }, []);

  // 取消掌握状态
  const unmarkAsMastered = useCallback((wordId: string) => {
    setMasteredWords(prev => {
      const updated = { ...prev };
      delete updated[wordId];
      return updated;
    });
  }, []);

  // 取消已学状态
  const unmarkAsLearned = useCallback((wordId: string) => {
    setLearnedWords(prev => {
      const updated = { ...prev };
      delete updated[wordId];
      return updated;
    });
    // 取消已学状态的同时取消掌握状态
    setMasteredWords(prev => {
      const updated = { ...prev };
      delete updated[wordId];
      return updated;
    });
  }, []);

  // 从云端数据更新本地状态
  const updateFromCloudData = useCallback((cloudData: ProgressSyncData) => {
    setLearnedWords(cloudData.learnedWords);
    setMasteredWords(cloudData.masteredWords);
    setCurrentGrade(cloudData.currentGrade as Grade);
    setCurrentViewMode(cloudData.currentViewMode);
    setCurrentFilter(cloudData.currentFilter);
  }, []);

  // 重置所有数据
  const resetAllData = useCallback(() => {
    setLearnedWords({});
    setMasteredWords({});
    setCurrentGrade(81);
    setCurrentViewMode('learn');
    setCurrentFilter('all');
    setSelectionMode('grade-all');
    setUnitRange({ startUnit: 1, endUnit: 6 });
    setCountSelection({ count: 20 });
  }, []);

  return {
    // 状态
    currentGrade,
    currentViewMode,
    currentFilter,
    learnedWords,
    masteredWords,
    selectionMode,
    unitRange,
    countSelection,
    darkMode,
    
    // 设置方法
    setCurrentGrade,
    setCurrentViewMode,
    setCurrentFilter,
    markAsLearned,
    markAsMastered,
    unmarkAsLearned,
    unmarkAsMastered,
    resetAllData,
    updateFromCloudData,
    setSelectionMode: wrappedSetSelectionMode,
    setUnitRange: wrappedSetUnitRange,
    setCountSelection,
    setDarkMode,
  };
}
