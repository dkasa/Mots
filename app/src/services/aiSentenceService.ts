import { apiService } from './api';
import { WordWithStatus } from '../types/vocabulary';

export interface AISentence {
  id: string;
  wordId: string;
  targetWord: string;
  sentences: {
    french: string;
    chinese: string;
  }[];
  explanation?: string;
  aiGenerated: boolean;
}

export interface SentenceGenerationRequest {
  word: string;
  meaning: string;
  frenchWord: string;
  grade: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

class AISentenceService {

  // 从数据库获取已有的句子
  async getExistingSentences(wordId: string): Promise<AISentence | null> {
    try {
      const response = await apiService.getWordSentences(wordId);
      console.log('🔍 获取句子API响应:', response);
      
      if (response && response.success && response.data && Array.isArray(response.data)) {
        const questions = response.data;
        console.log('📥 获取到的题目数量:', questions.length);
        
        // 返回数据库中的所有句子
        const sentences = questions.map((question, index) => ({
          french: question.original_sentence || '',
          chinese: question.explanation || ''
        }));
        
        console.log('🔄 转换后的句子:', sentences);
        
        if (sentences.length > 0) {
          return {
            id: `existing-${wordId}`,
            wordId: wordId,
            targetWord: questions[0].word || '',
            sentences: sentences,
            explanation: questions[0].explanation,
            aiGenerated: false
          };
        }
      }
      return null;
    } catch (error) {
      console.warn('获取已有句子失败:', error);
      return null;
    }
  }

  // 生成AI造句
  async generateSentences(word: WordWithStatus): Promise<AISentence> {
    try {
      console.log('🚀 开始调用API生成句子，单词:', word.french, '中文:', word.chinese);
      
      const response = await apiService.generateAISentences({
        word: word.id,
        meaning: word.chinese,
        frenchWord: word.french,
        grade: word.grade,
        difficulty: 'medium'
      });

      console.log('📥 收到API响应:', response);

      if (response && response.success) {
        const data = response.data;
        console.log('✅ AI生成成功，句子数量:', data.sentences?.length || 0);
        console.log('📝 句子内容:', JSON.stringify(data.sentences, null, 2));
        
        return {
          id: `sentence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          wordId: word.id,
          targetWord: word.french,
          sentences: data.sentences || [],
          explanation: data.explanation,
          aiGenerated: true
        };
      }
      
      console.warn('⚠️ API返回失败，使用本地生成');
      throw new Error(response?.message || '生成AI造句失败');
    } catch (error) {
      console.error('❌ 生成AI造句失败:', error);
      throw new Error('AI生成句子失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }


}

export const aiSentenceService = new AISentenceService();