import React, { useState } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { User, LogOut, Settings, Cloud } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from './AuthModal';

export function UserMenu() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    console.log('🚪 用户点击退出登录按钮');
    try {
      // 使用新的logout逻辑，会自动先同步一次到服务器
      await logout(true);
      console.log('✅ 退出登录成功，准备刷新页面');
      // 退出登录成功后刷新页面，确保所有状态都被重置
      window.location.reload();
    } catch (error) {
      console.error('❌ 退出登录时发生错误:', error);
      // 即使同步失败，也继续退出登录
      try {
        await logout(false);
        console.log('✅ 强制退出登录成功，准备刷新页面');
        // 强制退出成功后也刷新页面
        window.location.reload();
      } catch (forceError) {
        console.error('❌ 强制退出登录也失败:', forceError);
        // 即使失败也尝试刷新页面
        window.location.reload();
      }
    }
  };

  // 显示加载状态
  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <User className="h-4 w-4 mr-2" />
        加载中...
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={handleLogin}>
          <User className="h-4 w-4 mr-2" />
          登录
        </Button>
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.username}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Cloud className="mr-2 h-4 w-4" />
            <span>云端同步已启用</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>设置</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}