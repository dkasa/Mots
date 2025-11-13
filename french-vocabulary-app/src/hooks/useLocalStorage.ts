import { useState, useEffect, useCallback } from 'react';
import { Grade, FilterType, ViewMode } from '../types/vocabulary';

const STORAGE_KEYS = {
  CURRENT_GRADE: 'french-app-current-grade',
  CURRENT_VIEW_MODE: 'french-app-current-view-mode',
  CURRENT_FILTER: 'french-app-current-filter',
  LEARNED_WORDS: 'french-app-learned-words',
  MASTERED_WORDS: 'french-app-mastered-words',
};

export function useLocalStorage() {
  const [currentGrade, setCurrentGrade] = useState<Grade>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_GRADE);
    const grade = saved ? parseInt(saved) as Grade : 7;
    return (grade === 7 || grade === 8 || grade === 9) ? grade : 7;
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

  // 重置所有数据
  const resetAllData = useCallback(() => {
    setLearnedWords({});
    setMasteredWords({});
    setCurrentGrade(7);
    setCurrentViewMode('learn');
    setCurrentFilter('all');
  }, []);

  return {
    // 状态
    currentGrade,
    currentViewMode,
    currentFilter,
    learnedWords,
    masteredWords,
    
    // 设置方法
    setCurrentGrade,
    setCurrentViewMode,
    setCurrentFilter,
    markAsLearned,
    markAsMastered,
    unmarkAsLearned,
    unmarkAsMastered,
    resetAllData,
  };
}
