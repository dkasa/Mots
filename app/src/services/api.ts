import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { LoginRequest, RegisterRequest, AuthResponse, ProgressSyncData } from '../types/auth';

class ApiService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    const currentHost = window.location.hostname;
    const currentPort = window.location.port;
    const currentProtocol = window.location.protocol;
    
    // 优先使用环境变量配置的API URL
    if (import.meta.env.VITE_API_URL) {
      this.baseURL = import.meta.env.VITE_API_URL;
    } else {
      // 智能API URL推断：根据当前访问方式决定API地址
      if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        // 本地访问使用localhost
        this.baseURL = `${currentProtocol}//localhost:3001`;
      } else if (/^\d+\.\d+\.\d+\.\d+$/.test(currentHost)) {
        // IP地址访问，使用相同IP的后端地址，使用当前协议
        this.baseURL = `${currentProtocol}//${currentHost}:3001`;
      } else {
        // 域名访问，假设API在同一域名下的3001端口
        this.baseURL = `${currentProtocol}//${currentHost}:3001`;
      }
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // 添加CORS支持
    });

    // 请求拦截器 - 添加认证token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('mots-auth-token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器 - 处理认证错误
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Token过期或无效，清除本地存储
          localStorage.removeItem('mots-auth-token');
          localStorage.removeItem('mots-user');
          // 刷新页面让用户重新登录
          window.location.reload();
        }
        return Promise.reject(error);
      }
    );
  }

  // 认证相关API
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.post('/auth/login', credentials);
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await this.client.post('/auth/register', userData);
    return response.data;
  }

  async getUserProfile() {
    const response = await this.client.get('/auth/profile');
    return response.data;
  }

  // 进度同步相关API（增强版）
  async syncProgress(progressData: ProgressSyncData) {
    // 数据验证
    if (!progressData) {
      throw new Error('Progress data is required');
    }

    const summaryInfo = {
      learnedWordsCount: Object.keys(progressData.learnedWords || {}).length,
      masteredWordsCount: Object.keys(progressData.masteredWords || {}).length,
      currentGrade: progressData.currentGrade,
      currentViewMode: progressData.currentViewMode,
      currentFilter: progressData.currentFilter,
    };

    console.log('🚀 发送同步请求到服务器:', summaryInfo);
    
    try {
      // 添加请求超时和重试
      const response = await this.client.post('/progress/sync', progressData, {
        timeout: 30000, // 30秒超时
      });
      
      if (!response.data?.success) {
        throw new Error('Sync failed: Invalid response format');
      }

      const responseInfo = {
        success: response.data.success,
        learnedWordsCount: Object.keys(response.data.data?.learnedWords || {}).length,
        masteredWordsCount: Object.keys(response.data.data?.masteredWords || {}).length
      };

      console.log('✅ 同步响应成功:', responseInfo);
      
      return response.data;
    } catch (error: any) {
      const errorInfo = {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
        url: this.baseURL + '/progress/sync'
      };

      console.error('❌ 同步请求失败:', errorInfo);
      
      // 根据错误类型提供更有用的错误信息
      if (error.code === 'ECONNABORTED') {
        throw new Error('Sync timeout: Request took too long');
      } else if (error.response?.status === 401) {
        throw new Error('Authentication failed: Please login again');
      } else if (error.response?.status === 429) {
        throw new Error('Too many requests: Please try again later');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error: Please try again later');
      } else if (!navigator.onLine) {
        throw new Error('Network offline: Please check your connection');
      } else {
        throw error;
      }
    }
  }

  async getProgress() {
    try {
      const response = await this.client.get('/progress', {
        timeout: 15000, // 15秒超时
      });
      
      if (!response.data?.success) {
        throw new Error('Get progress failed: Invalid response format');
      }

      return response.data;
    } catch (error: any) {
      console.error('❌ 获取进度失败:', error.message);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Get progress timeout: Request took too long');
      } else if (error.response?.status === 401) {
        throw new Error('Authentication failed: Please login again');
      } else if (!navigator.onLine) {
        throw new Error('Network offline: Please check your connection');
      } else {
        throw error;
      }
    }
  }

  async getLastSyncTimestamp(): Promise<string | null> {
    try {
      console.log('获取服务器最后同步时间戳...');
      const response = await this.client.get('/progress/timestamp');
      console.log('服务器时间戳:', response.data.timestamp);
      return response.data.timestamp || null;
    } catch (error) {
      console.error('Failed to get last sync timestamp:', error);
      return null;
    }
  }

  // 健康检查（修复版）
  async healthCheck() {
    try {
      const response = await this.client.get('/health', {
        timeout: 10000, // 10秒超时
      });
      return response.data;
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ 健康检查失败:', error.message);
      }
      throw error;
    }
  }

  // 检查服务器连接状态
  async isServerOnline(): Promise<boolean> {
    try {
      // 先进行自定义网络检测，不依赖浏览器报告的离线状态
      const isNetworkAvailable = await this.customNetworkCheck();
      if (!isNetworkAvailable) {
        console.log('自定义网络检测失败，网络可能不可用');
        return false;
      }

      // 尝试健康检查，使用较短的超时时间
      try {
        const response = await this.client.get('/health', {
          timeout: 5000, // 5秒超时
        });
        return response.status === 200;
      } catch (healthError) {
        console.log('健康检查失败，尝试其他端点:', healthError);
        
        // 如果健康检查失败，尝试其他端点
        try {
          const authResponse = await this.client.get('/auth/status', {
            timeout: 5000,
          });
          return authResponse.status === 200;
        } catch (authError) {
          console.log('认证状态检查失败:', authError);
          
          // 最后尝试获取进度端点
          try {
            const progressResponse = await this.client.head('/progress', {
              timeout: 5000,
            });
            return progressResponse.status < 500; // 4xx也算服务器在线
          } catch (progressError) {
            console.log('进度端点检查失败:', progressError);
            return false;
          }
        }
      }
    } catch (error) {
      console.error('服务器连接检查异常:', error);
      return false;
    }
  }

  // 自定义网络检测方法，不依赖navigator.onLine
  private async customNetworkCheck(): Promise<boolean> {
    // 尝试连接应用服务器的多个端点
    const testEndpoints = [
      '/health',
      '/auth/status',
      '/progress'
    ];
    
    // 只要有一个端点连接成功，就认为网络正常
    for (const endpoint of testEndpoints) {
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(3000) // 3秒超时
        });
        
        if (response.ok || response.status < 500) {
          console.log('自定义网络检测成功:', `${this.baseURL}${endpoint}`);
          return true;
        }
      } catch (error) {
        console.log('自定义网络检测失败:', `${this.baseURL}${endpoint}`, error.message);
      }
    }
    
    console.log('所有自定义网络检测均失败');
    return false;
  }

  // 测试数据相关API
  async saveQuizData(quizData: { session: any; results: any[] }): Promise<any> {
    const response = await this.client.post('/quiz/save', quizData);
    return response.data;
  }

  async getWordMemories(wordIds: string[]): Promise<any> {
    const response = await this.client.post('/quiz/memories', { wordIds });
    return response.data;
  }

}

export const apiService = new ApiService();

// 暴露调试函数到全局，用于测试连接
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testApiConnection = async () => {
    try {
      const result = await apiService.isServerOnline();
      console.log('服务器连接测试结果:', result);
      return result;
    } catch (error) {
      console.error('服务器连接测试失败:', error);
      return false;
    }
  };
}