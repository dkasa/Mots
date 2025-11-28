import React from 'react';
import { ProgressData } from '../types/vocabulary';

interface ProgressIndicatorProps {
  progress: ProgressData;
  darkMode?: boolean;
}

export function ProgressIndicator({ progress, darkMode = false }: ProgressIndicatorProps) {
  return (
    <div className="px-5 mb-4">
      {/* 进度条 */}
      <div className={`w-full h-2 rounded-full overflow-hidden transition-colors duration-300 ${
        darkMode ? 'bg-neutral-dark-300' : 'bg-neutral-200'
      }`}>
        <div 
          className="h-full bg-primary-500 rounded-full transition-all duration-250 ease-out"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      
      {/* 进度文字 */}
      <div className="flex justify-between mt-2 text-sm font-medium">
        <span className={darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'}>
          已学{' '}
          <span className="text-primary-700 font-semibold">{progress.learned}</span>
          /{progress.total}
        </span>
        <span className={darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'}>
          已掌握{' '}
          <span className="text-success-700 font-semibold">{progress.mastered}</span>
        </span>
      </div>
    </div>
  );
}
