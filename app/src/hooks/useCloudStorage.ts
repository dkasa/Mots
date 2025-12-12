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

// 独立的下载函数，用于紧急情况
export const downloadFromCloud = async () => {
  console.log('开始从云端下载数据（紧急下载）...');
  
  try {
    const currentHost = window.location.hostname;
    const response = await fetch(`${import.meta.env.VITE_API_URL || `http://${currentHost}:3001`}/api/progress`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('mots-auth-token')}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('收到服务器响应:', response.status, response.statusText);

    if (!response.ok) {
      console.error('服务器响应失败:', response.status, response.statusText);
      throw new Error(`Failed to fetch cloud data: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('解析后的响应数据:', result);
    
    if (result.success) {
      console.log('服务器返回成功，数据已获取');
      return result.data;
    } else {
      console.error('服务器返回失败状态:', result);
      throw new Error('Server returned failure status');
    }
  } catch (error) {
    console.error('云端下载失败:', error);
    throw error;
  }
};

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
    console.log('开始从云端下载数据...', { isAuthenticated, syncInProgress });
    if (!isAuthenticated || syncInProgress) {
      console.log('跳过下载：未认证或同步正在进行中', { isAuthenticated, syncInProgress });
      return;
    }

    try {
      setSyncInProgress(true);
      console.log('设置同步进行中状态为true');
      
      const currentHost = window.location.hostname;
      console.log('准备请求云端数据，API地址:', `${import.meta.env.VITE_API_URL || `http://${currentHost}:3001`}/api/progress`);
      const response = await fetch(`${import.meta.env.VITE_API_URL || `http://${currentHost}:3001`}/api/progress`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mots-auth-token')}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('收到服务器响应:', response.status, response.statusText);

      if (!response.ok) {
        console.error('服务器响应失败:', response.status, response.statusText);
        throw new Error(`Failed to fetch cloud data: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('解析后的响应数据:', result);
      
      if (result.success) {
        console.log('服务器返回成功，准备更新本地数据...');
        onCloudDataUpdate(result.data);
        setLastCloudSync(new Date());
        console.log('本地数据更新完成，设置最后同步时间为当前时间');
      } else {
        console.error('服务器返回失败状态:', result);
      }
    } catch (error) {
      console.error('云端下载失败:', error);
    } finally {
      setSyncInProgress(false);
      console.log('设置同步进行中状态为false');
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

  // 移除自动同步：不再在用户登录时自动从云端下载
  // useEffect(() => {
  //   if (isAuthenticated) {
  //     // 如果从未同步过，或者距离上次同步超过一定时间，则触发同步
  //     if (!lastCloudSync || (Date.now() - lastCloudSync.getTime()) > 5000) {
  //       console.log('检测到用户登录，准备从云端下载数据...');
  //       downloadFromCloud();
  //     }
  //   }
  // }, [isAuthenticated, lastCloudSync, downloadFromCloud]);

  return {
    isCloudEnabled,
    lastCloudSync,
    syncInProgress,
    downloadFromCloud,
    uploadToCloud,
  };
}