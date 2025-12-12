import React, { useState } from 'react';
import { Search, Moon, Sun, Eye, EyeOff, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { ViewMode } from '../types/vocabulary';
import { UserMenu } from './UserMenu';

type RecallMode = 'none' | 'hide-french' | 'hide-chinese';

interface TopBarProps {
  currentViewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  syncStatus?: {
    isOnline: boolean;
    syncInProgress: boolean;
    lastSyncTime: Date | null;
    hasUnsyncedChanges: boolean;
  };
  syncError?: string | null;
  onManualSync?: () => void;
  darkMode?: boolean;
  onDarkModeToggle?: () => void;
  recallMode?: RecallMode;
  onRecallModeChange?: (mode: RecallMode) => void;
}

export function TopBar({ 
  currentViewMode, 
  onViewModeChange, 
  syncStatus,
  syncError,
  onManualSync,
  darkMode = false,
  onDarkModeToggle,
  recallMode = 'none',
  onRecallModeChange
}: TopBarProps) {
  const [showRecallMenu, setShowRecallMenu] = useState(false);

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

  const handleRecallModeChange = (mode: RecallMode) => {
    onRecallModeChange?.(mode);
    setShowRecallMenu(false);
  };

  const getRecallModeTitle = () => {
    switch (recallMode) {
      case 'hide-french':
        return '隐藏法语';
      case 'hide-chinese':
        return '隐藏中文';
      default:
        return '主动回忆';
    }
  };

  // 获取同步状态图标
  const getSyncStatusIcon = (status: any) => {
    if (syncError) {
      return <RefreshCw className="w-5 h-5 text-red-500" />;
    } else if (status.syncInProgress) {
      return <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />;
    } else if (!status.isOnline) {
      return <WifiOff className="w-5 h-5 text-gray-500" />;
    } else if (status.hasUnsyncedChanges) {
      return <RefreshCw className="w-5 h-5 text-orange-500" />;
    } else {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  // 获取同步状态提示文本
  const getSyncStatusTooltip = (status: any) => {
    if (syncError) {
      return `同步错误: ${syncError}`;
    } else if (status.syncInProgress) {
      return '同步中...';
    } else if (!status.isOnline) {
      return '离线状态';
    } else if (status.hasUnsyncedChanges) {
      return '有待同步数据，点击同步';
    } else {
      const lastTime = status.lastSyncTime;
      if (lastTime) {
        const timeAgo = new Date(lastTime).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return `已同步 (${timeAgo})`;
      }
      return '已同步';
    }
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
          {/* 主动回忆模式切换按钮 - 仅在学习模式和列表模式下显示 */}
          {(currentViewMode === 'learn' || currentViewMode === 'list') && (
            <div className="relative">
              <button 
                onClick={() => setShowRecallMenu(!showRecallMenu)}
                className={`p-2 rounded-md transition-colors ${
                  recallMode !== 'none'
                    ? darkMode ? 'bg-blue-900 text-blue-400' : 'bg-blue-100 text-blue-600'
                    : darkMode 
                      ? 'hover:bg-neutral-dark-200 text-neutral-dark-600' 
                      : 'hover:bg-neutral-50 text-neutral-600'
                }`}
                title={getRecallModeTitle()}
              >
                {recallMode === 'none' ? (
                  <Eye className="w-5 h-5" />
                ) : (
                  <EyeOff className="w-5 h-5" />
                )}
              </button>
              
              {/* 回忆模式下拉菜单 */}
              {showRecallMenu && (
                <div className={`absolute right-0 mt-2 w-40 rounded-lg shadow-lg border ${
                  darkMode 
                    ? 'bg-bg-dark-card border-neutral-dark-300' 
                    : 'bg-bg-card border-neutral-200'
                }`}>
                  <button
                    onClick={() => handleRecallModeChange('none')}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      recallMode === 'none'
                        ? darkMode ? 'bg-blue-900 text-blue-400' : 'bg-blue-50 text-blue-600'
                        : darkMode 
                          ? 'hover:bg-neutral-dark-200 text-neutral-dark-600' 
                          : 'hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    显示全部
                  </button>
                  <button
                    onClick={() => handleRecallModeChange('hide-french')}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      recallMode === 'hide-french'
                        ? darkMode ? 'bg-blue-900 text-blue-400' : 'bg-blue-50 text-blue-600'
                        : darkMode 
                          ? 'hover:bg-neutral-dark-200 text-neutral-dark-600' 
                          : 'hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    隐藏法语
                  </button>
                  <button
                    onClick={() => handleRecallModeChange('hide-chinese')}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      recallMode === 'hide-chinese'
                        ? darkMode ? 'bg-blue-900 text-blue-400' : 'bg-blue-50 text-blue-600'
                        : darkMode 
                          ? 'hover:bg-neutral-dark-200 text-neutral-dark-600' 
                          : 'hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    隐藏中文
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* 同步状态指示器（增强版） */}
          {syncStatus && (
            <div 
              className={`p-2 rounded-md transition-colors cursor-pointer ${
                darkMode 
                  ? 'hover:bg-neutral-dark-200 text-neutral-dark-600' 
                  : 'hover:bg-neutral-50 text-neutral-600'
              }`}
              onClick={() => {
                if (onManualSync) {
                  console.log('🔄 手动同步按钮被点击');
                  onManualSync();
                }
              }}
              title={getSyncStatusTooltip(syncStatus)}
            >
              {getSyncStatusIcon(syncStatus)}
            </div>
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
          
          {/* 用户菜单 - 放在最右边 */}
          <UserMenu />
        </div>
      </div>
    </div>
  );
}
