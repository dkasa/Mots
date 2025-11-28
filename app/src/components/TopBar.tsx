import React from 'react';
import { Settings, Search, Moon, Sun } from 'lucide-react';
import { ViewMode } from '../types/vocabulary';
import { UserMenu } from './UserMenu';
import { SyncStatusIndicator } from './SyncStatusIndicator';

interface TopBarProps {
  currentViewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  syncStatus?: {
    isOnline: boolean;
    syncInProgress: boolean;
    lastSyncTime: Date | null;
    hasUnsyncedChanges: boolean;
  };
  onManualSync?: () => void;
  darkMode?: boolean;
  onDarkModeToggle?: () => void;
}

export function TopBar({ 
  currentViewMode, 
  onViewModeChange, 
  syncStatus,
  onManualSync,
  darkMode = false,
  onDarkModeToggle
}: TopBarProps) {
  const getTitle = () => {
    switch (currentViewMode) {
      case 'learn':
        return '单词学习';
      case 'list':
        return '单词列表';
      case 'search':
        return '查单词';
      default:
        return 'Mots';
    }
  };

  const handleSearchClick = () => {
    onViewModeChange('search');
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 safe-area-inset-top transition-colors duration-300 ${
      darkMode 
        ? 'bg-bg-dark-card border-b border-neutral-dark-300' 
        : 'bg-bg-card border-b border-neutral-200'
    }`}>
      <div className="flex items-center justify-between h-14 px-5">
        <h1 className={`text-lg font-semibold ${
          darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
        }`}>{getTitle()}</h1>
        
        <div className="flex items-center gap-2">
          {/* 搜索按钮 - 在非搜索模式下显示 */}
          {currentViewMode !== 'search' && (
            <button 
              onClick={handleSearchClick}
              className={`p-2 rounded-md transition-colors ${
                darkMode 
                  ? 'hover:bg-neutral-dark-200 text-neutral-dark-600' 
                  : 'hover:bg-neutral-50 text-neutral-600'
              }`}
              title="查单词"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
          
          {syncStatus && (
            <SyncStatusIndicator 
              syncStatus={syncStatus} 
              onSyncClick={onManualSync}
            />
          )}
          
          {/* 夜间模式切换按钮 */}
          <button 
            onClick={onDarkModeToggle}
            className={`p-2 rounded-md transition-colors ${
              darkMode 
                ? 'hover:bg-neutral-dark-200 text-neutral-dark-600' 
                : 'hover:bg-neutral-50 text-neutral-600'
            }`}
            title={darkMode ? '切换到日间模式' : '切换到夜间模式'}
          >
            {darkMode ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
          
          <UserMenu />
          
          <button className={`p-2 rounded-md transition-colors ${
            darkMode 
              ? 'hover:bg-neutral-dark-200 text-neutral-dark-600' 
              : 'hover:bg-neutral-50 text-neutral-600'
          }`}>
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
