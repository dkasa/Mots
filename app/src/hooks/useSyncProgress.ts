import { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressSyncData, SyncStatus } from '../types/auth';
import { apiService } from '../services/api';

interface WordProgress {
  is_learned: boolean;
  is_mastered: boolean;
  updated_at: string;
}



// 同步任务队列
interface SyncTask {
  id: string;
  type: 'sync' | 'upload' | 'download';
  priority: number;
  timestamp: number;
  data?: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

interface UseSyncProgressOptions {
  learnedWords: Record<string, boolean>;
  masteredWords: Record<string, boolean>;
  currentGrade: number;
  currentViewMode: 'learn' | 'list' | 'search' | 'quiz';
  currentFilter: 'all' | 'mastered' | 'not-mastered';
  isAuthenticated: boolean;
  userId?: number; // 当前用户ID，用于切换账号
  onSyncComplete?: (data: ProgressSyncData) => void;
  onSyncError?: (error: string) => void;
  updateFromCloudData?: (data: ProgressSyncData) => void; // 添加更新React状态的回调
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
  updateFromCloudData,
}: UseSyncProgressOptions) {
  // 统一的同步状态管理
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    lastSyncTime: null,
    syncInProgress: false,
    hasUnsyncedChanges: false,
  });

  // 错误状态单独管理
  const [syncError, setSyncError] = useState<string | null>(null);

  // 同步队列和并发控制
  const syncQueue = useRef<SyncTask[]>([]);
  const isProcessingQueue = useRef<boolean>(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncDataRef = useRef<string>('');
  const lastUserIdRef = useRef<number | null>(null);
  const smartSyncRef = useRef<(() => Promise<void>) | null>(null);
  const lastSyncTriggerTimeRef = useRef<number>(0);
  
  // 重试机制配置
  const retryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  };

 // 重试机制实现
  const retryWithBackoff = useCallback(async <T>(
    operation: () => Promise<T>,
    retries: number = 0
  ): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (retries >= retryConfig.maxRetries) {
        throw error;
      }

      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.backoffFactor, retries),
        retryConfig.maxDelay
      );
      
      console.log(`🔄 同步失败，${delay}ms后重试 (${retries + 1}/${retryConfig.maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries + 1);
    }
  }, [retryConfig.maxRetries, retryConfig.baseDelay, retryConfig.maxDelay, retryConfig.backoffFactor]);

  // 函数引用，避免循环依赖
  const functionRefs = useRef<{
    processSyncQueue?: () => Promise<void>;
    performSync?: (data?: ProgressSyncData) => Promise<ProgressSyncData>;
    performUpload?: (data?: ProgressSyncData) => Promise<ProgressSyncData>;
    performDownload?: () => Promise<ProgressSyncData>;
  }>({});

  // 同步队列管理
  const addToSyncQueue = useCallback(<T>(task: Omit<SyncTask, 'id' | 'timestamp' | 'resolve' | 'reject'>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const syncTask: SyncTask = {
        ...task,
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      // 按优先级插入队列
      const insertIndex = syncQueue.current.findIndex(t => t.priority < syncTask.priority);
      if (insertIndex === -1) {
        syncQueue.current.push(syncTask);
      } else {
        syncQueue.current.splice(insertIndex, 0, syncTask);
      }

      // 如果没有在处理队列，开始处理
      if (!isProcessingQueue.current) {
        functionRefs.current.processSyncQueue?.();
      }
    });
  }, []);

  // 处理同步队列（增强版）
  const processSyncQueue = useCallback(async () => {
    if (isProcessingQueue.current || syncQueue.current.length === 0) {
      return;
    }

    console.log(`🔄 开始处理同步队列，队列长度: ${syncQueue.current.length}`);
    isProcessingQueue.current = true;
    setSyncStatus(prev => ({ ...prev, syncInProgress: true }));

    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;

    while (syncQueue.current.length > 0) {
      const task = syncQueue.current.shift();
      if (!task) break;

      // 检查任务是否过期（超过5分钟）
      if (Date.now() - task.timestamp > 300000) {
        console.warn(`⚠️ 同步任务已过期，跳过: ${task.id}`);
        task.reject(new Error('Task expired'));
        continue;
      }

      try {
        console.log(`📤 执行同步任务: ${task.type} (ID: ${task.id.substring(0, 20)}...)`);
        
        // 执行任务
        let result;
        console.log(`🎯 开始执行 ${task.type} 任务...`);
        switch (task.type) {
          case 'sync':
            console.log('📤 执行同步任务，会发送本地数据到服务器');
            result = await functionRefs.current.performSync?.(task.data);
            break;
          case 'upload':
            console.log('📤 执行上传任务，会发送本地数据到服务器');
            result = await functionRefs.current.performUpload?.(task.data);
            break;
          case 'download':
            console.log('📥 执行下载任务，会从服务器拉取数据');
            result = await functionRefs.current.performDownload?.();
            break;
          default:
            throw new Error(`Unknown task type: ${(task as any).type}`);
        }

        console.log(`✅ 同步任务成功: ${task.type} (ID: ${task.id.substring(0, 20)}...)`);
        task.resolve(result);
        setSyncError(null); // 清除错误状态
        setSyncStatus(prev => ({ 
          ...prev, 
          lastSyncTime: new Date(),
          hasUnsyncedChanges: false 
        }));
        
        // 重置失败计数
        consecutiveFailures = 0;
      } catch (error) {
        console.error(`❌ 同步任务失败:`, error);
        consecutiveFailures++;
        
        // 如果连续失败次数过多，清空队列防止无限重试
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.error(`🚨 连续${maxConsecutiveFailures}次同步失败，清空队列防止无限重试`);
          syncQueue.current = [];
          setSyncError('连续同步失败，请检查网络连接后重试');
          break;
        }
        
        task.reject(error);
        setSyncError(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    isProcessingQueue.current = false;
    setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
    console.log('🏁 同步队列处理完成');
  }, []);

  // 检查服务器连接状态
  const checkServerConnection = useCallback(async (): Promise<boolean> => {
    try {
      // 使用API服务检查服务器状态
      const isServerReachable = await apiService.isServerOnline();
      return isServerReachable;
    } catch (error) {
      return false;
    }
  }, []);

  // 获取本地同步基准时间戳
  const getLastSyncTimestamp = useCallback((): string | null => {
    const userKey = userId ? `last_sync_timestamp_${userId}` : `last_sync_timestamp`;
    return localStorage.getItem(userKey);
  }, [userId]);

  // 设置本地同步基准时间戳
  const setLastSyncTimestamp = useCallback((timestamp: string) => {
    const userKey = userId ? `last_sync_timestamp_${userId}` : `last_sync_timestamp`;
    localStorage.setItem(userKey, timestamp);
  }, [userId]);

  // 获取本地单词进度（包含时间戳）
  const getLocalWordProgress = useCallback((wordId: string): WordProgress => {
    // 使用用户ID隔离存储
    const userKey = userId ? `word_progress_${userId}_${wordId}` : `word_progress_${wordId}`;
    const stored = localStorage.getItem(userKey);
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
  }, [learnedWords, masteredWords, userId]);

  // 更新本地单词进度（优化版）
  const updateLocalWordProgress = useCallback((wordId: string, isLearned: boolean, isMastered: boolean) => {
    const userKey = userId ? `word_progress_${userId}_${wordId}` : `word_progress_${wordId}`;
    const existing = localStorage.getItem(userKey);
    
    let needUpdate = false;
    const updatedAt = new Date().toISOString();
    
    if (existing) {
      try {
        const existingProgress = JSON.parse(existing) as WordProgress;
        needUpdate = existingProgress.is_learned !== isLearned || existingProgress.is_mastered !== isMastered;
      } catch {
        needUpdate = true;
      }
    } else {
      needUpdate = true;
    }
    
    if (needUpdate) {
      const progress: WordProgress = {
        is_learned: isLearned,
        is_mastered: isMastered,
        updated_at: updatedAt
      };
      localStorage.setItem(userKey, JSON.stringify(progress));
    }
  }, [userId]);

  // 简化的同步操作：服务端权威模式
  const performSync = useCallback(async (data?: ProgressSyncData) => {
    if (!isAuthenticated || !syncStatus.isOnline) {
      throw new Error('Cannot sync: not authenticated or offline');
    }

    // 使用当前时间作为客户端数据更新时间戳
    const currentTimestamp = new Date().toISOString();
    
    const syncData: ProgressSyncData = data || {
      learnedWords,
      masteredWords,
      currentGrade,
      currentViewMode,
      currentFilter,
      clientTimestamp: currentTimestamp,
    };

    // 使用重试机制
    const response = await retryWithBackoff(() => apiService.syncProgress(syncData));
    
    if (response.success) {
      // 智能同步：比较服务器响应和客户端发送的数据
      const serverData = response.data;
      const clientData = syncData;
      
      // 找出被服务器拒绝的更新（客户端发送为true，但服务器返回为false）
      const rejectedLearned = new Set<string>();
      const rejectedMastered = new Set<string>();
      
      for (const [wordId, isLearned] of Object.entries(clientData.learnedWords || {})) {
        if (isLearned && !serverData.learnedWords?.[wordId]) {
          rejectedLearned.add(wordId);
        }
      }
      
      for (const [wordId, isMastered] of Object.entries(clientData.masteredWords || {})) {
        if (isMastered && !serverData.masteredWords?.[wordId]) {
          rejectedMastered.add(wordId);
        }
      }
      
      // 只更新被拒绝的单词为服务器状态
      for (const wordId of rejectedLearned) {
        const isMastered = serverData.masteredWords?.[wordId] || false;
        updateLocalWordProgress(wordId, false, isMastered);
      }
      
      for (const wordId of rejectedMastered) {
        const isLearned = serverData.learnedWords?.[wordId] || false;
        updateLocalWordProgress(wordId, isLearned, false);
      }
      
      // 记录同步基准
      lastSyncDataRef.current = JSON.stringify({
        learnedWords: serverData.learnedWords,
        masteredWords: serverData.masteredWords,
      });
      
      // 更新本地同步时间戳为当前时间
      const currentTimestamp = new Date().toISOString();
      setLastSyncTimestamp(currentTimestamp);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        hasUnsyncedChanges: false,
      }));

      setSyncError(null);
      console.log('同步完成，更新同步时间戳:', currentTimestamp);
      
      // 调用更新React状态的回调（只有在有被拒绝的更新时才需要）
      if (updateFromCloudData && (rejectedLearned.size > 0 || rejectedMastered.size > 0)) {
        console.log('同步完成，有数据被拒绝，调用updateFromCloudData更新React状态...');
        updateFromCloudData(serverData);
      }
      
      // 更新同步基准数据，避免后续误判为有更改
      lastSyncDataRef.current = JSON.stringify({
        learnedWords: serverData.learnedWords,
        masteredWords: serverData.masteredWords,
      });
      console.log('✅ 更新同步基准数据，避免误判');
      
      return serverData;
    } else {
      throw new Error('Sync failed: invalid response');
    }
  }, [isAuthenticated, syncStatus.isOnline, learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, updateLocalWordProgress, retryWithBackoff, setLastSyncTimestamp, updateFromCloudData]);

  // 仅上传本地数据到服务端
  const performUpload = useCallback(async (data?: ProgressSyncData) => {
    if (!isAuthenticated || !syncStatus.isOnline) {
      throw new Error('Cannot upload: not authenticated or offline');
    }

    // 使用当前时间作为客户端数据更新时间戳
    const currentTimestamp = new Date().toISOString();
    
    const uploadData: ProgressSyncData = data || {
      learnedWords,
      masteredWords,
      currentGrade,
      currentViewMode,
      currentFilter,
      clientTimestamp: currentTimestamp,
    };

    return await retryWithBackoff(() => apiService.syncProgress(uploadData));
  }, [isAuthenticated, syncStatus.isOnline, learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, retryWithBackoff]);

  // 仅从服务端下载数据
  const performDownload = useCallback(async () => {
    console.log('开始执行数据下载...');
    if (!isAuthenticated || !syncStatus.isOnline) {
      console.log('下载失败：未认证或离线状态', { isAuthenticated, isOnline: syncStatus.isOnline });
      throw new Error('Cannot download: not authenticated or offline');
    }

    console.log('正在从服务器获取进度数据...');
    const response = await retryWithBackoff(() => apiService.getProgress());
    console.log('服务器响应:', response);
    
    if (response.success && response.data) {
      const serverData = response.data;
      console.log('服务器返回数据统计:', {
        learnedWordsCount: Object.keys(serverData.learnedWords || {}).length,
        masteredWordsCount: Object.keys(serverData.masteredWords || {}).length
      });
      
      // 更新本地状态
      console.log('开始更新本地状态...');
      let updateCount = 0;
      for (const [wordId, isLearned] of Object.entries(serverData.learnedWords || {})) {
        const isMastered = serverData.masteredWords?.[wordId] || false;
        updateLocalWordProgress(wordId, Boolean(isLearned), isMastered);
        updateCount++;
      }
      console.log('共更新了', updateCount, '个单词的状态');
      
      // 记录同步基准
      lastSyncDataRef.current = JSON.stringify({
        learnedWords: serverData.learnedWords,
        masteredWords: serverData.masteredWords,
      });
      
      // 更新本地同步时间戳为当前时间
      const currentTimestamp = new Date().toISOString();
      setLastSyncTimestamp(currentTimestamp);
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        hasUnsyncedChanges: false,
      }));

      setSyncError(null);
      console.log('数据下载和本地更新完成，更新同步时间戳:', currentTimestamp);
      
      // 调用更新React状态的回调
      if (updateFromCloudData) {
        console.log('调用updateFromCloudData更新React状态...');
        updateFromCloudData(serverData);
      }
      
      // 更新同步基准数据，避免后续误判为有更改
      lastSyncDataRef.current = JSON.stringify({
        learnedWords: serverData.learnedWords,
        masteredWords: serverData.masteredWords,
      });
      console.log('✅ 更新同步基准数据，避免误判');
      
      return serverData;
    } else {
      console.error('下载失败：无效响应', response);
      throw new Error('Download failed: invalid response');
    }
  }, [isAuthenticated, syncStatus.isOnline, updateLocalWordProgress, retryWithBackoff, setLastSyncTimestamp, updateFromCloudData]);

  // 简化的变更检测 - 避免频繁初始化
  const checkForChanges = useCallback((): boolean => {
    const currentProgress = {
      learnedWords,
      masteredWords,
    };

    const currentData = JSON.stringify(currentProgress);
    let lastSyncData = '';

    // 如果基准数据为空，先初始化为当前数据
    if (!lastSyncDataRef.current) {
      console.log('初始化同步基准数据...');
      lastSyncDataRef.current = currentData;
      setSyncStatus(prev => ({ ...prev, hasUnsyncedChanges: false }));
      return false;
    }

    try {
      const parsed = JSON.parse(lastSyncDataRef.current);
      lastSyncData = JSON.stringify({
        learnedWords: parsed.learnedWords || {},
        masteredWords: parsed.masteredWords || {},
      });
    } catch {
      // 解析失败，保持原有基准数据，不重新初始化
      console.log('基准数据解析失败，保持原有数据');
      lastSyncData = lastSyncDataRef.current;
    }

    const hasChanges = currentData !== lastSyncData;
    setSyncStatus(prev => ({ ...prev, hasUnsyncedChanges: hasChanges }));
    
    return hasChanges;
  }, [learnedWords, masteredWords]);

  // 简化的同步到服务器函数
  const syncToServer = useCallback(async (): Promise<void> => {
    console.log('syncToServer: 检查认证和网络状态...');
    console.log('syncToServer: isAuthenticated:', isAuthenticated);
    console.log('syncToServer: syncStatus.isOnline:', syncStatus.isOnline);
    
    if (!isAuthenticated || !syncStatus.isOnline) {
      if (!isAuthenticated) {
        console.log('syncToServer: 未认证，抛出错误');
        throw new Error('Not authenticated');
      }
      if (!syncStatus.isOnline) {
        console.log('syncToServer: 网络离线，抛出错误');
        throw new Error('Offline');
      }
      return;
    }

    try {
      console.log('syncToServer: 开始同步到服务器...');
      const currentTimestamp = new Date().toISOString();
      
      await addToSyncQueue({
        type: 'sync',
        priority: 1,
        data: {
          learnedWords,
          masteredWords,
          currentGrade,
          currentViewMode,
          currentFilter,
          clientTimestamp: currentTimestamp,
        }
      });
      console.log('syncToServer: 同步请求已添加到队列');
    } catch (error) {
      console.error('Sync to server failed:', error);
      onSyncError?.(error instanceof Error ? error.message : 'Sync failed');
    }
  }, [isAuthenticated, syncStatus.isOnline, learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, addToSyncQueue, onSyncError]);

  // 简化的首次同步：服务端权威模式
  const firstTimeSync = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !syncStatus.isOnline) {
      return;
    }

    try {
      // 检查云端是否有数据
      const hasLocalData = Object.keys(learnedWords).length > 0 || Object.keys(masteredWords).length > 0;
      
      // 如果有本地数据，先上传，然后下载服务端权威数据
      if (hasLocalData) {
        const currentTimestamp = new Date().toISOString();
        
        await addToSyncQueue({
          type: 'upload',
          priority: 2,
          data: {
            learnedWords,
            masteredWords,
            currentGrade,
            currentViewMode,
            currentFilter,
            clientTimestamp: currentTimestamp,
          }
        });
      }
      
      // 总是下载服务端数据作为权威
      await addToSyncQueue({
        type: 'download',
        priority: 2,
      });
    } catch (error) {
      console.error('First time sync failed:', error);
      onSyncError?.(error instanceof Error ? error.message : 'First sync failed');
    }
  }, [isAuthenticated, syncStatus.isOnline, learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, addToSyncQueue, onSyncError]);

  // 清理用户数据
  const clearUserData = useCallback((oldUserId: number) => {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('word_progress_')) {
        const oldUserKey = `word_progress_${oldUserId}_`;
        if (key.startsWith(oldUserKey)) {
          localStorage.removeItem(key);
        }
      }
    }
    
    // 重置状态
    lastSyncDataRef.current = '';
    setSyncStatus(prev => ({
      ...prev,
      lastSyncTime: null,
      hasUnsyncedChanges: false,
    }));
  }, []);

  // 简化的智能同步
  const smartSync = useCallback(async (forceFromServer: boolean = false): Promise<void> => {
    const now = Date.now();
    
    console.log('🔍 smartSync 被调用，参数:', { 
      forceFromServer, 
      isAuthenticated, 
      syncInProgress: syncStatus.syncInProgress, 
      isProcessing: isProcessingQueue.current,
      lastSyncTrigger: lastSyncTriggerTimeRef.current,
      timeSinceLastSync: now - lastSyncTriggerTimeRef.current
    });
    
    // 防止过于频繁的同步调用 - 强制同步时也检查，但允许重置状态
    if (syncStatus.syncInProgress || isProcessingQueue.current) {
      if (forceFromServer) {
        console.log('⚠️ 强制同步：检测到同步进行中，重置状态并继续');
        // 强制同步时重置状态
        setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
        syncQueue.current = [];
        isProcessingQueue.current = false;
      } else {
        console.log('❌ 同步正在进行中，跳过本次同步请求');
        return;
      }
    }

    // 非强制同步时，检查最小同步间隔 - 减少到1秒，只防止极端情况
    if (!forceFromServer && (now - lastSyncTriggerTimeRef.current) < 1000) {
      console.log('❌ 同步间隔太短，跳过本次同步请求');
      return;
    }

    if (!isAuthenticated) {
      console.log('用户未认证，只更新本地存储');
      // 未登录用户只更新本地存储
      for (const [wordId, isLearned] of Object.entries(learnedWords)) {
        const isMastered = masteredWords[wordId];
        updateLocalWordProgress(wordId, isLearned, isMastered);
      }
      return;
    }

    // 对于强制同步，先上传本地数据，然后下载服务器数据
    if (forceFromServer) {
      console.log('🚀 强制同步：先上传本地数据，再下载服务端数据...');
      
      // 先上传本地数据（如果有更改）
      const hasChanges = checkForChanges();
      if (hasChanges) {
        console.log('📤 检测到本地更改，先上传数据');
        await addToSyncQueue({
          type: 'sync',
          priority: 3,
        });
      }
      
      // 然后下载服务器数据
      console.log('📥 下载服务器数据');
      await addToSyncQueue({
        type: 'download',
        priority: 3,
      });
      
      console.log('🔄 强制同步任务已添加到队列，等待处理完成...');
      
      // 等待队列处理完成
      await processSyncQueue();
      console.log('✅ 强制同步队列处理完成');
      return; // 重要：强制同步后直接返回，不再执行后续逻辑
    }

    // 检查网络连接状态
    if (!syncStatus.isOnline) {
      console.log('网络离线，只更新本地数据');
      // 网络断线时只更新本地
      for (const [wordId, isLearned] of Object.entries(learnedWords)) {
        const isMastered = masteredWords[wordId];
        updateLocalWordProgress(wordId, isLearned, isMastered);
      }
      setSyncStatus(prev => ({ ...prev, hasUnsyncedChanges: true }));
      return;
    }

    // 记录同步触发时间
    lastSyncTriggerTimeRef.current = now;

    // 处理账号切换
    if (lastUserIdRef.current !== null && userId !== undefined && lastUserIdRef.current !== userId) {
      console.log('检测到账号切换，清理旧用户数据并下载新用户数据');
      // 清理旧用户数据
      clearUserData(lastUserIdRef.current);
      lastUserIdRef.current = userId;
      
      // 强制下载新用户数据
      await addToSyncQueue({
        type: 'download',
        priority: 3,
      });
      await processSyncQueue();
      return;
    }

    if (userId !== undefined) {
      lastUserIdRef.current = userId;
    }

    // 检查本地更改并同步 - 在用户主动触发（页面切换、登录、手动同步）时执行
    // 强制同步时跳过变更检查，总是执行同步
    let hasChanges = false;
    if (forceFromServer) {
      console.log('🚀 强制同步：跳过变更检查，直接执行同步');
      hasChanges = true;
    } else {
      hasChanges = checkForChanges();
      console.log('检查本地是否有更改:', hasChanges);
    }
    
    if (hasChanges) {
      await addToSyncQueue({
        type: forceFromServer ? 'download' : 'sync',
        priority: 1,
      });
      await processSyncQueue();
    } else {
      console.log('没有本地更改，跳过同步');
    }
  }, [
    isAuthenticated,
    syncStatus.syncInProgress,
    syncStatus.isOnline,
    userId,
    learnedWords,
    masteredWords,
    updateLocalWordProgress,
    addToSyncQueue,
    isProcessingQueue,
    clearUserData,
    processSyncQueue,
    checkForChanges,
  ]);

  // 设置函数引用，避免循环依赖
  useEffect(() => {
    functionRefs.current.processSyncQueue = processSyncQueue;
    functionRefs.current.performSync = performSync;
    functionRefs.current.performUpload = performUpload;
    functionRefs.current.performDownload = performDownload;
  }, [processSyncQueue, performSync, performUpload, performDownload]);

  // 更新 smartSync 引用，避免 useEffect 依赖循环
  useEffect(() => {
    smartSyncRef.current = smartSync;
  }, [smartSync]);

  // 简化的手动同步
  const manualSync = useCallback(async (): Promise<void> => {
    console.log('🔄 manualSync 被调用', { syncInProgress: syncStatus.syncInProgress });
    
    if (syncStatus.syncInProgress) {
      // 如果同步卡住，重置状态
      console.warn('⚠️ 检测到同步卡住，重置状态');
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
      setSyncError(null);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      syncQueue.current = [];
      isProcessingQueue.current = false;
    }
    
    // 强制执行同步，跳过频率检查
    console.log('🔄 手动同步开始执行smartSync');
    await smartSync();
    console.log('🔄 手动同步smartSync完成');
  }, [smartSync, syncStatus.syncInProgress]);

  // 简化的强制同步
  const forceSync = useCallback(async (): Promise<void> => {
    console.log('🔥 forceSync 被调用，强制从服务器同步');
    try {
      await smartSync(true);
      console.log('✅ forceSync 完成');
    } catch (error) {
      console.error('❌ forceSync 失败:', error);
      throw error;
    }
  }, [smartSync]);

  // 简化的学习完成后同步 - 移除自动同步逻辑
  const syncAfterLearning = useCallback(async (): Promise<void> => {
    console.log('🎯 syncAfterLearning 被调用');
    
    if (!isAuthenticated) {
      console.log('用户未认证，只更新本地存储');
      // 未登录用户只更新本地
      for (const [wordId, isLearned] of Object.entries(learnedWords)) {
        const isMastered = masteredWords[wordId];
        updateLocalWordProgress(wordId, isLearned, isMastered);
      }
      return;
    }

    // 移除自动同步逻辑 - 只在切换页面或手动同步时触发
    console.log('🚫 移除学习完成后的自动同步，等待页面切换或手动同步');
    console.log('跳过同步，原因:', {
      isOnline: syncStatus.isOnline,
      syncInProgress: syncStatus.syncInProgress
    });
  }, [isAuthenticated, syncStatus.isOnline, syncStatus.syncInProgress, learnedWords, masteredWords, updateLocalWordProgress]);

  // 添加一个全局标志，防止多个组件实例重复初始化网络检查
  const isNetworkCheckInitialized = useRef(false);

  // 监听网络状态变化
  useEffect(() => {
    // 防止多个组件实例重复初始化网络检查
    if (isNetworkCheckInitialized.current) {
      return;
    }
    isNetworkCheckInitialized.current = true;

    const handleOnline = async () => {
      console.log('浏览器报告网络已连接');
      // 延迟2秒后再检查服务器状态，确保网络稳定
      setTimeout(async () => {
        const serverReachable = await checkServerConnection();
        console.log('服务器可达性检查结果:', serverReachable);
        setSyncStatus(prev => ({ ...prev, isOnline: serverReachable }));
        
        // 移除网络恢复时的自动同步
        console.log('🚫 移除网络恢复时的自动同步，等待页面切换或手动同步');
        // if (serverReachable && isAuthenticated && syncStatus.hasUnsyncedChanges && !syncStatus.syncInProgress) {
        //   // 延迟5秒后同步，避免网络刚恢复时不稳定
        //   setTimeout(() => {
        //     smartSyncRef.current?.();
        //   }, 5000);
        // }
      }, 2000);
    };

    const handleOffline = () => {
      console.log('浏览器报告网络已断开');
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    // 初始化检查
    console.log('初始化网络状态检查...');
    checkServerConnection().then(isOnline => {
      console.log('初始化服务器可达性检查结果:', isOnline);
      setSyncStatus(prev => ({ ...prev, isOnline }));
    });
    
    // 定期检查服务器状态
    const connectionIntervalId = setInterval(async () => {
      const isOnline = await checkServerConnection();
      setSyncStatus(prev => ({ ...prev, isOnline }));
    }, 30000); // 30秒间隔

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectionIntervalId);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      lastSyncTriggerTimeRef.current = 0;
      // 组件卸载时重置标志，允许重新初始化
      isNetworkCheckInitialized.current = false;
    };
  }, [isAuthenticated, syncStatus.hasUnsyncedChanges, syncStatus.syncInProgress, checkServerConnection]);

  const resetSyncState = useCallback(() => {
    setSyncStatus(prev => ({ ...prev, syncInProgress: false }));
    setSyncError(null);
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    // 清空同步队列
    syncQueue.current = [];
    isProcessingQueue.current = false;
  }, []);

  return {
    syncStatus,
    syncError,
    syncToServer,
    syncFromServer: smartSync,
    checkForChanges,
    smartSync,
    manualSync,
    forceSync,
    syncAfterLearning,
    resetSyncState,
  };
}