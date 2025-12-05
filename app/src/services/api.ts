import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { LoginRequest, RegisterRequest, AuthResponse, ProgressSyncData } from '../types/auth';

class ApiService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    // 动态获取当前页面的host作为API地址
    const currentHost = window.location.hostname;
    this.baseURL = import.meta.env.VITE_API_URL || `http://${currentHost}:3001`;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
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

  // 进度同步相关API
  async syncProgress(progressData: ProgressSyncData) {
    console.log('🚀 发送同步请求到服务器:', {
      learnedWordsCount: Object.keys(progressData.learnedWords || {}).length,
      masteredWordsCount: Object.keys(progressData.masteredWords || {}).length,
      currentGrade: progressData.currentGrade,
      currentViewMode: progressData.currentViewMode,
      currentFilter: progressData.currentFilter,
      masteredWordsSample: Object.keys(progressData.masteredWords || {}).slice(0, 5)
    });
    
    const response = await this.client.post('/progress/sync', progressData);
    console.log('✅ 同步响应:', {
      success: response.data.success,
      learnedWordsCount: Object.keys(response.data.data?.learnedWords || {}).length,
      masteredWordsCount: Object.keys(response.data.data?.masteredWords || {}).length
    });
    
    return response.data;
  }

  async getProgress() {
    const response = await this.client.get('/progress');
    return response.data;
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

  // 健康检查
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // 检查服务器连接状态
  async isServerOnline(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const apiService = new ApiService();