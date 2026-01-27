import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';

// 单词表文件哈希信息
export interface VocabularyHashes {
  hashes: Record<string, string>;
  timestamps: Record<string, string>;
  lastUpdated: string;
}

// 本地存储的哈希缓存
interface HashCache {
  hashes: Record<string, string>;
  lastChecked: string;
  version: string;
}

// 哈希检查配置
const HASH_CHECK_CONFIG = {
  // 检查间隔（毫秒）
  checkInterval: 5 * 60 * 1000, // 5分钟
  // 最小检查间隔（防止过于频繁）
  minCheckInterval: 30 * 1000, // 30秒
  // 缓存版本
  cacheVersion: '1.0.0'
};

// 获取本地缓存的哈希信息
const getCachedHashes = (): HashCache | null => {
  try {
    const cached = localStorage.getItem('vocabulary_hash_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      // 检查缓存版本，如果版本不匹配则清除缓存
      if (parsed.version === HASH_CHECK_CONFIG.cacheVersion) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to parse cached hashes:', error);
  }
  return null;
};

// 保存哈希信息到本地缓存
const saveCachedHashes = (hashes: Record<string, string>) => {
  try {
    const cache: HashCache = {
      hashes,
      lastChecked: new Date().toISOString(),
      version: HASH_CHECK_CONFIG.cacheVersion
    };
    localStorage.setItem('vocabulary_hash_cache', JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to save hash cache:', error);
  }
};

export function useVocabularyHashCheck() {
  const [hashes, setHashes] = useState<VocabularyHashes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // 使用ref存储最后一次检查时间，避免状态更新导致的重新渲染
  const lastCheckRef = useRef<number>(0);
  const lastHashesRef = useRef<Record<string, string> | null>(null);

  // 获取服务器上的哈希信息
  const fetchHashes = useCallback(async (): Promise<VocabularyHashes | null> => {
    try {
      const response = await apiService.getVocabularyHashes();
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to fetch vocabulary hashes:', error);
      throw error;
    }
  }, []);

  // 检查哈希变化
  const checkForChanges = useCallback(async (forceCheck = false): Promise<boolean> => {
    const now = Date.now();
    
    // 防止过于频繁的检查
    if (!forceCheck && now - lastCheckRef.current < HASH_CHECK_CONFIG.minCheckInterval) {
      return false;
    }

    setLoading(true);
    setError(null);
    
    try {
      const serverHashes = await fetchHashes();
      
      if (!serverHashes) {
        setLoading(false);
        return false;
      }

      setHashes(serverHashes);
      lastCheckRef.current = now;

      // 获取缓存的哈希信息
      const cachedHashes = getCachedHashes();
      
      // 第一次检查，没有缓存时保存当前哈希
      if (!cachedHashes) {
        saveCachedHashes(serverHashes.hashes);
        lastHashesRef.current = serverHashes.hashes;
        setLoading(false);
        return false;
      }

      // 比较哈希变化
      let changesDetected = false;
      for (const [filename, currentHash] of Object.entries(serverHashes.hashes)) {
        const cachedHash = cachedHashes.hashes[filename];
        
        // 忽略未找到的文件
        if (currentHash === 'not_found' || cachedHash === 'not_found') {
          continue;
        }
        
        // 比较哈希值
        if (currentHash !== cachedHash) {
          console.log(`📝 检测到文件变化: ${filename}`, {
            oldHash: cachedHash?.substring(0, 8),
            newHash: currentHash.substring(0, 8)
          });
          changesDetected = true;
          break; // 只要有一个文件变化就认为有更新
        }
      }

      // 更新缓存
      saveCachedHashes(serverHashes.hashes);
      lastHashesRef.current = serverHashes.hashes;
      
      setHasChanges(changesDetected);
      setLoading(false);
      return changesDetected;
      
    } catch (error) {
      console.error('Hash check failed:', error);
      setError(error instanceof Error ? error.message : 'Hash check failed');
      setLoading(false);
      return false;
    }
  }, [fetchHashes]);

  // 清除变更状态（在重新加载后调用）
  const clearChanges = useCallback(() => {
    setHasChanges(false);
    // 重新保存当前哈希作为新的基准
    if (hashes) {
      saveCachedHashes(hashes.hashes);
    }
  }, [hashes]);

  // 强制检查（忽略时间间隔）
  const forceCheck = useCallback(async (): Promise<boolean> => {
    return await checkForChanges(true);
  }, [checkForChanges]);

  // 初始化检查
  useEffect(() => {
    // 首次加载时检查一次
    checkForChanges();
    
    // 设置定时检查
    const intervalId = setInterval(() => {
      checkForChanges();
    }, HASH_CHECK_CONFIG.checkInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [checkForChanges]);

  // 监听页面可见性变化，当页面重新可见时检查
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面重新可见时检查哈希
        checkForChanges();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForChanges]);

  return {
    hashes,
    loading,
    error,
    hasChanges,
    checkForChanges,
    forceCheck,
    clearChanges
  };
}