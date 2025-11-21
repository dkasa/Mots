import React from 'react';
import { Check } from 'lucide-react';
import { WordWithStatus } from '../types/vocabulary';

interface WordListItemProps {
  word: WordWithStatus;
  onClick: () => void;
}

export function WordListItem({ word, onClick }: WordListItemProps) {
  const isMastered = word.isMastered;
  
  return (
    <button
      onClick={onClick}
      className="
        w-full px-5 py-4 bg-bg-card hover:bg-neutral-50 
        border-b border-neutral-200
        text-left transition-colors duration-150
        active:bg-neutral-100
      "
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* 法语单词和词性 */}
          <div className="flex items-center gap-3 mb-1">
            <h3 className={`text-lg font-semibold leading-tight font-french ${
              isMastered ? 'line-through text-neutral-400' : 'text-neutral-800'
            }`}>
              {word.french}
            </h3>
            <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded-full flex-shrink-0">
              {word.part_of_speech}
            </span>
          </div>
          
          {/* 音标和中文释义 */}
          <div className="space-y-1">
            <p className={`text-xs font-phonetic italic ${
              isMastered ? 'text-neutral-400' : 'text-neutral-600'
            }`}>
              {word.phonetic}
            </p>
            <p className={`text-sm font-chinese ${
              isMastered ? 'text-neutral-400' : 'text-neutral-600'
            }`}>
              {word.chinese}
            </p>
          </div>
        </div>
        
        {/* 状态图标 */}
        <div className="flex-shrink-0 ml-3">
          {isMastered ? (
            <div className="w-6 h-6 bg-success-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          ) : (
            <div className="w-3 h-3 bg-secondary-500 rounded-full" />
          )}
        </div>
      </div>
    </button>
  );
}
