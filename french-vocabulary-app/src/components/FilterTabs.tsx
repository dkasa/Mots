import React from 'react';
import { FilterType } from '../types/vocabulary';

interface FilterTabsProps {
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  masteredCount: number;
  unmasteredCount: number;
  totalCount: number;
}

export function FilterTabs({ currentFilter, onFilterChange, masteredCount, unmasteredCount, totalCount }: FilterTabsProps) {
  const filters = [
    { 
      id: 'all' as FilterType, 
      label: '全部', 
      count: totalCount 
    },
    { 
      id: 'mastered' as FilterType, 
      label: '已掌握', 
      count: masteredCount 
    },
    { 
      id: 'not-mastered' as FilterType, 
      label: '未掌握', 
      count: unmasteredCount 
    },
  ];

  return (
    <div className="px-5 py-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map((filter) => {
          const isActive = currentFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-250
                ${isActive 
                  ? 'bg-primary-500 text-white shadow-md' 
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }
              `}
            >
              {filter.label} ({filter.count})
            </button>
          );
        })}
      </div>
    </div>
  );
}
