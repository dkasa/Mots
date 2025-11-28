import { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressSyncData, SyncStatus } from '../types/auth';
import { apiService } from '../services/api';

interface UseSyncProgressOptions {
  learnedWords: Record<string, boolean>;
  masteredWords: Record<string, boolean>;
  currentGrade: number;
  currentViewMode: 'learn' | 'list' | 'search';
  currentFilter: 'all' | 'mastered' | 'not-mastered';
  isAuthenticated: boolean;
  onSyncComplete?: (data: ProgressSyncData) => void;
  onSyncError?: (error: string) => void;
}

export function useSyncProgress({
  learnedWords,
  masteredWords,
  currentGrade,
  currentViewMode,
  currentFilter,
  isAuthenticated,
  onSyncComplete,
  onSyncError,
}: UseSyncProgressOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    lastSyncTime: null,
    syncInProgress: false,
    hasUnsyncedChanges: false,
  });

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncDataRef = useRef<string>('');

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      if (syncStatus.hasUnsyncedChanges && isAuthenticated) {
        syncToServer();
      }
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [syncStatus.hasUnsyncedChanges, isAuthenticated]);

  // 检查是否有未同步的更改
  const checkForChanges = useCallback(() => {
    const currentData = JSON.stringify({
      learnedWords,
      masteredWords,
      currentGrade,
      currentViewMode,
      currentFilter,
    });

    const hasChanges = currentData !== lastSyncDataRef.current;
    
    setSyncStatus(prev => ({
      ...prev,
      hasUnsyncedChanges: hasChanges,
    }));

    return hasChanges;
  }, [learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter]);

  // 同步到服务器
  const syncToServer = useCallback(async () => {
    if (!isAuthenticated || syncStatus.syncInProgress || !syncStatus.isOnline) {
      return;
    }

    try {
      setSyncStatus(prev => ({ ...prev, syncInProgress: true }));

      const progressData: ProgressSyncData = {
        learnedWords,
        masteredWords,
        currentGrade,
        currentViewMode,
        currentFilter,
        clientTimestamp: new Date().toISOString(), // 添加客户端时间戳
      };

      const response = await apiService.syncProgress(progressData);

      if (response.success) {
        // 服务器返回的数据可能与本地数据有合并，需要更新本地状态
        lastSyncDataRef.current = JSON.stringify(response.data);
        
        setSyncStatus(prev => ({
          ...prev,
          lastSyncTime: new Date(),
          syncInProgress: false,
          hasUnsyncedChanges: false,
        }));

        onSyncComplete?.(response.data);
      } else {
        throw new Error('Sync failed');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
      onSyncError?.(error.message || 'Sync failed');
    }
  }, [
    isAuthenticated,
    syncStatus.syncInProgress,
    syncStatus.isOnline,
    learnedWords,
    masteredWords,
    currentGrade,
    currentViewMode,
    currentFilter,
    onSyncComplete,
    onSyncError,
  ]);

  // 从服务器获取数据
  const syncFromServer = useCallback(async () => {
    if (!isAuthenticated || !syncStatus.isOnline) {
      return;
    }

    try {
      setSyncStatus(prev => ({ ...prev, syncInProgress: true }));

      const response = await apiService.getProgress();

      if (response.success) {
        lastSyncDataRef.current = JSON.stringify(response.data);
        
        setSyncStatus(prev => ({
          ...prev,
          lastSyncTime: new Date(),
          syncInProgress: false,
          hasUnsyncedChanges: false,
        }));

        onSyncComplete?.(response.data);
      } else {
        throw new Error('Fetch failed');
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
      onSyncError?.(error.message || 'Fetch failed');
    }
  }, [isAuthenticated, syncStatus.isOnline, onSyncComplete, onSyncError]);

  // 防抖同步
  const debouncedSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      if (checkForChanges() && isAuthenticated && syncStatus.isOnline) {
        syncToServer();
      }
    }, 8000); // 8秒防抖，避免频繁同步
  }, [checkForChanges, isAuthenticated, syncStatus.isOnline, syncToServer]);

  // 监听数据变化，触发同步
  useEffect(() => {
    if (isAuthenticated) {
      debouncedSync();
    }
  }, [learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, isAuthenticated, debouncedSync]);

  // 初始化时从服务器获取数据
  useEffect(() => {
    if (isAuthenticated && syncStatus.isOnline) {
      syncFromServer();
    }
  }, [isAuthenticated]); // 只在认证状态变化时执行

  return {
    syncStatus,
    syncToServer,
    syncFromServer,
    checkForChanges,
  };
}