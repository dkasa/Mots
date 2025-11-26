import React from 'react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { SyncStatus } from '../types/auth';

interface SyncStatusIndicatorProps {
  syncStatus: SyncStatus;
  onSyncClick?: () => void;
}

export function SyncStatusIndicator({ syncStatus, onSyncClick }: SyncStatusIndicatorProps) {
  const { isOnline, syncInProgress, lastSyncTime, hasUnsyncedChanges } = syncStatus;

  const getStatusIcon = () => {
    if (syncInProgress) {
      return <RefreshCw className="h-3 w-3 animate-spin" />;
    }
    
    if (!isOnline) {
      return <WifiOff className="h-3 w-3" />;
    }
    
    if (hasUnsyncedChanges) {
      return <RefreshCw className="h-3 w-3 text-orange-500" />;
    }
    
    return <CheckCircle className="h-3 w-3 text-green-500" />;
  };

  const getStatusText = () => {
    if (syncInProgress) return '同步中...';
    if (!isOnline) return '离线状态';
    if (hasUnsyncedChanges) return '待同步';
    return '已同步';
  };

  const getStatusVariant = () => {
    if (syncInProgress) return 'default';
    if (!isOnline) return 'destructive';
    if (hasUnsyncedChanges) return 'secondary';
    return 'default';
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return '从未同步';
    
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getStatusVariant()} 
            className={`cursor-pointer flex items-center gap-1 ${
              onSyncClick && (isOnline || hasUnsyncedChanges) ? 'hover:bg-opacity-80' : ''
            }`}
            onClick={() => {
              if (onSyncClick && (isOnline || hasUnsyncedChanges) && !syncInProgress) {
                onSyncClick();
              }
            }}
          >
            {getStatusIcon()}
            <span className="text-xs">{getStatusText()}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            <div>状态: {getStatusText()}</div>
            <div>网络: {isOnline ? '在线' : '离线'}</div>
            <div>最后同步: {formatLastSyncTime()}</div>
            {hasUnsyncedChanges && (
              <div className="text-orange-500">有未同步的更改</div>
            )}
            {onSyncClick && isOnline && !syncInProgress && (
              <div className="text-blue-500 text-xs">点击手动同步</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}