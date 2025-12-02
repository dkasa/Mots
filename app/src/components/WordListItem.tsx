import React, { useState, useEffect } from 'react';
import { WordWithStatus } from '../types/vocabulary';

type RecallMode = 'none' | 'hide-french' | 'hide-chinese';

interface WordListItemProps {
  word: WordWithStatus;
  /**
   * onToggle(word, newIsMastered)
   * newIsMastered: true = 掌握, false = 未掌握
   */
  onToggle?: (word: WordWithStatus, newIsMastered: boolean) => void;
  darkMode?: boolean;
  recallMode?: RecallMode;
}

export const WordListItem = React.memo(function WordListItem({ word, onToggle, darkMode = false, recallMode = 'none' }: WordListItemProps) {
  const [isNotMastered, setIsNotMastered] = useState<boolean>(!word.isMastered);
  const [saving, setSaving] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    setIsNotMastered(!word.isMastered);
  }, [word.isMastered]);

  // 完全本地化的状态更新，只通知父组件持久化
  const handleToggle = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (saving) return;
    
    const newIsNotMastered = !isNotMastered;
    const newIsMastered = !newIsNotMastered;
    
    // 立即更新本地状态
    setIsNotMastered(newIsNotMastered);
    
    // 异步通知父组件持久化，但不等待结果
    setSaving(true);
    try {
      if (onToggle) {
        // 不等待父组件完成，避免阻塞UI
        Promise.resolve(onToggle(word, newIsMastered)).catch(err => {
          console.error('Failed to sync toggle:', err);
          // 如果同步失败，回滚本地状态
          setIsNotMastered(!newIsNotMastered);
        });
      }
    } finally {
      // 短暂延迟后重置saving状态
      setTimeout(() => setSaving(false), 300);
    }
  };

  const handleToggleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    if (recallMode !== 'none' && !isRevealed) {
      e.stopPropagation();
      setIsRevealed(true);
    }
  };

  const shouldHideFrench = recallMode === 'hide-french' && !isRevealed;
  const shouldHideChinese = recallMode === 'hide-chinese' && !isRevealed;

  return (
    <div
      role="button"
      tabIndex={0}
      className={`
        w-full px-5 py-4 transition-colors duration-150 text-left
        ${darkMode 
          ? 'bg-dark-card hover:bg-dark-elevated border-b-dark-200 active:bg-dark-100' 
          : 'bg-bg-card hover:bg-neutral-50 border-b border-neutral-200 active:bg-neutral-100'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1" onClick={handleContentClick}>
          {/* 法语单词和词性 */}
          <div className="flex items-center gap-3 mb-1">
            {shouldHideFrench ? (
              <div className={`h-6 w-24 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                darkMode ? 'bg-neutral-dark-200' : 'bg-neutral-200'
              }`}>
                <span className={`text-xs font-medium transition-colors duration-300 ${
                  darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
                }`}>
                  点击显示
                </span>
              </div>
            ) : (
              <h3 className={`text-lg font-semibold leading-tight font-french ${
                !isNotMastered 
                  ? darkMode ? 'text-dark-400' : 'text-neutral-400'
                  : darkMode ? 'text-dark-100' : 'text-neutral-800'
              }`}>
                {word.french}
              </h3>
            )}
            <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
              darkMode ? 'bg-dark-200 text-dark-300' : 'bg-neutral-100 text-neutral-600'
            }`}>
              {word.part_of_speech}
            </span>
          </div>

          {/* 音标和中文释义 */}
          <div className="space-y-1">
            <p className={`text-xs font-phonetic italic ${
              !isNotMastered 
                ? darkMode ? 'text-dark-400' : 'text-neutral-400'
                : darkMode ? 'text-dark-300' : 'text-neutral-600'
            }`}>
              {word.phonetic}
            </p>
            {shouldHideChinese ? (
              <div className={`h-5 w-20 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                darkMode ? 'bg-neutral-dark-200' : 'bg-neutral-200'
              }`}>
                <span className={`text-xs font-medium transition-colors duration-300 ${
                  darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
                }`}>
                  点击显示
                </span>
              </div>
            ) : (
              <p className={`text-sm font-chinese ${
                !isNotMastered 
                  ? darkMode ? 'text-dark-400' : 'text-neutral-400'
                  : darkMode ? 'text-dark-300' : 'text-neutral-600'
              }`}>
                {word.chinese}
              </p>
            )}
          </div>
        </div>

        {/* 切换开关 */}
        <div className="flex-shrink-0 ml-3">
          {/* 自定义开关：开 = 未掌握 (isNotMastered=true)，关 = 掌握 */}
          <div
            role="switch"
            aria-checked={isNotMastered}
            tabIndex={0}
            onClick={handleToggle}
            onKeyDown={handleToggleKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            className={`
              relative inline-flex items-center transition-colors duration-200 rounded-full cursor-pointer w-12 h-6 p-1
              ${isNotMastered 
                ? darkMode ? 'bg-yellow-500' : 'bg-yellow-400' 
                : darkMode ? 'bg-dark-300' : 'bg-neutral-200'
              }
            `}
            title={isNotMastered ? '未掌握（点击标记为掌握）' : '掌握（点击标记为未掌握）'}
          >
            {/* knob */}
            <span
              className={`
                block bg-white w-4 h-4 rounded-full shadow transform transition-transform duration-200
                ${isNotMastered ? 'translate-x-6' : 'translate-x-0'}
              `}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
