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
    const response = await this.client.post('/api/auth/login', credentials);
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await this.client.post('/api/auth/register', userData);
    return response.data;
  }

  async getUserProfile() {
    const response = await this.client.get('/api/auth/profile');
    return response.data;
  }

  // 进度同步相关API
  async syncProgress(progressData: ProgressSyncData) {
    const response = await this.client.post('/api/progress/sync', progressData);
    return response.data;
  }

  async getProgress() {
    const response = await this.client.get('/api/progress');
    return response.data;
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