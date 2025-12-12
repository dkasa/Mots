import { useState, useEffect, useCallback } from 'react';
import { User, AuthState, LoginRequest, RegisterRequest } from '../types/auth';
import { apiService } from '../services/api';

const STORAGE_TOKEN_KEY = 'mots-auth-token';
const STORAGE_USER_KEY = 'mots-user';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // 初始化认证状态
  useEffect(() => {
    const initAuth = () => {
      const token = localStorage.getItem(STORAGE_TOKEN_KEY);
      const userStr = localStorage.getItem(STORAGE_USER_KEY);

      console.log('Initializing auth:', { hasToken: !!token, hasUser: !!userStr });

      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          console.log('Restored auth state:', { user, token: token.substring(0, 20) + '...' });
          setAuthState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to parse user data:', error);
          clearAuthData();
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } else {
        console.log('No auth data found, user not logged in');
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearAuthData = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  }, []);

  const setAuthData = useCallback((token: string, user: User) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    console.log('Auth data set:', { user, token: token.substring(0, 20) + '...' });
    setAuthState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await apiService.login(credentials);
      
      if (response.success) {
        setAuthData(response.token, response.user);
        return { success: true, forceSyncFromServer: true };
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      const message = error.response?.data?.error || error.message || 'Login failed';
      return { success: false, error: message };
    }
  }, [setAuthData]);

  const register = useCallback(async (userData: RegisterRequest) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await apiService.register(userData);
      
      if (response.success) {
        setAuthData(response.token, response.user);
        return { success: true };
      } else {
        throw new Error('Registration failed');
      }
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      const message = error.response?.data?.error || error.message || 'Registration failed';
      return { success: false, error: message };
    }
  }, [setAuthData]);

  const logout = useCallback(async (syncBeforeLogout: boolean = true) => {
    console.log('🚪 开始退出登录流程', { syncBeforeLogout });
    
    try {
      // 如果有同步回调，先同步一次到服务器，并等待完成
      if (syncBeforeLogout && typeof window !== 'undefined' && (window as any).__MOTS_APP__?.syncBeforeLogout) {
        console.log('🔄 退出登录前开始同步...');
        await (window as any).__MOTS_APP__.syncBeforeLogout();
        console.log('✅ 退出前同步完成，继续退出登录');
      } else {
        console.log('🔄 跳过退出前同步', { 
          syncBeforeLogout, 
          hasWindow: typeof window !== 'undefined',
          hasSyncFunction: !!(window as any).__MOTS_APP__?.syncBeforeLogout
        });
      }
    } catch (error) {
      console.error('❌ 退出前同步失败，但仍继续退出登录:', error);
      // 同步失败不应该阻止用户退出，继续执行退出流程
    }
    
    // 清除认证数据
    clearAuthData();
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    
    console.log('✅ 退出登录完成');
  }, [clearAuthData]);

  const refreshToken = useCallback(async () => {
    try {
      const response = await apiService.getUserProfile();
      if (response.success && authState.user) {
        const updatedUser = response.user;
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
        setAuthState(prev => ({ ...prev, user: updatedUser }));
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      logout();
    }
  }, [authState.user, logout]);

  return {
    ...authState,
    login,
    register,
    logout,
    refreshToken,
  };
}