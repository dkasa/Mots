import React from 'react';
import { BookOpen, List } from 'lucide-react';
import { ViewMode } from '../types/vocabulary';

interface BottomNavigationProps {
  currentViewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function BottomNavigation({ currentViewMode, onViewModeChange }: BottomNavigationProps) {
  const navItems = [
    {
      id: 'learn' as ViewMode,
      icon: BookOpen,
      label: '学习',
    },
    {
      id: 'list' as ViewMode,
      icon: List,
      label: '列表',
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg-card border-t border-neutral-200 safe-area-inset-bottom shadow-lg">
      <div className="flex">
        {navItems.map((item) => {
          const isActive = currentViewMode === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewModeChange(item.id)}
              className="
                flex-1 flex flex-col items-center justify-center py-3 
                relative transition-colors duration-250
                text-neutral-400 hover:text-neutral-600
                active:bg-neutral-50
              "
            >
              <Icon className={`w-6 h-6 mb-1 ${isActive ? 'text-primary-500' : ''}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-primary-500 font-semibold' : ''}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-primary-500 rounded-b-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
