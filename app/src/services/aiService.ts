import { apiService } from './api';
import { AIConnectionConfig, SentenceGenerationRequest, SentenceGenerationResponse, SentenceQuestion, AIProviderType } from '../types/ai';
import { WordWithStatus } from '../types/vocabulary';

export class AIService {
  // 获取用户的所有AI连接配置
  async getConnections(): Promise<AIConnectionConfig[]> {
    try {
      const response = await apiService.getAIConnections();
      if (response.success) {
        return response.data.map((config: any) => this.normalizeConnectionConfig(config));
      }
      throw new Error(response.message || '获取AI连接配置失败');
    } catch (error) {
      console.error('获取AI连接配置失败:', error);
      throw error;
    }
  }

  // 创建AI连接配置
  async createConnection(config: Omit<AIConnectionConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    try {
      const response = await apiService.createAIConnection(config);
      if (response.success) {
        return response.data.id;
      }
      throw new Error(response.message || '创建AI连接配置失败');
    } catch (error) {
      console.error('创建AI连接配置失败:', error);
      throw error;
    }
  }

  // 更新AI连接配置
  async updateConnection(id: string, updates: Partial<AIConnectionConfig>): Promise<void> {
    try {
      const response = await apiService.updateAIConnection(id, updates);
      if (!response.success) {
        throw new Error(response.message || '更新AI连接配置失败');
      }
    } catch (error) {
      console.error('更新AI连接配置失败:', error);
      throw error;
    }
  }

  // 删除AI连接配置
  async deleteConnection(id: string): Promise<void> {
    try {
      const response = await apiService.deleteAIConnection(id);
      if (!response.success) {
        throw new Error(response.message || '删除AI连接配置失败');
      }
    } catch (error) {
      console.error('删除AI连接配置失败:', error);
      throw error;
    }
  }

  // 测试AI连接
  async testConnection(id: string): Promise<boolean> {
    try {
      const response = await apiService.testAIConnection(id);
      if (response.success) {
        return response.data.connected;
      }
      throw new Error(response.message || '测试AI连接失败');
    } catch (error) {
      console.error('测试AI连接失败:', error);
      throw error;
    }
  }

  // 生成句子填空问题
  async generateSentenceCompletionQuestion(word: WordWithStatus): Promise<SentenceQuestion> {
    try {
      // 使用AI生成包含目标词的句子
      const response = await apiService.generateSentenceQuestion({
        word: word.id,
        meaning: word.chinese,
        frenchWord: word.french,
        grade: word.grade,
        difficulty: 'medium',
        questionType: 'sentence-completion'
      });

      if (response.success) {
        const data = response.data;
        console.log('📥 收到AI响应:', {
          hasOptions: !!data.options,
          optionsCount: data.options?.length || 0,
          options: data.options
        });
        
        // 验证数据完整性
        if (!data.options || data.options.length === 0) {
          throw new Error('AI返回的填空题缺少选项');
        }
        
        // 判断是否为AI生成：有questionId表示来自题库（AI生成），没有questionId表示程序生成
        const isAiGenerated = !!data.questionId;
        
        return {
          id: data.questionId ? `sentence-${data.questionId}` : `sentence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'sentence-completion',
          wordId: word.id,
          targetWord: word.french,
          originalSentence: data.original_sentence,
          modifiedSentence: data.modified_sentence || data.original_sentence,  // 如果没有 modified_sentence，使用 original_sentence
          options: data.options,  // 直接使用后端返回的 options（可能为空数组）
          correctAnswer: data.correct_answer,
          explanation: data.explanation,
          difficulty: 'medium',
          aiGenerated: isAiGenerated,
          questionId: data.questionId // 保存题库ID
        };
      }
      throw new Error(response.message || '生成句子填空问题失败');
    } catch (error) {
      console.error('❌ 生成句子填空问题失败:', error);
      throw error; // 直接抛出错误，不再使用本地降级方案
    }
  }



  // 标准化AI连接配置格式
  private normalizeConnectionConfig(config: any): AIConnectionConfig {
    return {
      id: config.id.toString(),
      name: config.name,
      type: config.type as AIProviderType,
      baseUrl: config.base_url,
      apiKey: config.api_key,
      model: config.model,
      maxTokens: config.max_tokens,
      temperature: config.temperature,
      enabled: config.enabled,
      isSystemDefault: config.is_system_default || false,
      createdAt: config.created_at,
      updatedAt: config.updated_at
    };
  }

  // 生成默认的AI连接配置
  generateDefaultConfig(providerType: AIProviderType): Omit<AIConnectionConfig, 'id' | 'createdAt' | 'updatedAt'> {
    const provider = this.getProviderInfo(providerType);
    
    return {
      name: `${provider.name} 配置`,
      type: providerType,
      baseUrl: provider.baseUrl,
      apiKey: '',
      model: provider.supportedModels[0],
      maxTokens: 1000,
      temperature: 0.7,
      enabled: true
    };
  }

  // 获取AI提供商信息
  getProviderInfo(providerType: AIProviderType) {
    const providers = {
      openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        supportedModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
      },
      siliconflow: {
        name: '硅基流动',
        baseUrl: 'https://api.siliconflow.cn/v1',
        supportedModels: ['Hunyuan-MT-7B', 'deepseek-coder-6.7b-instruct']
      }
    };

    return providers[providerType];
  }
}

// 导出单例实例
export const aiService = new AIService();