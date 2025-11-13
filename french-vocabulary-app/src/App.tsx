import React, { useState, useCallback } from 'react';
import { Grade, ViewMode, FilterType } from './types/vocabulary';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useVocabularyData } from './hooks/useVocabularyData';
import { TopBar } from './components/TopBar';
import { GradeSelector } from './components/GradeSelector';
import { ProgressIndicator } from './components/ProgressIndicator';
import { LearnMode } from './components/LearnMode';
import { ListMode } from './components/ListMode';
import { BottomNavigation } from './components/BottomNavigation';
import { PullToRefresh } from './components/PullToRefresh';
import { WordWithStatus } from './types/vocabulary';

function App() {
  // 本地存储状态
  const {
    currentGrade,
    currentViewMode,
    currentFilter,
    learnedWords,
    masteredWords,
    setCurrentGrade,
    setCurrentViewMode,
    setCurrentFilter,
    markAsLearned,
    markAsMastered,
    unmarkAsLearned,
    unmarkAsMastered,
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
  } = useVocabularyData(currentGrade, learnedWords, masteredWords);

  // 进度数据
  const progress = getProgressData();
  const filteredWords = getFilteredWords(currentFilter);

  // 处理年级切换
  const handleGradeChange = useCallback((grade: Grade) => {
    setCurrentGrade(grade);
    // 年级切换时重置到学习模式
    setCurrentViewMode('learn');
  }, [setCurrentGrade, setCurrentViewMode]);

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

  // 下拉刷新处理（仅在列表模式启用）
  const handlePullToRefresh = useCallback(async () => {
    if (currentViewMode === 'list') {
      await handleRefresh();
    }
  }, [currentViewMode, handleRefresh]);

  return (
    <div className="min-h-screen bg-bg-primary font-chinese">
      {/* 顶部导航 */}
      <TopBar 
        currentViewMode={currentViewMode}
        onViewModeChange={handleViewModeChange}
      />
      
      {/* 年级选择器 */}
      <GradeSelector 
        currentGrade={currentGrade}
        onGradeChange={handleGradeChange}
      />
      
      {/* 进度指示器 */}
      <ProgressIndicator progress={progress} />
      
      {/* 主内容区域 */}
      <main className="pt-56 pb-20">
        {currentViewMode === 'learn' ? (
          <LearnMode
            words={words}
            loading={loading}
            error={error}
            progress={progress}
            onMarkAsMastered={handleMarkAsMastered}
            onMarkAsUnmastered={handleMarkAsUnmastered}
            onRetry={reloadWords}
          />
        ) : (
          <PullToRefresh onRefresh={handlePullToRefresh}>
            <ListMode
              words={words}
              filteredWords={filteredWords}
              loading={loading}
              error={error}
              currentFilter={currentFilter}
              onFilterChange={handleFilterChange}
              onWordClick={handleWordClick}
              onRetry={reloadWords}
            />
          </PullToRefresh>
        )}
      </main>
      
      {/* 底部导航 */}
      <BottomNavigation
        currentViewMode={currentViewMode}
        onViewModeChange={handleViewModeChange}
      />
    </div>
  );
}

export default App
