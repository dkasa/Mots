import { useState, useEffect, useCallback } from 'react';
import { Grade, FilterType, ViewMode, SelectionMode, UnitRange, CountSelection } from '../types/vocabulary';
import { ProgressSyncData } from '../types/auth';

type RecallMode = 'none' | 'hide-french' | 'hide-chinese';

// 基础存储键
const BASE_STORAGE_KEYS = {
  CURRENT_GRADE: 'french-app-current-grade',
  CURRENT_VIEW_MODE: 'french-app-current-view-mode',
  CURRENT_FILTER: 'french-app-current-filter',
  LEARNED_WORDS: 'french-app-learned-words',
  MASTERED_WORDS: 'french-app-mastered-words',
  SELECTION_MODE: 'french-app-selection-mode',
  UNIT_RANGE: 'french-app-unit-range',
  COUNT_SELECTION: 'french-app-count-selection',
  DARK_MODE: 'french-app-dark-mode',
  RECALL_MODE: 'french-app-recall-mode',
};

// 获取用户特定的存储键
const getUserStorageKey = (baseKey: string, userId: string): string => {
  return `${baseKey}-user-${userId}`;
};

// 辅助函数：从localStorage获取值
const getStorageValue = <T>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (error) {
    console.error(`Error parsing localStorage key "${key}":`, error);
    return defaultValue;
  }
};

// 辅助函数：设置localStorage值
const setStorageValue = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
};

