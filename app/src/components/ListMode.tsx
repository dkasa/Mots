import React from 'react';
import { WordWithStatus, FilterType } from '../types/vocabulary';
import { WordListItem } from './WordListItem';
import { FilterTabs } from './FilterTabs';
import { LoadingSkeleton, ErrorState, EmptyState } from './LoadingStates';

interface ListModeProps {
  words: WordWithStatus[];
  filteredWords: WordWithStatus[];
  loading: boolean;
  error: string | null;
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  onWordClick: (word: WordWithStatus) => void;
  onRetry: () => void;
}

export function ListMode({ 
  words, 
  filteredWords, 
  loading, 
  error, 
  currentFilter, 
  onFilterChange, 
  onWordClick, 
  onRetry 
}: ListModeProps) {
  // 统计数据
  const masteredCount = words.filter(word => word.isMastered).length;
  const unmasteredCount = words.filter(word => !word.isMastered).length;
  const totalCount = words.length;

  // 加载状态
  if (loading) {
    return (
      <div className="space-y-4 px-5">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="bg-bg-card p-4 rounded-lg animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-5 bg-neutral-200 rounded w-24" />
                  <div className="h-5 bg-neutral-200 rounded w-12" />
                </div>
                <div className="space-y-1">
                  <div className="h-3 bg-neutral-200 rounded w-16" />
                  <div className="h-4 bg-neutral-200 rounded w-20" />
                </div>
              </div>
              <div className="w-6 h-6 bg-neutral-200 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 错误状态
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  return (
    <div className="pb-20">
      {/* 筛选器 */}
      <FilterTabs
        currentFilter={currentFilter}
        onFilterChange={onFilterChange}
        masteredCount={masteredCount}
        unmasteredCount={unmasteredCount}
        totalCount={totalCount}
      />

      {/* 单词列表 */}
      {filteredWords.length === 0 ? (
        <EmptyState message={
          currentFilter === 'mastered' ? '暂无已掌握的单词' :
          currentFilter === 'not-mastered' ? '暂无未掌握的单词' :
          '暂无单词'
        } />
      ) : (
        <div className="bg-bg-card">
          {filteredWords.map((word, index) => (
            <WordListItem
              key={word.id}
              word={word}
              onClick={() => onWordClick(word)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
