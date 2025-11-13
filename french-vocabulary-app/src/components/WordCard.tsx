import React from 'react';
import { WordWithStatus } from '../types/vocabulary';

interface WordCardProps {
  word: WordWithStatus;
}

export function WordCard({ word }: WordCardProps) {
  return (
    <div className="mx-5 my-8 p-8 bg-bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow duration-250">
      {/* 词性标签 */}
      <div className="mb-6">
        <span className="inline-block px-3 py-1 text-xs font-medium text-secondary-900 bg-secondary-100 rounded-full">
          {word.part_of_speech}
        </span>
      </div>
      
      {/* 法语单词 */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-neutral-800 leading-tight font-french">
          {word.french}
        </h2>
      </div>
      
      {/* 音标 */}
      <div className="text-center mb-6">
        <p className="text-sm text-neutral-600 font-phonetic italic">
          {word.phonetic}
        </p>
      </div>
      
      {/* 中文释义 */}
      <div className="text-center">
        <p className="text-base text-neutral-800 font-chinese">
          {word.chinese}
        </p>
      </div>
      
      {/* 学习状态指示器（仅在学习模式下显示） */}
      {word.isMastered && (
        <div className="mt-6 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-success-50 rounded-full">
            <svg className="w-4 h-4 text-success-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-success-700">已掌握</span>
          </div>
        </div>
      )}
    </div>
  );
}