export function useLocalStorage() {
  // 用户ID状态 - 改为从认证状态获取
  const [userId, setUserId] = useState<string | undefined>(() => {
    // 尝试从认证token获取用户ID
    const token = localStorage.getItem('mots-auth-token');
    const userStr = localStorage.getItem('mots-user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.id?.toString();
      } catch {
        // 如果解析失败，返回undefined
      }
    }
    return undefined;
  });
  
  // 将用户ID转换为字符串，用于存储键
  const userIdStr = userId?.toString() || 'anonymous';
  
  // 获取当前用户的存储键
  const storageKeys = {
    CURRENT_GRADE: getUserStorageKey(BASE_STORAGE_KEYS.CURRENT_GRADE, userIdStr || 'default'),
    CURRENT_VIEW_MODE: getUserStorageKey(BASE_STORAGE_KEYS.CURRENT_VIEW_MODE, userIdStr || 'default'),
    CURRENT_FILTER: getUserStorageKey(BASE_STORAGE_KEYS.CURRENT_FILTER, userIdStr || 'default'),
    LEARNED_WORDS: getUserStorageKey(BASE_STORAGE_KEYS.LEARNED_WORDS, userIdStr || 'default'),
    MASTERED_WORDS: getUserStorageKey(BASE_STORAGE_KEYS.MASTERED_WORDS, userIdStr || 'default'),
    SELECTION_MODE: getUserStorageKey(BASE_STORAGE_KEYS.SELECTION_MODE, userIdStr || 'default'),
    UNIT_RANGE: getUserStorageKey(BASE_STORAGE_KEYS.UNIT_RANGE, userIdStr || 'default'),
    COUNT_SELECTION: getUserStorageKey(BASE_STORAGE_KEYS.COUNT_SELECTION, userIdStr || 'default'),
    DARK_MODE: getUserStorageKey(BASE_STORAGE_KEYS.DARK_MODE, userIdStr || 'default'),
    RECALL_MODE: getUserStorageKey(BASE_STORAGE_KEYS.RECALL_MODE, userIdStr || 'default'),
  };

  const [currentGrade, setCurrentGrade] = useState<Grade>(() => {
    const saved = localStorage.getItem(storageKeys.CURRENT_GRADE);
    const grade = saved ? parseInt(saved) as Grade : 81;
    return (grade === 71 || grade === 72 || grade === 81 || grade === 82 || grade === 91 || grade === 92) ? grade : 81;
  });

  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(storageKeys.CURRENT_VIEW_MODE);
    return (saved === 'learn' || saved === 'list') ? saved : 'learn';
  });

  const [currentFilter, setCurrentFilter] = useState<FilterType>(() => {
    const saved = localStorage.getItem(storageKeys.CURRENT_FILTER);
    return (saved === 'all' || saved === 'mastered' || saved === 'not-mastered') ? saved : 'all';
  });

  const [learnedWords, setLearnedWords] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(storageKeys.LEARNED_WORDS);
    return saved ? JSON.parse(saved) : {};
  });

  const [masteredWords, setMasteredWords] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(storageKeys.MASTERED_WORDS);
    return saved ? JSON.parse(saved) : {};
  });

  const [selectionMode, setSelectionMode] = useState<SelectionMode>(() => {
    const saved = localStorage.getItem(storageKeys.SELECTION_MODE);
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
    const saved = localStorage.getItem(storageKeys.UNIT_RANGE);
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
    const saved = localStorage.getItem(storageKeys.COUNT_SELECTION);
    return saved ? JSON.parse(saved) : { count: 20 };
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(storageKeys.DARK_MODE);
    return saved ? JSON.parse(saved) : false;
  });

  const [recallMode, setRecallMode] = useState<RecallMode>(() => {
    const saved = localStorage.getItem(storageKeys.RECALL_MODE);
    return (saved === 'none' || saved === 'hide-french' || saved === 'hide-chinese') ? saved : 'none';
  });

  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem(storageKeys.CURRENT_GRADE, currentGrade.toString());
  }, [currentGrade, storageKeys.CURRENT_GRADE]);

  useEffect(() => {
    localStorage.setItem(storageKeys.CURRENT_VIEW_MODE, currentViewMode);
  }, [currentViewMode, storageKeys.CURRENT_VIEW_MODE]);

  useEffect(() => {
    localStorage.setItem(storageKeys.CURRENT_FILTER, currentFilter);
  }, [currentFilter, storageKeys.CURRENT_FILTER]);

  useEffect(() => {
    localStorage.setItem(storageKeys.LEARNED_WORDS, JSON.stringify(learnedWords));
  }, [learnedWords, storageKeys.LEARNED_WORDS]);

  useEffect(() => {
    localStorage.setItem(storageKeys.MASTERED_WORDS, JSON.stringify(masteredWords));
  }, [masteredWords, storageKeys.MASTERED_WORDS]);

  useEffect(() => {
    localStorage.setItem(storageKeys.SELECTION_MODE, selectionMode);
  }, [selectionMode, storageKeys.SELECTION_MODE]);

  useEffect(() => {
    localStorage.setItem(storageKeys.UNIT_RANGE, JSON.stringify(unitRange));
  }, [unitRange, storageKeys.UNIT_RANGE]);

  useEffect(() => {
    localStorage.setItem(storageKeys.COUNT_SELECTION, JSON.stringify(countSelection));
  }, [countSelection, storageKeys.COUNT_SELECTION]);

  useEffect(() => {
    localStorage.setItem(storageKeys.DARK_MODE, JSON.stringify(darkMode));
  }, [darkMode, storageKeys.DARK_MODE]);

  useEffect(() => {
    localStorage.setItem(storageKeys.RECALL_MODE, recallMode);
  }, [recallMode, storageKeys.RECALL_MODE]);

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

  // 重置当前单元范围的单词状态
  const resetCurrentUnitWords = useCallback(async (currentGrade: Grade, unitRange: UnitRange) => {
    try {
      // 动态加载当前年级的单词数据
      const response = await fetch(`/data/grade${currentGrade}_words.json`);
      if (!response.ok) {
        throw new Error(`Failed to load grade ${currentGrade} words`);
      }
      
      const allWords = await response.json();
      
      // 获取当前年级和单元范围的所有单词ID
      // 单词ID的格式是 `${grade}-${index}`，其中index是单词在数组中的位置
      const currentUnitWordIds = allWords
        .map((word: any, index: number) => ({ word, index }))
        .filter(({ word }) => word.unit >= unitRange.startUnit && 
          word.unit <= unitRange.endUnit)
        .map(({ index }) => `${currentGrade}-${index}`);
      
      // 重置这些单词的状态
      setLearnedWords(prev => {
        const updated = { ...prev };
        currentUnitWordIds.forEach(id => delete updated[id]);
        return updated;
      });
      
      setMasteredWords(prev => {
        const updated = { ...prev };
        currentUnitWordIds.forEach(id => delete updated[id]);
        return updated;
      });
      
      console.log(`🔄 重置了 ${currentUnitWordIds.length} 个单词的状态`);
      console.log('重置的单词ID示例:', currentUnitWordIds.slice(0, 5));
    } catch (error) {
      console.error('重置单词状态失败:', error);
    }
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
    recallMode,
    
    // 设置方法
    setCurrentGrade,
    setCurrentViewMode,
    setCurrentFilter,
    markAsLearned,
    markAsMastered,
    unmarkAsLearned,
    unmarkAsMastered,
    resetAllData,
    resetCurrentUnitWords,
    updateFromCloudData,
    setSelectionMode: wrappedSetSelectionMode,
    setUnitRange: wrappedSetUnitRange,
    setCountSelection,
    setDarkMode,
    setRecallMode,
  };
}