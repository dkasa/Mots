import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export function AuthModal({ isOpen, onClose, message }: AuthModalProps) {
  const { login, register, isLoading } = useAuth();
  const [error, setError] = useState<string>('');

  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });

  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = await login(loginForm);
    if (result.success) {
      onClose();
      setLoginForm({ username: '', password: '' });
      // 刷新页面以更新状态
      window.location.reload();
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (registerForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const result = await register({
      username: registerForm.username,
      email: registerForm.email,
      password: registerForm.password,
    });

    if (result.success) {
      onClose();
      setRegisterForm({ username: '', email: '', password: '', confirmPassword: '' });
      // 刷新页面以更新状态
      window.location.reload();
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[425px] bg-white/85 backdrop-blur-sm font-sans"
        style={{
          backgroundImage: `url(/icons/logo01.png)`,
          backgroundSize: '250px 250px',
          backgroundRepeat: 'repeat',
          backgroundPosition: '0 0',
          backgroundBlendMode: 'soft-light',
          backgroundColor: 'rgba(255, 255, 255, 0.85)'
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[#1F4F3D] text-xl font-medium">账户登录 / 注册</DialogTitle>
        </DialogHeader>
        
        {message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800 text-sm font-medium">{message}</p>
          </div>
        )}
        
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username" className="text-[#244E40] font-medium">用户名</Label>
                <Input
                  id="login-username"
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                  required
                  disabled={isLoading}
                  className="text-[#244E40] placeholder:text-[#6F8F83] bg-white/85"
                  placeholder="请输入用户名"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-[#244E40] font-medium">密码</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                  disabled={isLoading}
                  className="text-[#244E40] placeholder:text-[#6F8F83] bg-white/85"
                  placeholder="请输入密码"
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-[#2E8B6F] hover:bg-[#267A5F] text-white font-medium" 
                disabled={isLoading}
              >
                {isLoading ? '登录中...' : '登录'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-username" className="text-[#244E40] font-medium">用户名</Label>
                <Input
                  id="register-username"
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                  required
                  disabled={isLoading}
                  minLength={3}
                  maxLength={20}
                  className="text-[#244E40] placeholder:text-[#6F8F83] bg-white/85"
                  placeholder="请输入用户名（3-20位）"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-email" className="text-[#244E40] font-medium">邮箱</Label>
                <Input
                  id="register-email"
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                  disabled={isLoading}
                  className="text-[#244E40] placeholder:text-[#6F8F83] bg-white/85"
                  placeholder="请输入邮箱"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-password" className="text-[#244E40] font-medium">密码</Label>
                <Input
                  id="register-password"
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                  disabled={isLoading}
                  minLength={6}
                  className="text-[#244E40] placeholder:text-[#6F8F83] bg-white/85"
                  placeholder="请输入密码（至少6位）"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-confirm-password" className="text-[#244E40] font-medium">确认密码</Label>
                <Input
                  id="register-confirm-password"
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  disabled={isLoading}
                  className="text-[#244E40] placeholder:text-[#6F8F83] bg-white/85"
                  placeholder="请再次输入密码"
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-[#2E8B6F] hover:bg-[#267A5F] text-white font-medium" 
                disabled={isLoading}
              >
                {isLoading ? '注册中...' : '注册'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}