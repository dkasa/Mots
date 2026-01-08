import { apiService } from './api';
import { QuizSession, QuizResult, WordMemory } from '../types/quiz';

class QuizService {
  private isOnline: boolean = true;

  constructor() {
    this.checkNetworkStatus();
  }

  // 检查网络状态
  async checkNetworkStatus() {
    // 检查是否已登录，如果没有登录则直接返回离线状态
    const token = localStorage.getItem('mots-auth-token');
    if (!token) {
      this.isOnline = false;
      return;
    }

    try {
      this.isOnline = await apiService.isServerOnline();
    } catch (error) {
      this.isOnline = false;
    }
  }

  // 保存测试数据到数据库
  async saveQuizData(session: QuizSession, results: QuizResult[]): Promise<boolean> {
    try {
      if (!this.isOnline) {
        console.log('离线状态，保存到本地存储');
        this.saveToLocalStorage(session, results);
        return true;
      }

      const sessionData = {
        mode: session.mode,
        grade: session.grade,
        questionCount: session.questions.length,
        correctCount: results.filter(r => r.isCorrect).length,
        totalTime: results.reduce((total, r) => total + r.timeSpent, 0),
        startTime: session.startTime,
        endTime: session.endTime || Date.now(),
        isCompleted: session.isCompleted
      };

      await apiService.saveQuizData({ session: sessionData, results });
      console.log('测试数据保存到数据库成功');
      return true;

    } catch (error) {
      console.error('保存测试数据失败，降级到本地存储:', error);
      this.saveToLocalStorage(session, results);
      return false;
    }
  }

  // 获取单词记忆数据
  async getWordMemories(wordIds: string[]): Promise<WordMemory[]> {
    // 检查是否已登录，如果没有登录则直接使用本地存储
    const token = localStorage.getItem('mots-auth-token');
    if (!token) {
      console.log('未登录状态，从本地存储获取单词记忆');
      return this.getWordMemoriesFromLocalStorage(wordIds);
    }

    try {
      if (!this.isOnline) {
        console.log('离线状态，从本地存储获取');
        return this.getWordMemoriesFromLocalStorage(wordIds);
      }

      const response = await apiService.getWordMemories(wordIds);
      return response.data || [];

    } catch (error) {
      console.error('获取单词记忆失败，从本地存储获取:', error);
      return this.getWordMemoriesFromLocalStorage(wordIds);
    }
  }

  // 同步离线数据到服务器
  async syncOfflineData(): Promise<void> {
    try {
      if (!this.isOnline) {
        return;
      }

      const offlineData = this.getOfflineData();
      if (offlineData.length > 0) {
        for (const data of offlineData) {
          await this.saveQuizData(data.session, data.results);
        }
        this.clearOfflineData();
        console.log('离线数据同步成功');
      }
    } catch (error) {
      console.error('同步离线数据失败:', error);
    }
  }

  // 本地存储相关方法
  private saveToLocalStorage(session: QuizSession, results: QuizResult[]): void {
    try {
      const key = `quiz-data-${Date.now()}`;
      localStorage.setItem(key, JSON.stringify({ session, results }));
      
      // 记录离线数据
      const offlineKeys = JSON.parse(localStorage.getItem('quiz-offline-keys') || '[]');
      offlineKeys.push(key);
      localStorage.setItem('quiz-offline-keys', JSON.stringify(offlineKeys));

      // 更新单词记忆数据
      this.updateWordMemories(results);
    } catch (error) {
      console.error('保存到本地存储失败:', error);
    }
  }

  private getWordMemoriesFromLocalStorage(wordIds: string[]): WordMemory[] {
    const memories: WordMemory[] = [];
    
    wordIds.forEach(wordId => {
      const memory = this.getFromLocalStorage(`word-memory-${wordId}`);
      if (memory) {
        memories.push({
          wordId,
          ...memory
        });
      }
    });
    
    return memories;
  }

  private getOfflineData(): { session: QuizSession; results: QuizResult[] }[] {
    try {
      const offlineKeys = JSON.parse(localStorage.getItem('quiz-offline-keys') || '[]');
      const data: { session: QuizSession; results: QuizResult[] }[] = [];

      offlineKeys.forEach((key: string) => {
        const item = this.getFromLocalStorage(key);
        if (item) {
          data.push(item);
        }
      });

      return data;
    } catch (error) {
      return [];
    }
  }

  private clearOfflineData(): void {
    try {
      const offlineKeys = JSON.parse(localStorage.getItem('quiz-offline-keys') || '[]');
      offlineKeys.forEach((key: string) => {
        localStorage.removeItem(key);
      });
      localStorage.removeItem('quiz-offline-keys');
    } catch (error) {
      console.error('清除离线数据失败:', error);
    }
  }

  private getFromLocalStorage(key: string): any {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  // 更新单词记忆数据
  private updateWordMemories(results: QuizResult[]): void {
    try {
      const now = Date.now();
      
      results.forEach(result => {
        const memoryKey = `word-memory-${result.wordId}`;
        const existingMemory = this.getFromLocalStorage(memoryKey);
        
        const newMemory = {
          lastAttempted: now,
          lastCorrect: result.isCorrect ? now : (existingMemory?.lastCorrect || 0),
          consecutiveCorrect: result.isCorrect 
            ? (existingMemory?.consecutiveCorrect || 0) + 1 
            : 0,
          totalAttempts: (existingMemory?.totalAttempts || 0) + 1,
          correctAttempts: result.isCorrect 
            ? (existingMemory?.correctAttempts || 0) + 1 
            : (existingMemory?.correctAttempts || 0)
        };
        
        localStorage.setItem(memoryKey, JSON.stringify(newMemory));
      });
      
      console.log('单词记忆数据已更新');
    } catch (error) {
      console.error('更新单词记忆数据失败:', error);
    }
  }
}

export const quizService = new QuizService();