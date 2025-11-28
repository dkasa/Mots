import React, { useState, useCallback, useMemo } from 'react';
import { Grade, ViewMode, FilterType } from './types/vocabulary';
import { ProgressSyncData } from './types/auth';
import { useAuth } from './hooks/useAuth';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useVocabularyData } from './hooks/useVocabularyData';
import { useAllVocabularyData } from './hooks/useAllVocabularyData';
import { useSyncProgress } from './hooks/useSyncProgress';
import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { GradeSelector } from './components/GradeSelector';
import { SelectionDrawer } from './components/SelectionDrawer';
import { ProgressIndicator } from './components/ProgressIndicator';
import { LearnMode } from './components/LearnMode';
import { ListMode } from './components/ListMode';
import { WordSearch } from './components/WordSearch';
import { BottomNavigation } from './components/BottomNavigation';

import { WordWithStatus } from './types/vocabulary';

function App() {
  // 认证状态
  const { isAuthenticated } = useAuth();

  // 本地存储状态
  const {
    currentGrade,
    currentViewMode,
    currentFilter,
    learnedWords,
    masteredWords,
    selectionMode,
    unitRange,
    countSelection,
    darkMode,
    setCurrentGrade,
    setCurrentViewMode,
    setCurrentFilter,
    markAsLearned,
    markAsMastered,
    unmarkAsLearned,
    unmarkAsMastered,
    updateFromCloudData,
    setSelectionMode,
    setUnitRange,
    setCountSelection,
    setDarkMode,
  } = useLocalStorage();

  // 词汇数据
  const {
    words,
    loading,
    error,
    getProgressData,
    getNextWord,
    getMasteredWords,
    getUnmasteredWords,
    getFilteredWords,
    updateWordStatus,
    reloadWords,
  } = useVocabularyData(currentGrade, learnedWords, masteredWords, selectionMode, unitRange, countSelection);

  // 所有年级的词汇数据（用于搜索）- 使用记忆化优化
  const vocabularyData = useMemo(() => ({ learnedWords, masteredWords }), [learnedWords, masteredWords]);
  const {
    allWords,
    loading: allWordsLoading,
    error: allWordsError,
  } = useAllVocabularyData(vocabularyData.learnedWords, vocabularyData.masteredWords);

  // 进度数据
  const progress = getProgressData();
  const filteredWords = getFilteredWords(currentFilter);

  // 处理年级切换
  const handleGradeChange = useCallback((grade: Grade) => {
    setCurrentGrade(grade);
    // 保持当前视图，不再在切换年级时强制跳到学习模式
  }, [setCurrentGrade]);

  // 处理视图模式切换
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setCurrentViewMode(mode);
    // 切换到列表模式时重置筛选器
    if (mode === 'list') {
      setCurrentFilter('all');
    }
  }, [setCurrentViewMode, setCurrentFilter]);

  // 处理筛选器切换
  const handleFilterChange = useCallback((filter: FilterType) => {
    setCurrentFilter(filter);
  }, [setCurrentFilter]);

  // 处理单词标记为已掌握
  const handleMarkAsMastered = useCallback((wordId: string) => {
    markAsMastered(wordId);
    updateWordStatus(wordId, true, true);
  }, [markAsMastered, updateWordStatus]);

  // 处理单词标记为未掌握
  const handleMarkAsUnmastered = useCallback((wordId: string) => {
    unmarkAsLearned(wordId);
    updateWordStatus(wordId, false, false);
  }, [unmarkAsLearned, updateWordStatus]);

  // 处理列表中开关切换（父组件负责刷新分组和持久化）
  const handleToggle = useCallback((word: WordWithStatus, newIsMastered: boolean) => {
    if (newIsMastered) {
      markAsMastered(word.id);
      updateWordStatus(word.id, true, true);
    } else {
      // 这里按你的现有逻辑：标记为未掌握时也可以同时清除已学/已掌握标记
      unmarkAsMastered?.(word.id);
      unmarkAsLearned?.(word.id);
      updateWordStatus(word.id, false, false);
    }
  }, [markAsMastered, unmarkAsLearned, unmarkAsMastered, updateWordStatus]);

  // 处理单词点击（从列表进入学习）
  const handleWordClick = useCallback((word: WordWithStatus) => {
    // 切换到学习模式
    setCurrentViewMode('learn');
    // 切换到对应年级
    if (word.grade !== currentGrade) {
      setCurrentGrade(word.grade);
    }
  }, [currentGrade, setCurrentViewMode, setCurrentGrade]);

  // 处理刷新
  const handleRefresh = useCallback(async () => {
    await reloadWords();
  }, [reloadWords]);

  // 云端同步
  const { syncStatus, syncToServer } = useSyncProgress({
    learnedWords,
    masteredWords,
    currentGrade,
    currentViewMode,
    currentFilter,
    isAuthenticated,
    onSyncComplete: (data: ProgressSyncData) => {
      // 只在学习模式外才更新数据，避免打断学习流程
      if (currentViewMode !== 'learn') {
        updateFromCloudData(data);
      }
    },
    onSyncError: (error: string) => {
      console.error('Sync error:', error);
    },
  });

  // 应用暗色模式
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 手动同步
  const handleManualSync = useCallback(() => {
    if (isAuthenticated) {
      syncToServer();
    }
  }, [isAuthenticated, syncToServer]);

  return (
    <div className={`min-h-screen font-chinese transition-colors duration-300 ${
      darkMode ? 'bg-bg-dark-primary text-neutral-dark-800' : 'bg-bg-primary text-neutral-800'
    }`}>
      {/* 顶部导航 */}
      <TopBar 
        currentViewMode={currentViewMode}
        onViewModeChange={handleViewModeChange}
        syncStatus={syncStatus}
        onManualSync={handleManualSync}
        darkMode={darkMode}
        onDarkModeToggle={() => setDarkMode(!darkMode)}
      />
      
      {/* 年级选择器 */}
      <GradeSelector 
        currentGrade={currentGrade}
        onGradeChange={handleGradeChange}
        darkMode={darkMode}
      />      

      {/* 范围选择器抽屉 */}
      <SelectionDrawer
        currentMode={selectionMode}
        unitRange={unitRange}
        countSelection={countSelection}
        onModeChange={setSelectionMode}
        onUnitRangeChange={setUnitRange}
        onCountSelectionChange={setCountSelection}
        darkMode={darkMode}
      />
      
      {/* 进度指示器 */}
      <ProgressIndicator progress={progress} darkMode={darkMode} />
      
      {/* 主内容区域 */}
      <main className={`${currentViewMode === 'learn' ? 'pt-[calc(30px+40px+16px)]' : 'pt-0'} pb-20`}>
        {currentViewMode === 'learn' ? (
          <LearnMode
            words={words}
            loading={loading}
            error={error}
            progress={progress}
            onMarkAsMastered={handleMarkAsMastered}
            onMarkAsUnmastered={handleMarkAsUnmastered}
            onRetry={reloadWords}
            darkMode={darkMode}
          />
        ) : currentViewMode === 'search' ? (
          <WordSearch allWords={allWords} darkMode={darkMode} />
        ) : (
          <ListMode
            words={words}
            filteredWords={filteredWords}
            loading={loading}
            error={error}
            currentFilter={currentFilter}
            onFilterChange={handleFilterChange}
            onWordClick={handleWordClick}
            onRetry={reloadWords}
            onToggle={handleToggle}
            darkMode={darkMode}
          />
        )}
      </main>
      
      {/* 底部导航 */}
      <BottomNavigation
        currentViewMode={currentViewMode}
        onViewModeChange={handleViewModeChange}
        darkMode={darkMode}
      />
    </div>
  );
}

export default App
