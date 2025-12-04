import { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressSyncData, SyncStatus } from '../types/auth';
import { apiService } from '../services/api';

interface WordProgress {
  is_learned: boolean;
  is_mastered: boolean;
  updated_at: string;
}

interface UseSyncProgressOptions {
  learnedWords: Record<string, boolean>;
  masteredWords: Record<string, boolean>;
  currentGrade: number;
  currentViewMode: 'learn' | 'list' | 'search';
  currentFilter: 'all' | 'mastered' | 'not-mastered';
  isAuthenticated: boolean;
  userId?: number; // 当前用户ID，用于切换账号
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
  userId,
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
  const isSyncingFromCompletion = useRef<boolean>(false);
  const lastUserIdRef = useRef<number | null>(null);
  const smartSyncRef = useRef<(() => Promise<void>) | null>(null);

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

  // 获取本地单词进度（包含时间戳）
  const getLocalWordProgress = useCallback((wordId: string): WordProgress => {
    const key = `word_progress_${wordId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // 兼容旧格式
        return {
          is_learned: learnedWords[wordId] || false,
          is_mastered: masteredWords[wordId] || false,
          updated_at: new Date().toISOString()
        };
      }
    }
    
    return {
      is_learned: learnedWords[wordId] || false,
      is_mastered: masteredWords[wordId] || false,
      updated_at: new Date().toISOString()
    };
  }, [learnedWords, masteredWords]);

  // 更新本地单词进度（包含时间戳）
  const updateLocalWordProgress = useCallback((wordId: string, isLearned: boolean, isMastered: boolean) => {
    const key = `word_progress_${wordId}`;
    const progress: WordProgress = {
      is_learned: isLearned,
      is_mastered: isMastered,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(progress));
  }, []);

  // 检查是否有未同步的更改（只比较学习进度数据，不比较UI状态）
  const checkForChanges = useCallback(() => {
    const currentProgressData = JSON.stringify({
      learnedWords: Object.keys(learnedWords).sort().reduce((obj, key) => {
        obj[key] = learnedWords[key];
        return obj;
      }, {} as Record<string, boolean>),
      masteredWords: Object.keys(masteredWords).sort().reduce((obj, key) => {
        obj[key] = masteredWords[key];
        return obj;
      }, {} as Record<string, boolean>),
    });

    // 从 lastSyncDataRef 中提取进度数据进行比较
    let lastSyncProgressData = '';
    if (lastSyncDataRef.current) {
      try {
        const lastSyncData = JSON.parse(lastSyncDataRef.current);
        lastSyncProgressData = JSON.stringify({
          learnedWords: lastSyncData.learnedWords || {},
          masteredWords: lastSyncData.masteredWords || {},
        });
      } catch {
        // 如果解析失败，说明需要同步
        lastSyncProgressData = '';
      }
    }

    const hasChanges = currentProgressData !== lastSyncProgressData;
    
    setSyncStatus(prev => ({
      ...prev,
      hasUnsyncedChanges: hasChanges,
    }));

    return hasChanges;
  }, [learnedWords, masteredWords]);

  // 同步到服务器
  const syncToServer = useCallback(async () => {
    if (!isAuthenticated || syncStatus.syncInProgress || !syncStatus.isOnline) {
      return;
    }

    try {
      setSyncStatus(prev => ({ ...prev, syncInProgress: true }));

      // 发送完整的学习状态，而不是增量更新
      // 这样可以确保用户数据隔离，避免不同用户数据混合
      const progressData: ProgressSyncData = {
        learnedWords,
        masteredWords,
        currentGrade,
        currentViewMode,
        currentFilter,
        clientTimestamp: new Date().toISOString(),
      };

      console.log('📤 同步数据统计:', {
        学习单词数: Object.keys(learnedWords).length,
        掌握单词数: Object.keys(masteredWords).length
      });

      const response = await apiService.syncProgress(progressData);

      if (response.success) {
        // 更新本地时间戳
        for (const [wordId, isLearned] of Object.entries(learnedWords)) {
          const isMastered = masteredWords[wordId];
          updateLocalWordProgress(wordId, isLearned, isMastered);
        }

        // 存储服务器返回的进度数据，格式与 checkForChanges 一致
        lastSyncDataRef.current = JSON.stringify({
          learnedWords: response.data.learnedWords || {},
          masteredWords: response.data.masteredWords || {},
        });
        setSyncStatus(prev => ({
          ...prev,
          lastSyncTime: new Date(),
          syncInProgress: false,
          hasUnsyncedChanges: false,
        }));

        console.log('✅ 同步完成:', {
          服务器学习单词数: Object.keys(response.data.learnedWords || {}).length,
          服务器掌握单词数: Object.keys(response.data.masteredWords || {}).length
        });

        isSyncingFromCompletion.current = true;
        setTimeout(() => {
          isSyncingFromCompletion.current = false;
        }, 2000);

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
    updateLocalWordProgress,
  ]);

  // 双向合并策略
  const bidirectionalMerge = useCallback(async (
    cloudLearnedWords: Record<string, boolean>,
    cloudMasteredWords: Record<string, boolean>
  ) => {
    try {
      console.log('🔄 开始双向合并...');
      console.log('📊 合并前统计:', {
        '本地学习单词数': Object.keys(learnedWords).length,
        '本地掌握单词数': Object.keys(masteredWords).length,
        '云端学习单词数': Object.keys(cloudLearnedWords).length,
        '云端掌握单词数': Object.keys(cloudMasteredWords).length
      });
      
      // 获取所有相关的单词ID
      const allWordIds = new Set([
        ...Object.keys(learnedWords),
        ...Object.keys(masteredWords),
        ...Object.keys(cloudLearnedWords),
        ...Object.keys(cloudMasteredWords)
      ]);

      const mergedLearnedWords: Record<string, boolean> = {};
      const mergedMasteredWords: Record<string, boolean> = {};

      // 对每个单词进行合并
      for (const wordId of allWordIds) {
        const localProgress = getLocalWordProgress(wordId);
        
        // 对于云端数据，我们假设云端数据总是较新的（因为云端是权威数据源）
        // 除非本地有明确的时间戳更新
        const cloudLearned = cloudLearnedWords[wordId] || false;
        const cloudMastered = cloudMasteredWords[wordId] || false;
        
        // 本地是否有这个单词的记录
        const hasLocalRecord = learnedWords[wordId] !== undefined || masteredWords[wordId] !== undefined;
        // 云端是否有这个单词的记录
        const hasCloudRecord = cloudLearnedWords[wordId] !== undefined || cloudMasteredWords[wordId] !== undefined;
        
        if (!hasLocalRecord && hasCloudRecord) {
          // 只有云端有记录，使用云端数据
          mergedLearnedWords[wordId] = cloudLearned;
          mergedMasteredWords[wordId] = cloudMastered;
        } else if (hasLocalRecord && !hasCloudRecord) {
          // 只有本地有记录，使用本地数据
          mergedLearnedWords[wordId] = localProgress.is_learned;
          mergedMasteredWords[wordId] = localProgress.is_mastered;
        } else if (hasLocalRecord && hasCloudRecord) {
          // 两边都有记录，进行合并
          // 如果本地学习状态或掌握状态与云端不同，且本地时间戳较新，则保留本地
          const localLearned = learnedWords[wordId] || false;
          const localMastered = masteredWords[wordId] || false;
          
          if ((localLearned !== cloudLearned || localMastered !== cloudMastered) && 
              localProgress.is_learned === localLearned && 
              localProgress.is_mastered === localMastered) {
            // 本地数据有变化且与云端不同，使用本地数据
            mergedLearnedWords[wordId] = localLearned;
            mergedMasteredWords[wordId] = localMastered;
          } else {
            // 使用云端数据
            mergedLearnedWords[wordId] = cloudLearned;
            mergedMasteredWords[wordId] = cloudMastered;
          }
        }
      }

      console.log('📊 合并后统计:', {
        '合并后学习单词数': Object.keys(mergedLearnedWords).length,
        '合并后掌握单词数': Object.keys(mergedMasteredWords).length
      });

      // 更新本地存储
      for (const [wordId, isLearned] of Object.entries(mergedLearnedWords)) {
        const isMastered = mergedMasteredWords[wordId];
        updateLocalWordProgress(wordId, isLearned, isMastered);
      }

      // 上传合并后的数据到云端
      const mergedData: ProgressSyncData = {
        learnedWords: mergedLearnedWords,
        masteredWords: mergedMasteredWords,
        currentGrade,
        currentViewMode,
        currentFilter,
        clientTimestamp: new Date().toISOString(),
      };

      const response = await apiService.syncProgress(mergedData);
      
      if (response.success) {
        console.log('✅ 双向合并完成');
        // 存储服务器返回的进度数据，格式与 checkForChanges 一致
        lastSyncDataRef.current = JSON.stringify({
          learnedWords: response.data.learnedWords || {},
          masteredWords: response.data.masteredWords || {},
        });
        setSyncStatus(prev => ({
          ...prev,
          lastSyncTime: new Date(),
          syncInProgress: false,
          hasUnsyncedChanges: false,
        }));
        onSyncComplete?.(response.data);
      } else {
        throw new Error('合并后上传失败');
      }
    } catch (error: any) {
      console.error('双向合并失败:', error);
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
      onSyncError?.(error.message || '双向合并失败');
    }
  }, [learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, getLocalWordProgress, updateLocalWordProgress, onSyncComplete, onSyncError]);

  // 首次登录同步策略
  const firstTimeSync = useCallback(async () => {
    if (!isAuthenticated || syncStatus.syncInProgress || !syncStatus.isOnline) {
      return;
    }

    try {
      console.log('🔄 首次登录同步开始...');
      setSyncStatus(prev => ({ ...prev, syncInProgress: true }));

      // 获取云端进度
      const response = await apiService.getProgress();
      
      if (response.success && response.data) {
        const cloudLearnedWords = response.data.learnedWords || {};
        const cloudMasteredWords = response.data.masteredWords || {};
        
        // 检查云端是否有记录
        const hasCloudData = Object.keys(cloudLearnedWords).length > 0 || 
                            Object.keys(cloudMasteredWords).length > 0;
        
        if (!hasCloudData) {
          // 云端没有记录，上传本地数据作为初始进度
          console.log('☁️ 云端无记录，上传本地数据作为初始进度');
          await syncToServer();
        } else {
          // 云端有记录，直接使用云端数据（不进行合并，避免数据混合）
          console.log('☁️ 云端有记录，直接使用云端数据');
          console.log('📊 云端数据统计:', {
            '云端学习单词数': Object.keys(cloudLearnedWords).length,
            '云端掌握单词数': Object.keys(cloudMasteredWords).length
          });
          
          // 更新本地数据和时间戳
          for (const [wordId, isLearned] of Object.entries(cloudLearnedWords)) {
            const isMastered = cloudMasteredWords[wordId] || false;
            updateLocalWordProgress(wordId, Boolean(isLearned), isMastered);
          }
          
          // 存储服务器返回的进度数据，格式与 checkForChanges 一致
          lastSyncDataRef.current = JSON.stringify({
            learnedWords: cloudLearnedWords,
            masteredWords: cloudMasteredWords,
          });
          
          setSyncStatus(prev => ({
            ...prev,
            lastSyncTime: new Date(),
            syncInProgress: false,
            hasUnsyncedChanges: false,
          }));
          
          isSyncingFromCompletion.current = true;
          setTimeout(() => {
            isSyncingFromCompletion.current = false;
          }, 2000);
          
          onSyncComplete?.({
            learnedWords: cloudLearnedWords,
            masteredWords: cloudMasteredWords,
            currentGrade,
            currentViewMode,
            currentFilter,
            clientTimestamp: new Date().toISOString(),
          });
        }
      } else {
        // 获取云端数据失败，上传本地数据
        console.log('☁️ 获取云端数据失败，上传本地数据');
        await syncToServer();
      }
    } catch (error: any) {
      console.error('首次同步失败:', error);
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
      onSyncError?.(error.message || '首次同步失败');
    }
  }, [isAuthenticated, syncStatus.syncInProgress, syncStatus.isOnline, onSyncError, syncToServer, currentGrade, currentViewMode, currentFilter, updateLocalWordProgress, onSyncComplete]);

  // 智能同步：根据用户状态选择合适的同步策略
  const smartSync = useCallback(async () => {
    if (syncStatus.syncInProgress) {
      console.log('🚫 同步正在进行中，跳过');
      return;
    }

    if (isSyncingFromCompletion.current) {
      console.log('🚫 防止同步完成后立即重新同步');
      return;
    }

    if (!isAuthenticated) {
      console.log('📱 未登录用户，仅使用本地存储');
      // 未登录用户只更新本地时间戳
      for (const [wordId, isLearned] of Object.entries(learnedWords)) {
        const isMastered = masteredWords[wordId];
        updateLocalWordProgress(wordId, isLearned, isMastered);
      }
      return;
    }

    if (!syncStatus.isOnline) {
      console.log('📶 网络断线，仅更新本地存储');
      // 网络断线时只更新本地
      for (const [wordId, isLearned] of Object.entries(learnedWords)) {
        const isMastered = masteredWords[wordId];
        updateLocalWordProgress(wordId, isLearned, isMastered);
      }
      setSyncStatus(prev => ({ ...prev, hasUnsyncedChanges: true }));
      return;
    }

    // 检查是否是切换账号
    if (lastUserIdRef.current !== null && userId !== undefined && lastUserIdRef.current !== userId) {
      console.log(`🔄 检测到账号切换: 用户 ${lastUserIdRef.current} -> 用户 ${userId}`);
      
      // 先提交前一个用户的进度
      await syncToServer();
      
      // 清空本地进度缓存和同步状态
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('word_progress_')) {
          localStorage.removeItem(key);
        }
      }
      
      // 重置同步状态
      lastSyncDataRef.current = '';
      isSyncingFromCompletion.current = false;
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: null,
        hasUnsyncedChanges: false,
        syncInProgress: false, // 确保重置同步状态
      }));
      
      lastUserIdRef.current = userId;
      
      // 延迟一下再拉取新用户的云端进度，确保状态完全重置
      setTimeout(async () => {
        console.log('🔄 拉取新用户的云端进度');
        await firstTimeSync();
      }, 100);
      return;
    }

    if (userId !== undefined) {
      lastUserIdRef.current = userId;
    }

    // 检查是否是首次登录
    const hasLocalData = Object.keys(learnedWords).length > 0 || Object.keys(masteredWords).length > 0;
    
    if (!lastSyncDataRef.current && hasLocalData) {
      console.log('🔄 首次登录且有本地数据，执行首次同步');
      await firstTimeSync();
      return;
    }

    // 常规同步：检查本地修改，决定同步方向
    try {
      console.log('🔄 开始智能同步...');
      setSyncStatus(prev => ({ ...prev, syncInProgress: true }));

      const serverTimestamp = await apiService.getLastSyncTimestamp();
      const hasLocalChanges = checkForChanges();
      const localLastSync = syncStatus.lastSyncTime?.toISOString();
      
      console.log('📊 同步分析:', {
        hasLocalChanges,
        serverTimestamp,
        localLastSync
      });
      
      if (hasLocalChanges) {
        console.log('📱 检测到本地修改，推送到服务器');
        await syncToServer();
      } else if (serverTimestamp && localLastSync && serverTimestamp > localLastSync) {
        console.log('☁️ 服务器数据更新，拉取到本地');
        const response = await apiService.getProgress();
        if (response.success) {
          // 更新本地数据和时间戳
          const learnedWordsData = response.data.learnedWords as Record<string, boolean>;
          const masteredWordsData = response.data.masteredWords as Record<string, boolean>;
          for (const [wordId, isLearned] of Object.entries(learnedWordsData || {})) {
            const isMastered = Boolean(masteredWordsData?.[wordId]) || false;
            updateLocalWordProgress(wordId, isLearned, isMastered);
          }
          
          // 存储服务器返回的进度数据，格式与 checkForChanges 一致
          lastSyncDataRef.current = JSON.stringify({
            learnedWords: response.data.learnedWords || {},
            masteredWords: response.data.masteredWords || {},
          });
          setSyncStatus(prev => ({
            ...prev,
            lastSyncTime: new Date(),
            syncInProgress: false,
            hasUnsyncedChanges: false,
          }));
          
          isSyncingFromCompletion.current = true;
          setTimeout(() => {
            isSyncingFromCompletion.current = false;
          }, 2000);
          
          onSyncComplete?.(response.data);
        } else {
          setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
        }
      } else {
        console.log('✅ 无需同步：本地无修改，服务器无更新');
        setSyncStatus(prev => ({
          ...prev,
          syncInProgress: false,
        }));
      }
    } catch (error: any) {
      console.error('Smart sync error:', error);
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
      onSyncError?.(error.message || 'Smart sync failed');
    }
  }, [
    isAuthenticated,
    syncStatus.syncInProgress,
    syncStatus.isOnline,
    syncStatus.lastSyncTime,
    userId,
    checkForChanges,
    learnedWords,
    masteredWords,
    firstTimeSync,
    syncToServer,
    onSyncComplete,
    onSyncError,
    updateLocalWordProgress,
  ]);

  // 更新 smartSync 引用，避免 useEffect 依赖循环
  useEffect(() => {
    smartSyncRef.current = smartSync;
  }, [smartSync]);

  // 手动同步按钮
  const manualSync = useCallback(async () => {
    console.log('🔄 手动同步触发');
    await smartSync();
  }, [smartSync]);

  // 学习完成后的同步
  const syncAfterLearning = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('📱 未登录用户，学习完成仅更新本地');
      for (const [wordId, isLearned] of Object.entries(learnedWords)) {
        const isMastered = masteredWords[wordId];
        updateLocalWordProgress(wordId, isLearned, isMastered);
      }
      return;
    }

    if (syncStatus.isOnline && !syncStatus.syncInProgress) {
      console.log('📚 学习完成，触发同步');
      // 防抖延迟，避免频繁同步
      setTimeout(() => {
        smartSync();
      }, 30000); // 30秒后同步
    }
  }, [isAuthenticated, syncStatus.isOnline, syncStatus.syncInProgress, learnedWords, masteredWords, smartSync, updateLocalWordProgress]);

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = async () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      const serverReachable = await checkServerConnection();
      
      if (serverReachable && isAuthenticated && syncStatus.hasUnsyncedChanges && !syncStatus.syncInProgress) {
        console.log('🌐 网络恢复，同步未同步的更改');
        smartSyncRef.current?.();
      }
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    checkServerConnection();
    const connectionIntervalId = setInterval(checkServerConnection, 30000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectionIntervalId);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [syncStatus.hasUnsyncedChanges, isAuthenticated, checkServerConnection, syncStatus.isOnline, syncStatus.syncInProgress]);

  // 后台静默同步（间隔60秒）
  useEffect(() => {
    if (isAuthenticated && syncStatus.isOnline) {
      const syncIntervalId = setInterval(() => {
        if (!syncStatus.syncInProgress) {
          console.log('⏰ 后台静默同步触发');
          smartSyncRef.current?.();
        }
      }, 60000); // 60秒间隔

      return () => clearInterval(syncIntervalId);
    }
  }, [isAuthenticated, syncStatus.isOnline, syncStatus.syncInProgress]);

  // 应用启动时的同步
  useEffect(() => {
    if (isAuthenticated && syncStatus.isOnline) {
      console.log('🚀 应用启动，执行同步检查');
      smartSyncRef.current?.();
    }
  }, [isAuthenticated, syncStatus.isOnline]);

  // 紧急重置同步状态
  const resetSyncState = useCallback(() => {
    console.warn('🚨 紧急重置同步状态');
    setSyncStatus(prev => ({
      ...prev,
      syncInProgress: false,
    }));
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, []);

  return {
    syncStatus,
    syncToServer,
    syncFromServer: smartSync,
    checkForChanges,
    smartSync,
    manualSync,
    syncAfterLearning,
    resetSyncState,
  };
}