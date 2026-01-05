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
import { User, LogOut, Settings, Cloud, Tag } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from './AuthModal';

interface UserMenuProps {
  currentVersion?: string | null;
}

export function UserMenu({ currentVersion }: UserMenuProps) {
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
        <DropdownMenuContent className="w-64" align="end" forceMount>
          {/* 用户信息区域 - 浅蓝色背景 */}
          <DropdownMenuLabel className="font-normal bg-blue-50/80 dark:bg-blue-950/30 rounded-t-lg">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none text-blue-900 dark:text-blue-100">{user?.username}</p>
              <p className="text-xs leading-none text-blue-700/80 dark:text-blue-300/80">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          
          {/* 云同步区域 - 浅绿色背景 */}
          <DropdownMenuItem className="bg-green-50/70 dark:bg-green-950/25 hover:bg-green-100/80 dark:hover:bg-green-900/40">
            <Cloud className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-green-800 dark:text-green-200">云端同步已启用</span>
          </DropdownMenuItem>
          
          {/* 设置区域 - 浅紫色背景 */}
          <DropdownMenuItem className="bg-purple-50/70 dark:bg-purple-950/25 hover:bg-purple-100/80 dark:hover:bg-purple-900/40">
            <Settings className="mr-2 h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-purple-800 dark:text-purple-200">设置</span>
          </DropdownMenuItem>
          
          {/* 退出登录和版本号区域 - 浅灰色背景 */}
          <div className="flex items-center justify-between px-2 py-1 bg-gray-50/70 dark:bg-gray-950/25 rounded-b-lg">
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="flex-1 bg-red-50/70 dark:bg-red-950/25 hover:bg-red-100/80 dark:hover:bg-red-900/40 rounded"
            >
              <LogOut className="h-4 w-4 mr-2 text-red-600 dark:text-red-400" />
              <span className="text-red-800 dark:text-red-200">退出登录</span>
            </DropdownMenuItem>
            {currentVersion && (
              <div className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400">
                <span>{currentVersion}</span>
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}