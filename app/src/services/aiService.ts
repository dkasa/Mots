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

  // 生成句子填空问题（方案1）
  async generateSentenceCompletionQuestion(word: WordWithStatus): Promise<SentenceQuestion> {
    try {
      // 使用AI生成包含目标词的句子
      const response = await apiService.generateSentenceQuestion({
        word: word.id,
        meaning: word.chinese,
        frenchWord: word.french,
        grade: word.grade,
        difficulty: 'medium',
        questionType: 'completion'
      });

      if (response.success) {
        const data = response.data;
        return {
          id: `sentence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'sentence-completion',
          wordId: word.id,
          targetWord: word.french,
          originalSentence: data.original_sentence,
          modifiedSentence: data.modified_sentence,
          options: data.options,
          correctAnswer: data.correct_answer,
          explanation: data.explanation,
          difficulty: 'medium',
          aiGenerated: true
        };
      }
      throw new Error(response.message || '生成句子填空问题失败');
    } catch (error) {
      console.error('生成句子填空问题失败:', error);
      // AI失败时，使用简单的本地生成
      return this.generateLocalSentenceCompletion(word);
    }
  }

  // 本地生成句子填空问题（备用方案）
  private generateLocalSentenceCompletion(word: WordWithStatus): SentenceQuestion {
    // 简单的句子模板
    const sentences = [
      `Je ______ ${word.french}.`,  // 我吃苹果
      `Il/Elle ______ ${word.french}.`,  // 他/她吃苹果
      `Nous ______ ${word.french}.`,  // 我们吃苹果
      `Vous ______ ${word.french}.`,  // 你们吃苹果
      `Ils/Elles ______ ${word.french}.`  // 他们/她们吃苹果
    ];

    const randomSentence = sentences[Math.floor(Math.random() * sentences.length)];
    
    // 根据人称生成动词变位选项
    const verbForms = this.generateVerbOptions(word.french);
    
    return {
      id: `sentence-local-${Date.now()}`,
      type: 'sentence-completion',
      wordId: word.id,
      targetWord: word.french,
      originalSentence: randomSentence.replace('______', word.french),
      modifiedSentence: randomSentence,
      options: verbForms,
      correctAnswer: this.getCorrectVerbForm(randomSentence, word.french),
      explanation: `正确形式是 ${this.getCorrectVerbForm(randomSentence, word.french)}，意思是${word.chinese}`,
      difficulty: 'easy',
      aiGenerated: false
    };
  }

  // 生成动词变位选项
  private generateVerbOptions(baseWord: string): string[] {
    // 简单的动词变位规则（法语第一组动词）
    const options = [
      baseWord,           // 原形
      baseWord + 's',     // 第二人称单数
      baseWord + 't',     // 第三人称单数
      baseWord + 'ons',   // 第一人称复数
      baseWord + 'ez',    // 第二人称复数
      baseWord + 'ent'    // 第三人称复数
    ];
    
    // 打乱顺序并返回前4个
    return this.shuffleArray(options).slice(0, 4);
  }

  // 根据句子人称获取正确的动词形式
  private getCorrectVerbForm(sentence: string, baseWord: string): string {
    if (sentence.startsWith('Je')) return baseWord;
    if (sentence.startsWith('Il/Elle') || sentence.startsWith('Il') || sentence.startsWith('Elle')) return baseWord + 't';
    if (sentence.startsWith('Nous')) return baseWord + 'ons';
    if (sentence.startsWith('Vous')) return baseWord + 'ez';
    if (sentence.startsWith('Ils/Elles') || sentence.startsWith('Ils') || sentence.startsWith('Elles')) return baseWord + 'ent';
    return baseWord;
  }

  // 打乱数组
  private shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
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