import React from 'react';
import { Settings } from 'lucide-react';
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
}

export function TopBar({ 
  currentViewMode, 
  onViewModeChange, 
  syncStatus,
  onManualSync 
}: TopBarProps) {
  const title = currentViewMode === 'learn' ? '单词学习' : '单词列表';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-bg-card border-b border-neutral-200 safe-area-inset-top">
      <div className="flex items-center justify-between h-14 px-5">
        <h1 className="text-lg font-semibold text-neutral-800">{title}</h1>
        
        <div className="flex items-center gap-2">
          {syncStatus && (
            <SyncStatusIndicator 
              syncStatus={syncStatus} 
              onSyncClick={onManualSync}
            />
          )}
          
          <UserMenu />
          
          <button className="p-2 rounded-md hover:bg-neutral-50 transition-colors">
            <Settings className="w-5 h-5 text-neutral-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
