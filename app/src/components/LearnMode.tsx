import React, { useState, useEffect } from 'react';
import { WordWithStatus } from '../types/vocabulary';
import { WordCard } from './WordCard';
import { ActionButtons } from './ActionButtons';
import { LoadingSkeleton, ErrorState, EmptyState } from './LoadingStates';

type RecallMode = 'none' | 'hide-french' | 'hide-chinese';

interface LearnModeProps {
  words: WordWithStatus[];
  loading: boolean;
  error: string | null;
  progress: {
    total: number;
    learned: number;
    mastered: number;
    percentage: number;
  };
  onMarkAsMastered: (wordId: string) => void;
  onMarkAsUnmastered: (wordId: string) => void;
  onRetry: () => void;
  onSyncAfterLearning?: () => void; // 学习完成后的同步回调
  darkMode?: boolean;
  recallMode?: RecallMode;
}

export function LearnMode({ words, loading, error, progress, onMarkAsMastered, onMarkAsUnmastered, onRetry, onSyncAfterLearning, darkMode = false, recallMode = 'none' }: LearnModeProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // 获取当前单词
  const currentWord = words.length > 0 ? words[currentWordIndex] : null;
  
  // 当所有单词都已掌握时显示空状态
  const allMastered = progress.total > 0 && progress.mastered === progress.total;

  // 自动选择下一个要学习的单词
  useEffect(() => {
    if (words.length > 0 && !allMastered) {
      // 优先选择未掌握的单词
      const unmasteredIndices = words
        .map((word, index) => ({ word, index }))
        .filter(({ word }) => !word.isMastered)
        .map(({ index }) => index);
      
      if (unmasteredIndices.length > 0) {
        // 随机选择一个未掌握的单词
        const randomIndex = Math.floor(Math.random() * unmasteredIndices.length);
        setCurrentWordIndex(unmasteredIndices[randomIndex]);
      }
    }
  }, [words, allMastered]);

  const handleMarkAsMastered = () => {
    if (!currentWord || isAnimating) return;
    
    setIsAnimating(true);
    onMarkAsMastered(currentWord.id);
    
    // 触发学习完成后的同步
    onSyncAfterLearning?.();
    
    // 动画延迟后重新选择下一个单词
    setTimeout(() => {
      setIsAnimating(false);
      // 自动选择下一个单词的逻辑会在 useEffect 中处理
    }, 400);
  };

  const handleMarkAsUnmastered = () => {
    if (!currentWord || isAnimating) return;
    
    setIsAnimating(true);
    onMarkAsUnmastered(currentWord.id);
    
    // 触发学习完成后的同步
    onSyncAfterLearning?.();
    
    setTimeout(() => {
      setIsAnimating(false);
    }, 400);
  };

  // 加载状态
  if (loading) {
    return <LoadingSkeleton />;
  }

  // 错误状态
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  // 空状态（所有单词已掌握）
  if (allMastered) {
    return (
      <div className="mx-5 my-8">
        <div className="text-center py-12">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center transition-colors duration-300 ${
            darkMode ? 'bg-success-900' : 'bg-success-100'
          }`}>
            <svg className={`w-10 h-10 transition-colors duration-300 ${
              darkMode ? 'text-success-400' : 'text-success-600'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className={`text-xl font-bold mb-2 transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
          }`}>恭喜！</h3>
          <p className={`mb-6 transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
          }`}>本年级单词已全部掌握！</p>
          <div className="flex gap-3 justify-center">
            <button className="px-6 py-3 bg-secondary-500 hover:bg-secondary-700 text-white font-semibold rounded-md transition-colors duration-200">
              切换到下一年级
            </button>
            <button className={`px-6 py-3 font-semibold rounded-md transition-colors duration-200 ${
              darkMode 
                ? 'bg-neutral-dark-300 hover:bg-neutral-dark-400 text-neutral-dark-800' 
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            }`}>
              重新学习
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 正常学习状态
  if (!currentWord) {
    return <EmptyState message="暂无单词可学习" />;
  }

  return (
    <>
      <WordCard word={currentWord} darkMode={darkMode} recallMode={recallMode} />
      <ActionButtons
        onMarkAsMastered={handleMarkAsMastered}
        onMarkAsUnmastered={handleMarkAsUnmastered}
        darkMode={darkMode}
        disabled={isAnimating}
      />
    </>
  );
}