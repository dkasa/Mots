import React, { useState, useEffect } from 'react';
import { WordWithStatus } from '../types/vocabulary';

interface WordListItemProps {
  word: WordWithStatus;
  /**
   * onToggle(word, newIsMastered)
   * newIsMastered: true = 掌握, false = 未掌握
   */
  onToggle?: (word: WordWithStatus, newIsMastered: boolean) => void;
  darkMode?: boolean;
}

export function WordListItem({ word, onToggle, darkMode = false }: WordListItemProps) {
  const [isNotMastered, setIsNotMastered] = useState<boolean>(!word.isMastered);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsNotMastered(!word.isMastered);
  }, [word.isMastered]);

  // 现在把持久化交给父组件（onToggle），组件只负责本地乐观显示
  const callParentToggle = async (newIsMastered: boolean) => {
    if (!onToggle) return;
    try {
      setSaving(true);
      // 同步调用父组件处理（父组件负责持久化 & 刷新列表）
      await Promise.resolve(onToggle(word, newIsMastered));
    } catch (e) {
      console.error('onToggle failed', e);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (saving) return;
    const newIsNotMastered = !isNotMastered;
    setIsNotMastered(newIsNotMastered); // 乐观更新 UI (开关跳左跳右)
    const newIsMastered = !newIsNotMastered; // 计算要保存的 isMastered 值

    try {
      console.log('[WordListItem] toggle', word.id, '-> isMastered=', newIsMastered);
      await callParentToggle(newIsMastered);
      // 父组件会更新列表并重新传入 props，useEffect 会同步 local state
    } catch (err) {
      // 出错回滚
      setIsNotMastered(!newIsNotMastered);
      // 如果父组件未做回滚（不太可能），这里再尝试通知父组件回退
      if (onToggle) {
        try {
          onToggle(word, !newIsMastered);
        } catch (err2) {
          console.error('rollback onToggle failed', err2);
        }
      }
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
        <div className="flex-1">
          {/* 法语单词和词性 */}
          <div className="flex items-center gap-3 mb-1">
            <h3 className={`text-lg font-semibold leading-tight font-french ${
              !isNotMastered 
                ? darkMode ? 'line-through text-dark-400' : 'line-through text-neutral-400'
                : darkMode ? 'text-dark-100' : 'text-neutral-800'
            }`}>
              {word.french}
            </h3>
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
            <p className={`text-sm font-chinese ${
              !isNotMastered 
                ? darkMode ? 'text-dark-400' : 'text-neutral-400'
                : darkMode ? 'text-dark-300' : 'text-neutral-600'
            }`}>
              {word.chinese}
            </p>
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
}
