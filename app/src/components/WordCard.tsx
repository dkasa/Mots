import React, { useState, useEffect } from 'react';
import { WordWithStatus } from '../types/vocabulary';

type RecallMode = 'none' | 'hide-french' | 'hide-chinese';

interface WordCardProps {
  word: WordWithStatus;
  darkMode?: boolean;
  recallMode?: RecallMode;
}

export function WordCard({ word, darkMode = false, recallMode = 'none' }: WordCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  // 当回忆模式改变时重置显示状态
  useEffect(() => {
    setIsRevealed(false);
  }, [recallMode]);

  // 当单词改变时重置显示状态
  useEffect(() => {
    setIsRevealed(false);
  }, [word.id]);

  const handleCardClick = () => {
    if (recallMode !== 'none') {
      setIsRevealed(true);
    }
  };

  const shouldHideFrench = recallMode === 'hide-french' && !isRevealed;
  const shouldHideChinese = recallMode === 'hide-chinese' && !isRevealed;

  return (
    <div 
      className={`mx-4 my-4 p-4 rounded-lg transition-all duration-300 ${
        darkMode 
          ? 'bg-bg-dark-card shadow-dark-md hover:shadow-dark-lg' 
          : 'bg-bg-card shadow-md hover:shadow-lg'
      } transition-shadow duration-250 ${
        recallMode !== 'none' && !isRevealed ? 'cursor-pointer' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* 词性标签 */}
      <div className="mb-3">
        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full transition-colors duration-300 ${
          darkMode 
            ? 'bg-secondary-900 text-secondary-200' 
            : 'bg-secondary-100 text-secondary-900'
        }`}>
          {word.part_of_speech}
        </span>
      </div>
      
      {/* 法语单词 */}
      <div className="text-center mb-2">
        {shouldHideFrench ? (
          <div className={`h-12 flex items-center justify-center rounded-lg transition-colors duration-300 ${
            darkMode ? 'bg-neutral-dark-200' : 'bg-neutral-200'
          }`}>
            <span className={`text-sm font-medium transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
            }`}>
              点击显示答案
            </span>
          </div>
        ) : (
          <h2 className={`text-3xl font-bold leading-tight font-french transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
          }`}>
            {word.french}
          </h2>
        )}
      </div>
      
      {/* 音标 */}
      <div className="text-center mb-3">
        <p className={`text-sm font-phonetic italic transition-colors duration-300 ${
          darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
        }`}>
          {word.phonetic}
        </p>
      </div>
      
      {/* 中文释义 */}
      <div className="text-center">
        {shouldHideChinese ? (
          <div className={`h-6 flex items-center justify-center rounded-lg transition-colors duration-300 ${
            darkMode ? 'bg-neutral-dark-200' : 'bg-neutral-200'
          }`}>
            <span className={`text-sm font-medium transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
            }`}>
              点击显示答案
            </span>
          </div>
        ) : (
          <p className={`text-base font-chinese transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
          }`}>
            {word.chinese}
          </p>
        )}
      </div>
      
      {/* 学习状态指示器（仅在学习模式下显示） */}
      {word.isMastered && isRevealed && (
        <div className="mt-4 flex justify-center">
          <div className={`flex items-center gap-2 px-2 py-1 rounded-full transition-colors duration-300 ${
            darkMode ? 'bg-success-900' : 'bg-success-50'
          }`}>
            <svg className={`w-4 h-4 transition-colors duration-300 ${
              darkMode ? 'text-success-400' : 'text-success-600'
            }`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className={`text-xs font-medium transition-colors duration-300 ${
              darkMode ? 'text-success-300' : 'text-success-700'
            }`}>已掌握</span>
          </div>
        </div>
      )}
    </div>
  );
}
