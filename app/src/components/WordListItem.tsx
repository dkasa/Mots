import React, { useState, useEffect, useRef } from 'react';
import { WordWithStatus } from '../types/vocabulary';

type RecallMode = 'none' | 'hide-french' | 'hide-chinese';

interface WordListItemProps {
  word: WordWithStatus;
  onToggle?: (word: WordWithStatus, newIsMastered: boolean) => void;
  darkMode?: boolean;
  recallMode?: RecallMode;
}

export const WordListItem = React.memo(function WordListItem({
  word,
  onToggle,
  darkMode = false,
  recallMode = 'none',
}: WordListItemProps) {
  const [isNotMastered, setIsNotMastered] = useState(!word.isMastered);
  const [isRevealed, setIsRevealed] = useState(false);

  // 是否处于「用户主动操作」中
  const userInteractedRef = useRef(false);

  /** ✅ 只在“新单词 / 首次渲染”时从 props 同步 */
  useEffect(() => {
    if (!userInteractedRef.current) {
      setIsNotMastered(!word.isMastered);
    }
  }, [word.id, word.isMastered]);

  // 回忆模式变化时重置显示
  useEffect(() => {
    setIsRevealed(false);
  }, [recallMode, word.id]);

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();

    userInteractedRef.current = true;

    const nextIsNotMastered = !isNotMastered;
    setIsNotMastered(nextIsNotMastered);

    onToggle?.(word, !nextIsNotMastered);
  };

  const handleToggleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e);
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
      className={`w-full px-5 py-4 text-left transition-colors ${
        darkMode
          ? 'bg-dark-card hover:bg-dark-elevated'
          : 'bg-bg-card hover:bg-neutral-50 border-b'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1" onClick={handleContentClick}>
          {/* 法语 */}
          <h3 className={`text-lg font-semibold ${
            isNotMastered ? '' : 'opacity-50'
          }`}>
            {shouldHideFrench ? '点击显示' : word.french}
          </h3>

          {/* 中文 */}
          <p className={`text-sm ${
            isNotMastered ? '' : 'opacity-50'
          }`}>
            {shouldHideChinese ? '点击显示' : word.chinese}
          </p>
        </div>

        {/* Toggle */}
        <div
          role="switch"
          aria-checked={isNotMastered}
          tabIndex={0}
          onClick={handleToggle}
          onKeyDown={handleToggleKeyDown}
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition ${
            isNotMastered ? 'bg-yellow-400' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`block w-4 h-4 bg-white rounded-full transition-transform ${
              isNotMastered ? 'translate-x-6' : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
});