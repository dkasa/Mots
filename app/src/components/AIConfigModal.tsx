import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Save, 
  TestTube, 
  Trash2, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Settings, 
  RefreshCw 
} from 'lucide-react';
import { AIConnectionConfig, AIProviderType } from '../types/ai';
import { aiService } from '../services/aiService';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
}

export function AIConfigModal({ isOpen, onClose, darkMode = false }: AIConfigModalProps) {
  const [connections, setConnections] = useState<AIConnectionConfig[]>([]);
  const [editingConnection, setEditingConnection] = useState<AIConnectionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ [key: string]: boolean | null }>({});
  const [isTesting, setIsTesting] = useState(false);

  // 加载AI连接配置
  useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen]);

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      const data = await aiService.getConnections();
      setConnections(data);
    } catch (error) {
      console.error('加载AI配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingConnection({
      id: '',
      name: '',
      type: 'openai',
      baseUrl: '',
      apiKey: '',
      model: '',
      maxTokens: 1000,
      temperature: 0.7,
      enabled: true,
      createdAt: '',
      updatedAt: ''
    });
  };

  const handleEdit = (connection: AIConnectionConfig) => {
    setEditingConnection(connection);
  };

  const handleSave = async () => {
    if (!editingConnection) return;

    try {
      setIsLoading(true);
      
      if (editingConnection.id) {
        // 更新现有配置
        await aiService.updateConnection(editingConnection.id, editingConnection);
      } else {
        // 创建新配置
        const { id, createdAt, updatedAt, ...newConfig } = editingConnection;
        await aiService.createConnection(newConfig);
      }
      
      await loadConnections();
      setEditingConnection(null);
      setTestResult({});
    } catch (error) {
      console.error('保存AI配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个AI连接配置吗？')) return;

    try {
      setIsLoading(true);
      await aiService.deleteConnection(id);
      await loadConnections();
      setTestResult({});
    } catch (error) {
      console.error('删除AI配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async (connection: AIConnectionConfig) => {
    try {
      setIsTesting(true);
      setTestResult(prev => ({ ...prev, [connection.id]: null }));
      
      const result = await aiService.testConnection(connection.id);
      setTestResult(prev => ({ ...prev, [connection.id]: result }));
    } catch (error) {
      console.error('测试连接失败:', error);
      setTestResult(prev => ({ ...prev, [connection.id]: false }));
    } finally {
      setIsTesting(false);
    }
  };

  const handleProviderChange = (type: AIProviderType) => {
    if (editingConnection) {
      const defaultConfig = aiService.generateDefaultConfig(type);
      setEditingConnection({
        ...editingConnection,
        ...defaultConfig
      });
    }
  };

  const getProviderInfo = (type: AIProviderType) => {
    return aiService.getProviderInfo(type);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={`max-w-4xl max-h-[90vh] overflow-y-auto ${
          darkMode ? 'bg-neutral-dark-900 text-white' : 'bg-white'
        }`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            AI连接配置管理
          </DialogTitle>
          <DialogDescription>
            配置和管理AI服务连接，用于生成智能句子练习题
          </DialogDescription>
        </DialogHeader>

        {editingConnection ? (
          // 编辑/创建配置界面
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="providerType">AI服务提供商</Label>
                <Select
                  value={editingConnection.type}
                  onValueChange={(value: AIProviderType) => handleProviderChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="siliconflow">硅基流动</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">配置名称</Label>
                <Input
                  id="name"
                  value={editingConnection.name}
                  onChange={(e) => setEditingConnection({
                    ...editingConnection,
                    name: e.target.value
                  })}
                  placeholder="输入配置名称"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseUrl">API基础地址</Label>
              <Input
                id="baseUrl"
                value={editingConnection.baseUrl}
                onChange={(e) => setEditingConnection({
                  ...editingConnection,
                  baseUrl: e.target.value
                })}
                placeholder="输入API基础地址"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API密钥</Label>
              <Input
                id="apiKey"
                type="password"
                value={editingConnection.apiKey}
                onChange={(e) => setEditingConnection({
                  ...editingConnection,
                  apiKey: e.target.value
                })}
                placeholder="输入API密钥"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model">模型</Label>
                <Input
                  id="model"
                  value={editingConnection.model}
                  onChange={(e) => setEditingConnection({
                    ...editingConnection,
                    model: e.target.value
                  })}
                  placeholder="输入模型名称，推荐使用：Hunyuan-MT-7B"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">最大Token数</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={editingConnection.maxTokens}
                  onChange={(e) => setEditingConnection({
                    ...editingConnection,
                    maxTokens: parseInt(e.target.value) || 1000
                  })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature">温度参数 (0-1)</Label>
              <Input
                id="temperature"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={editingConnection.temperature}
                onChange={(e) => setEditingConnection({
                  ...editingConnection,
                  temperature: parseFloat(e.target.value) || 0.7
                })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                  <Switch
                    checked={editingConnection.enabled}
                    onCheckedChange={(checked) => setEditingConnection({
                      ...editingConnection,
                      enabled: checked
                    })}
                    className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-400"
                  />
                  <Label className={`font-medium ${editingConnection.enabled ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {editingConnection.enabled ? '已启用' : '已禁用'}
                  </Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingConnection(null)}
                  disabled={isLoading}
                >
                  取消
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isLoading || !editingConnection.name || !editingConnection.apiKey || !editingConnection.model}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? '保存中...' : '保存配置'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // 配置列表界面
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                新建配置
              </Button>
              
              <Button variant="outline" onClick={loadConnections} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>加载中...</p>
              </div>
            ) : connections.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">暂无AI配置</p>
                  <p className="text-gray-500 mb-4">创建一个AI连接配置来启用智能句子练习功能</p>
                  <Button onClick={handleCreateNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    创建第一个配置
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {connections.map((connection) => (
                  <Card key={connection.id} className={`${
                    connection.enabled 
                      ? darkMode ? 'border-green-500' : 'border-green-200' 
                      : darkMode ? 'border-gray-600' : 'border-gray-200'
                  }`}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            {connection.name}
                            <Badge 
                              variant={connection.enabled ? "default" : "secondary"}
                              className={connection.enabled ? "bg-green-500" : ""}
                            >
                              {connection.enabled ? "已启用" : "已禁用"}
                            </Badge>
                            <Badge variant="outline">
                              {connection.type === 'openai' ? 'OpenAI' : '硅基流动'}
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-gray-500 mt-1">
                            模型: {connection.model} | 地址: {connection.baseUrl}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestConnection(connection)}
                            disabled={isTesting}
                          >
                            <TestTube className="h-3 w-3 mr-1" />
                            测试
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(connection)}
                          >
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(connection.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span>温度: {connection.temperature}</span>
                          <span>最大Token: {connection.maxTokens}</span>
                          <span>创建时间: {new Date(connection.createdAt).toLocaleDateString()}</span>
                        </div>
                        
                        {testResult[connection.id] !== undefined && (
                          <div className="flex items-center gap-1">
                            {testResult[connection.id] === true ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-green-500">连接正常</span>
                              </>
                            ) : testResult[connection.id] === false ? (
                              <>
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-red-500">连接失败</span>
                              </>
                            ) : (
                              <span className="text-gray-500">测试中...</span>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}