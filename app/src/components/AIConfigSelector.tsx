import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Crown, Settings } from 'lucide-react';
import { AIConnectionConfig } from '../types/ai';
import { aiService } from '../services/aiService';

interface AIConfigSelectorProps {
  value?: string;
  onChange: (configId: string) => void;
  onOpenConfig?: () => void;
  darkMode?: boolean;
  className?: string;
}

export function AIConfigSelector({ 
  value, 
  onChange, 
  onOpenConfig, 
  darkMode = false, 
  className = '' 
}: AIConfigSelectorProps) {
  const [connections, setConnections] = useState<AIConnectionConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载AI连接配置
  useEffect(() => {
    const loadConnections = async () => {
      try {
        setIsLoading(true);
        const data = await aiService.getConnections();
        
        // 过滤出启用的配置
        const enabledConnections = data.filter(config => config.enabled);
        setConnections(enabledConnections);
        
        // 如果没有选择配置，自动选择第一个启用的配置
        if (!value && enabledConnections.length > 0) {
          onChange(enabledConnections[0].id);
        }
      } catch (error) {
        console.error('加载AI配置失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadConnections();
  }, [value, onChange]);

  const getDisplayName = (config: AIConnectionConfig) => {
    let name = config.name;
    if (config.isSystemDefault) {
      name = `⚡ ${name}`;
    }
    return `${name} (${config.type === 'openai' ? 'OpenAI' : '硅基流动'})`;
  };

  const selectedConfig = connections.find(config => config.id === value);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select value={value} onValueChange={onChange} disabled={isLoading || connections.length === 0}>
        <SelectTrigger className={`w-64 ${darkMode ? 'bg-neutral-dark-700 border-neutral-dark-600' : ''}`}>
          <SelectValue placeholder="选择AI配置">
            {selectedConfig ? (
              <div className="flex items-center gap-2">
                {selectedConfig.isSystemDefault && <Crown className="h-3 w-3 text-yellow-500" />}
                <span>{getDisplayName(selectedConfig)}</span>
              </div>
            ) : (
              '选择AI配置'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {connections.map((config) => (
            <SelectItem key={config.id} value={config.id}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {config.isSystemDefault && <Crown className="h-3 w-3 text-yellow-500" />}
                  <span>{config.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {config.type === 'openai' ? 'OpenAI' : '硅基流动'}
                  </Badge>
                  {config.isSystemDefault && (
                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                      默认
                    </Badge>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {onOpenConfig && (
        <button
          onClick={onOpenConfig}
          className={`p-2 rounded-lg border ${
            darkMode 
              ? 'bg-neutral-dark-700 border-neutral-dark-600 hover:bg-neutral-dark-600' 
              : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
          }`}
          title="管理AI配置"
        >
          <Settings className="h-4 w-4" />
        </button>
      )}
      
      {isLoading && (
        <div className="text-sm text-gray-500">加载中...</div>
      )}
    </div>
  );
}