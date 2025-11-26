import { useState, useEffect, useCallback } from 'react';
import { Grade, FilterType, ViewMode } from '../types/vocabulary';
import { ProgressSyncData } from '../types/auth';
import { useAuth } from './useAuth';

interface CloudStorageOptions {
  currentGrade: Grade;
  currentViewMode: ViewMode;
  currentFilter: FilterType;
  learnedWords: Record<string, boolean>;
  masteredWords: Record<string, boolean>;
  onCloudDataUpdate: (data: ProgressSyncData) => void;
}

export function useCloudStorage({
  currentGrade,
  currentViewMode,
  currentFilter,
  learnedWords,
  masteredWords,
  onCloudDataUpdate,
}: CloudStorageOptions) {
  const { isAuthenticated } = useAuth();
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [lastCloudSync, setLastCloudSync] = useState<Date | null>(null);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // 检查是否启用云端存储
  useEffect(() => {
    setIsCloudEnabled(isAuthenticated);
  }, [isAuthenticated]);

  // 从云端下载数据
  const downloadFromCloud = useCallback(async () => {
    if (!isAuthenticated || syncInProgress) return;

    try {
      setSyncInProgress(true);
      
      const currentHost = window.location.hostname;
      const response = await fetch(`${import.meta.env.VITE_API_URL || `http://${currentHost}:3001`}/api/progress`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mots-auth-token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cloud data');
      }

      const result = await response.json();
      
      if (result.success) {
        onCloudDataUpdate(result.data);
        setLastCloudSync(new Date());
      }
    } catch (error) {
      console.error('Cloud download failed:', error);
    } finally {
      setSyncInProgress(false);
    }
  }, [isAuthenticated, syncInProgress, onCloudDataUpdate]);

  // 上传数据到云端
  const uploadToCloud = useCallback(async () => {
    if (!isAuthenticated || syncInProgress) return;

    try {
      setSyncInProgress(true);

      const data: ProgressSyncData = {
        learnedWords,
        masteredWords,
        currentGrade,
        currentViewMode,
        currentFilter,
      };

      const currentHost = window.location.hostname;
      const response = await fetch(`${import.meta.env.VITE_API_URL || `http://${currentHost}:3001`}/api/progress/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mots-auth-token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to upload to cloud');
      }

      const result = await response.json();
      
      if (result.success) {
        // 服务器返回合并后的数据，需要更新本地
        onCloudDataUpdate(result.data);
        setLastCloudSync(new Date());
      }
    } catch (error) {
      console.error('Cloud upload failed:', error);
    } finally {
      setSyncInProgress(false);
    }
  }, [
    isAuthenticated,
    syncInProgress,
    learnedWords,
    masteredWords,
    currentGrade,
    currentViewMode,
    currentFilter,
    onCloudDataUpdate,
  ]);

  // 自动同步：当用户登录时从云端下载
  useEffect(() => {
    if (isAuthenticated && !lastCloudSync) {
      downloadFromCloud();
    }
  }, [isAuthenticated, lastCloudSync, downloadFromCloud]);

  return {
    isCloudEnabled,
    lastCloudSync,
    syncInProgress,
    downloadFromCloud,
    uploadToCloud,
  };
}