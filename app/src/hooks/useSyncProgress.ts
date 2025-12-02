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

  // 检查服务器连接状态
  const checkServerConnection = useCallback(async () => {
    try {
      const isServerReachable = await apiService.isServerOnline();
      setSyncStatus(prev => ({ ...prev, isOnline: isServerReachable }));
      return isServerReachable;
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
      return false;
    }
  }, []);

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

  // 智能同步：检查本地修改，决定同步方向
  const smartSync = useCallback(async () => {
    if (!isAuthenticated || syncStatus.syncInProgress || !syncStatus.isOnline) {
      return;
    }

    try {
      setSyncStatus(prev => ({ ...prev, syncInProgress: true }));

      // 1. 获取服务器时间戳
      const serverTimestamp = await apiService.getLastSyncTimestamp();
      
      // 2. 检查本地是否有修改
      const hasLocalChanges = checkForChanges();
      const localLastSync = syncStatus.lastSyncTime?.toISOString();
      
      // 3. 决定同步策略
      if (hasLocalChanges) {
        // 有本地修改，总是先推送
        console.log('检测到本地修改，推送到服务器');
        await syncToServer();
      } else if (serverTimestamp && localLastSync && serverTimestamp > localLastSync) {
        // 无本地修改，但服务器有更新，拉取
        console.log('服务器数据更新，拉取到本地');
        const response = await apiService.getProgress();
        if (response.success) {
          lastSyncDataRef.current = JSON.stringify(response.data);
          setSyncStatus(prev => ({
            ...prev,
            lastSyncTime: new Date(),
            hasUnsyncedChanges: false,
          }));
          onSyncComplete?.(response.data);
        }
      } else if (!localLastSync || !serverTimestamp) {
        // 初次同步或无时间戳信息，直接拉取
        console.log('初次同步或时间戳缺失，拉取服务器数据');
        const response = await apiService.getProgress();
        if (response.success) {
          lastSyncDataRef.current = JSON.stringify(response.data);
          setSyncStatus(prev => ({
            ...prev,
            lastSyncTime: new Date(),
            hasUnsyncedChanges: false,
          }));
          onSyncComplete?.(response.data);
        }
      } else {
        console.log('无需同步：本地无修改，服务器无更新');
      }
    } catch (error: any) {
      console.error('Smart sync error:', error);
      onSyncError?.(error.message || 'Smart sync failed');
    } finally {
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
    }
  }, [isAuthenticated, syncStatus.syncInProgress, syncStatus.isOnline, syncStatus.lastSyncTime, checkForChanges, syncToServer, onSyncError, onSyncComplete]);

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = async () => {
      // 先更新浏览器网络状态
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      // 然后检查实际的服务器连接
      const serverReachable = await checkServerConnection();
      if (serverReachable && syncStatus.hasUnsyncedChanges && isAuthenticated) {
        syncToServer();
      } else if (serverReachable && isAuthenticated) {
        // 即使没有未同步的更改，也执行一次智能同步检查服务器更新
        smartSync();
      }
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    // 初始检查服务器连接
    checkServerConnection();

    // 定期检查服务器连接（每30秒）
    const connectionIntervalId = setInterval(checkServerConnection, 30000);
    
    // 定期执行智能同步（每60秒），即使没有本地变化也能获取服务器更新
    let syncIntervalId: NodeJS.Timeout | null = null;
    if (isAuthenticated) {
      syncIntervalId = setInterval(() => {
        if (syncStatus.isOnline) {
          smartSync();
        }
      }, 60000);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectionIntervalId);
      if (syncIntervalId) clearInterval(syncIntervalId);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [syncStatus.hasUnsyncedChanges, isAuthenticated, checkServerConnection, syncStatus.isOnline, smartSync, syncToServer]);



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

  // 监听数据变化，触发智能同步
  useEffect(() => {
    if (isAuthenticated && syncStatus.isOnline) {
      debouncedSync();
    }
  }, [learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, isAuthenticated, syncStatus.isOnline, debouncedSync]);

  // 初始化时进行智能同步
  useEffect(() => {
    if (isAuthenticated && syncStatus.isOnline) {
      smartSync();
    }
  }, [isAuthenticated]); // 只在认证状态变化时执行

  return {
    syncStatus,
    syncToServer,
    syncFromServer: smartSync, // 为了向后兼容，将 syncFromServer 映射到 smartSync
    checkForChanges,
    smartSync,
  };
}