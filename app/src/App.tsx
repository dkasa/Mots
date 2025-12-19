import React, { useState, useCallback, useMemo } from 'react';
import { Grade, ViewMode, FilterType } from './types/vocabulary';
import { ProgressSyncData } from './types/auth';
import { useAuth } from './hooks/useAuth';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useVocabularyData } from './hooks/useVocabularyData';
import { useAllVocabularyData } from './hooks/useAllVocabularyData';
import { useSyncProgress } from './hooks/useSyncProgress';
import { downloadFromCloud } from './hooks/useCloudStorage';
import { useEffect } from 'react';
import { apiService } from './services/api';
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
  const { isAuthenticated, user, login, logout } = useAuth();

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
    lessonRange,
    courseSelection,
    darkMode,
    recallMode,
    setCurrentGrade,
    setCurrentViewMode,
    setCurrentFilter,
    markAsLearned,
    markAsMastered,
    unmarkAsLearned,
    unmarkAsMastered,
    resetCurrentUnitWords,
    resetCurrentLessonWords,
    resetCurrentCourseWords,
    resetAllData,
    updateFromCloudData,
    setSelectionMode,
    setUnitRange,
    setCountSelection,
    setLessonRange,
    setCourseSelection,
    setDarkMode,
    setRecallMode,
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
  } = useVocabularyData(currentGrade, learnedWords, masteredWords, selectionMode, courseSelection, countSelection);

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

  // 云端同步 - 先声明同步相关的hook
  const { syncStatus, syncError, syncToServer, smartSync, manualSync, forceSync, syncAfterLearning, resetSyncState } = useSyncProgress({
    learnedWords,
    masteredWords,
    currentGrade,
    currentViewMode,
    currentFilter,
    isAuthenticated,
    userId: user?.id,
    updateFromCloudData: updateFromCloudData, // 传递React状态更新回调
    onSyncComplete: (data: ProgressSyncData) => {
      console.log('🔄 同步完成回调触发');
      console.log('📊 服务器返回掌握单词数:', Object.keys(data.masteredWords || {}).length);
      console.log('📊 服务器返回学习单词数:', Object.keys(data.learnedWords || {}).length);
      
      // 验证更新后的本地数据
      console.log('✅ 同步完成回调结束');
      console.log('🔍 当前本地掌握单词数:', Object.keys(masteredWords).length);
      console.log('🔍 当前本地学习单词数:', Object.keys(learnedWords).length);
    },
    onSyncError: (error: string) => {
      console.error('同步错误:', error);
    },
  });

  // 处理年级切换
  const handleGradeChange = useCallback((grade: Grade) => {
    setCurrentGrade(grade);
    // 保持当前视图，不再在切换年级时强制跳到学习模式
  }, [setCurrentGrade]);

  // 处理视图模式切换 - 切换页面时触发同步
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    console.log(`🔄 切换页面从 ${currentViewMode} 到 ${mode}`);
    const previousMode = currentViewMode;
    
    // 先切换页面
    setCurrentViewMode(mode);
    
    // 切换到列表模式时重置筛选器
    if (mode === 'list') {
      setCurrentFilter('all');
    }
    
    // 如果是从学习、列表、搜索页面切换出去，或者是切换到这些页面时，触发同步
    const syncPages = ['learn', 'list', 'search'];
    if (syncPages.includes(previousMode) || syncPages.includes(mode)) {
      console.log('🔄 页面切换触发同步', { 
        from: previousMode, 
        to: mode, 
        isAuthenticated, 
        isOnline: syncStatus.isOnline 
      });
      
      // 立即触发同步，不设置频率限制
      setTimeout(() => {
        if (isAuthenticated && syncStatus.isOnline) {
          console.log('🔄 执行页面切换同步');
          smartSync();
        } else {
          console.log('🔄 跳过同步，原因:', { isAuthenticated, isOnline: syncStatus.isOnline });
        }
      }, 500);
    }
  }, [currentViewMode, setCurrentViewMode, setCurrentFilter, isAuthenticated, syncStatus.isOnline, smartSync]);

  // 处理筛选器切换
  const handleFilterChange = useCallback((filter: FilterType) => {
    setCurrentFilter(filter);
  }, [setCurrentFilter]);

  // 处理单词标记为已掌握
  const handleMarkAsMastered = useCallback((wordId: string) => {
    console.log('🎯 标记单词为已掌握:', wordId);
    markAsMastered(wordId);
    updateWordStatus(wordId, true, true);
    // 移除自动同步，只在切换页面或手动同步时触发
    console.log('🚫 已移除自动同步，等待页面切换或手动同步');
  }, [markAsMastered, updateWordStatus]);

  // 处理单词标记为未掌握
  const handleMarkAsUnmastered = useCallback((wordId: string) => {
    console.log('🎯 标记单词为未掌握:', wordId);
    unmarkAsLearned(wordId);
    updateWordStatus(wordId, false, false);
    // 移除自动同步，只在切换页面或手动同步时触发
    console.log('🚫 已移除自动同步，等待页面切换或手动同步');
  }, [unmarkAsLearned, updateWordStatus]);

  // 处理列表中开关切换 - 只负责持久化，UI 更新完全由 WordListItem 本地处理
  const handleToggle = useCallback(async (word: WordWithStatus, newIsMastered: boolean) => {
    console.log('🎯 列表中切换开关:', { wordId: word.id, newIsMastered });
    // 只更新 localStorage，不更新 UI（UI 已经在 WordListItem 中乐观更新了）
    if (newIsMastered) {
      markAsMastered(word.id);
    } else {
      unmarkAsMastered?.(word.id);
      unmarkAsLearned?.(word.id);
    }
    // 移除自动同步，只在切换页面或手动同步时触发
    console.log('🚫 已移除自动同步，等待页面切换或手动同步');
  }, [markAsMastered, unmarkAsLearned, unmarkAsMastered]);

  // 处理单词点击（从列表进入学习）
  const handleWordClick = useCallback((word: WordWithStatus) => {
    // 切换到学习模式
    setCurrentViewMode('learn');
    // 切换到对应年级
    if (word.grade !== currentGrade) {
      setCurrentGrade(word.grade);
    }
  }, [currentGrade, setCurrentViewMode, setCurrentGrade]);

  // 处理重新学习（重置当前选择范围的单词状态）
  const handleRelearn = useCallback(() => {
    console.log('🔄 重新学习：重置当前选择范围的单词状态', { selectionMode });
    
    if (selectionMode === 'grade-unit') {
      // 重置单元范围的单词状态
      resetCurrentUnitWords(currentGrade, unitRange);
    } else if (selectionMode === 'grade-lesson') {
      // 重置课次范围的单词状态
      resetCurrentLessonWords(currentGrade, lessonRange);
    } else if (selectionMode === 'grade-course' && courseSelection) {
      // 重置课程范围的单词状态
      resetCurrentCourseWords(currentGrade, courseSelection);
    } else {
      // 对于其他模式（全部、数量），重置整个年级的单词状态
      resetAllData();
    }
    
    // 重新加载单词数据
    reloadWords();
  }, [resetCurrentUnitWords, resetCurrentLessonWords, resetCurrentCourseWords, resetAllData, currentGrade, unitRange, lessonRange, courseSelection, selectionMode, reloadWords]);

  // 退出登录前同步到服务器 - 参考页面切换时的同步方式，但要等待同步完成
  const syncBeforeLogout = useCallback(async () => {
    console.log('🔄 退出登录前准备同步', { isAuthenticated, isOnline: syncStatus.isOnline });
    
    if (isAuthenticated && syncStatus.isOnline) {
      // 退出登录时需要等待同步完成，不使用setTimeout
      console.log('🔄 执行退出前同步（同步完成前不退出）');
      try {
        // 使用forceSync确保强制上传数据到服务器，并等待完成
        await smartSync(true);
        console.log('✅ 退出前同步完成');
      } catch (error) {
        console.error('❌ 退出前同步失败:', error);
        // 即使同步失败也继续退出，但记录错误
      }
    } else {
      console.log('🔄 跳过退出前同步，原因:', { isAuthenticated, isOnline: syncStatus.isOnline });
    }
  }, [isAuthenticated, syncStatus.isOnline, smartSync]);

  // 手动同步 - 参考页面切换时的同步方式
  const handleManualSync = useCallback(() => {
    console.log('🔄 手动同步按钮被点击', { isAuthenticated, isOnline: syncStatus.isOnline });
    
    if (isAuthenticated && syncStatus.isOnline) {
      // 立即触发同步，不设置频率限制，参考页面切换的实现
      setTimeout(() => {
        console.log('🔄 执行手动同步');
        smartSync();
      }, 500);
    } else {
      console.log('🔄 跳过同步，原因:', { isAuthenticated, isOnline: syncStatus.isOnline });
    }
  }, [isAuthenticated, syncStatus.isOnline, smartSync]);

  // 强制同步（用于调试）
  const handleForceSync = useCallback(() => {
    if (isAuthenticated) {
      forceSync();
    }
  }, [isAuthenticated, forceSync]);

  // 将同步函数暴露到全局，供退出登录时使用（生产环境也需要）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 使用命名空间避免全局污染
      const appNamespace = (window as any).__MOTS_APP__ = (window as any).__MOTS_APP__ || {};
      
      appNamespace.syncBeforeLogout = syncBeforeLogout;
      appNamespace.handleForceSync = async () => {
        if (isAuthenticated) {
          console.log('🔥 强制同步触发（全局函数）');
          handleForceSync();
        }
      };
      appNamespace.smartSync = smartSync;
      
      console.log('📦 全局同步函数已设置到 __MOTS_APP__ 命名空间');
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        const appNamespace = (window as any).__MOTS_APP__;
        if (appNamespace) {
          delete appNamespace.syncBeforeLogout;
          delete appNamespace.handleForceSync;
          delete appNamespace.smartSync;
          console.log('🗑️ 全局同步函数已清理');
        }
      }
    };
  }, [syncBeforeLogout, handleForceSync, isAuthenticated, smartSync]);

  // 重试同步的辅助函数 - 移除过于频繁的重试
  const retrySync = useCallback(async (retryCount = 0, maxRetries = 1): Promise<boolean> => {
    try {
      console.log(`开始执行登录后同步${retryCount > 0 ? `重试${retryCount}` : ''}...`);
      await smartSync(true);
      console.log(`登录后同步${retryCount > 0 ? `重试${retryCount}` : ''}成功`);
      return true;
    } catch (error) {
      console.error(`登录后同步${retryCount > 0 ? `重试${retryCount}` : ''}失败:`, error);
      
      if (retryCount < maxRetries) {
        console.log(`${retryCount === 0 ? 10 : 15}秒后重试同步...`);
        await new Promise(resolve => setTimeout(resolve, retryCount === 0 ? 10000 : 15000));
        return retrySync(retryCount + 1, maxRetries);
      } else {
        // 最后尝试直接调用下载函数
        console.log('最后尝试直接下载...');
        try {
          const cloudData = await downloadFromCloud();
          if (cloudData) {
            updateFromCloudData(cloudData);
            console.log('直接下载成功，数据已更新');
            return true;
          }
          return false;
        } catch (downloadError) {
          console.error('直接下载失败:', downloadError);
          return false;
        }
      }
    }
  }, [smartSync, updateFromCloudData]);

  // 监听登录事件，强制从服务端拉取进度 - 只在首次登录时同步一次
  useEffect(() => {
    if (isAuthenticated && user && user.id) {
      // 检查是否已经为当前用户执行过登录同步
      const loginSyncKey = `mots-login-sync-${user.id}`;
      const hasSyncedBefore = sessionStorage.getItem(loginSyncKey);
      
      if (hasSyncedBefore) {
        console.log('当前用户已执行过登录同步，跳过重复同步');
        return;
      }
      
      console.log('用户已登录，准备执行首次同步...', { 
        isAuthenticated, 
        userId: user.id,
        hasToken: !!localStorage.getItem('mots-auth-token')
      });
      
      // 立即尝试同步，不延迟
      const executeSync = async () => {
        // 确保token已设置
        const token = localStorage.getItem('mots-auth-token');
        if (!token) {
          console.warn('登录同步失败：token未找到');
          return;
        }
        
        console.log('开始执行登录同步...');
        try {
          const success = await retrySync();
          console.log('登录同步结果:', success);
          
          // 标记已为当前用户执行过同步
          sessionStorage.setItem(loginSyncKey, 'true');
          
          // 如果同步失败，尝试强制下载
          if (!success) {
            console.log('登录同步失败，尝试强制下载...');
            try {
              const cloudData = await downloadFromCloud();
              if (cloudData) {
                updateFromCloudData(cloudData);
                console.log('强制下载成功，数据已更新');
                // 即使强制下载成功也标记为已同步
                sessionStorage.setItem(loginSyncKey, 'true');
              }
            } catch (downloadError) {
              console.error('强制下载也失败:', downloadError);
            }
          }
        } catch (error) {
          console.error('登录同步异常:', error);
          
          // 异常情况下也尝试直接下载
          try {
            const cloudData = await downloadFromCloud();
            if (cloudData) {
              updateFromCloudData(cloudData);
              console.log('异常恢复下载成功，数据已更新');
              // 即使异常恢复成功也标记为已同步
              sessionStorage.setItem(loginSyncKey, 'true');
            }
          } catch (downloadError) {
            console.error('异常恢复下载失败:', downloadError);
          }
        }
      };
      
      executeSync();
    } else if (!isAuthenticated) {
      // 退出登录时清除所有用户的登录同步标记
      const keys = Object.keys(sessionStorage)
        .filter(key => key.startsWith('mots-login-sync-'));
      keys.forEach(key => sessionStorage.removeItem(key));
    }
  }, [isAuthenticated, user, retrySync, updateFromCloudData]);

  // 应用暗色模式
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className={`min-h-screen font-chinese transition-colors duration-300 ${
      darkMode ? 'bg-bg-dark-primary text-neutral-dark-800' : 'bg-bg-primary text-neutral-800'
    }`}>
      {/* 顶部导航 */}
      <TopBar 
        currentViewMode={currentViewMode}
        onViewModeChange={handleViewModeChange}
        syncStatus={syncStatus}
        syncError={syncError}
        onManualSync={handleManualSync}
        darkMode={darkMode}
        onDarkModeToggle={() => setDarkMode(!darkMode)}
        recallMode={recallMode}
        onRecallModeChange={setRecallMode}
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
        courseSelection={courseSelection}
        countSelection={countSelection}
        onModeChange={setSelectionMode}
        onCourseSelectionChange={setCourseSelection}
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
            onRelearn={handleRelearn}
            // onSyncAfterLearning={syncAfterLearning} - 已移除自动同步
            darkMode={darkMode}
            recallMode={recallMode}
          />
        ) : currentViewMode === 'search' ? (
          <WordSearch 
            allWords={allWords} 
            darkMode={darkMode} 
            onSync={handleManualSync}
            onToggle={handleToggle}
          />
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
            recallMode={recallMode}
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