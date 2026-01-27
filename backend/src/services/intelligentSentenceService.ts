/**
 * 智能句子服务 - 支持句子题型的灵活转换和复用
 */

import { pool } from '../database/postgresql';

interface IntelligentQuestion {
  id: number;
  wordId: string;
  questionType: string;
  word: string;
  meaning: string;
  grade: number;
  difficulty: string;
  originalSentence: string;
  modifiedSentence?: string;
  wordBlocks?: string[];
  shuffledBlocks?: string[];
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  createdAt: string;
}

class IntelligentSentenceService {
  /**
   * 根据句子ID获取智能句子（支持题型转换）
   */
  async getIntelligentSentence(questionId: number, targetQuestionType?: string): Promise<IntelligentQuestion | null> {
    try {
      // 获取原始题目
      const originalQuestion = await this.getQuestionById(questionId);
      if (!originalQuestion) {
        return null;
      }

      // 如果不需要转换题型，直接返回
      if (!targetQuestionType || targetQuestionType === originalQuestion.questionType) {
        return originalQuestion;
      }

      // 转换题型
      return await this.convertQuestionType(originalQuestion, targetQuestionType);
    } catch (error) {
      console.error('❌ 获取智能句子失败:', error);
      return null;
    }
  }

  /**
   * 根据单词ID获取所有可用的智能句子
   */
  async getIntelligentSentencesByWord(wordId: string): Promise<IntelligentQuestion[]> {
    try {
      const query = `
        SELECT * FROM ai_generated_questions 
        WHERE word_id = $1 
        ORDER BY created_at DESC
      `;
      
      const result = await pool.query(query, [wordId]);
      return result.rows;
    } catch (error) {
      console.error('❌ 获取单词智能句子失败:', error);
      return [];
    }
  }

  /**
   * 转换题目类型
   */
  private async convertQuestionType(question: IntelligentQuestion, targetType: string): Promise<IntelligentQuestion> {
    // 检查是否已经有目标类型的题目
    const existingQuestion = await this.findQuestionByType(question.wordId, targetType, question.originalSentence);
    if (existingQuestion) {
      return existingQuestion;
    }

    // 动态生成目标类型的题目
    const convertedQuestion = this.generateConvertedQuestion(question, targetType);
    
    // 保存转换后的题目（可选，用于缓存）
      try {
        const savedId = await this.saveQuestionToDatabase(convertedQuestion);
        convertedQuestion.id = savedId;
      } catch (error) {
        console.warn('⚠️ 保存转换题目失败，使用内存版本:', error);
      }

    return convertedQuestion;
  }

  /**
   * 生成转换后的题目
   */
  private generateConvertedQuestion(question: IntelligentQuestion, targetType: string): IntelligentQuestion {
    const baseQuestion = {
      wordId: question.wordId,
      word: question.word,
      meaning: question.meaning,
      grade: question.grade,
      difficulty: question.difficulty,
      originalSentence: question.originalSentence,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      createdAt: new Date().toISOString()
    };

    switch (targetType) {
      case 'sentence-completion':
        // 从重组题转换为填空题
        return {
          ...baseQuestion,
          id: 0, // 临时ID
          questionType: 'sentence-completion',
          modifiedSentence: question.modifiedSentence || this.createFillInTheBlank(question.originalSentence, question.word),
          options: question.options || this.generateOptions(question.word),
          wordBlocks: question.wordBlocks || [],
          shuffledBlocks: question.shuffledBlocks || []
        };

      case 'sentence-reordering':
        // 从填空题转换为重组题
        return {
          ...baseQuestion,
          id: 0, // 临时ID
          questionType: 'sentence-reordering',
          modifiedSentence: question.originalSentence, // 重组题使用原句
          options: [], // 重组题不需要选项
          wordBlocks: question.wordBlocks || this.splitSentenceIntoBlocks(question.originalSentence),
          shuffledBlocks: question.shuffledBlocks || this.shuffleArray(this.splitSentenceIntoBlocks(question.originalSentence))
        };

      default:
        throw new Error(`不支持的题目类型: ${targetType}`);
    }
  }

  /**
   * 查找同句子同类型的题目
   */
  private async findQuestionByType(wordId: string, questionType: string, originalSentence: string): Promise<IntelligentQuestion | null> {
    try {
      const query = `
        SELECT * FROM ai_generated_questions 
        WHERE word_id = $1 
          AND question_type = $2 
          AND original_sentence = $3 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      const result = await pool.query(query, [wordId, questionType, originalSentence]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ 查找题目失败:', error);
      return null;
    }
  }

  /**
   * 根据ID获取题目
   */
  private async getQuestionById(questionId: number): Promise<IntelligentQuestion | null> {
    try {
      const query = 'SELECT * FROM ai_generated_questions WHERE id = $1';
      const result = await pool.query(query, [questionId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ 获取题目失败:', error);
      return null;
    }
  }

  /**
   * 创建填空句子
   */
  private createFillInTheBlank(sentence: string, targetWord: string): string {
    return sentence.replace(new RegExp(targetWord, 'gi'), '_____');
  }

  /**
   * 生成干扰选项
   */
  private generateOptions(targetWord: string): string[] {
    const baseOptions = [targetWord];
    
    if (targetWord.endsWith('e')) {
      baseOptions.push(targetWord.slice(0, -1));
    }
    
    baseOptions.push(targetWord + 's');
    baseOptions.push(targetWord + 't');
    
    while (baseOptions.length < 4) {
      baseOptions.push(targetWord + Math.random().toString(36).substring(2, 4));
    }
    
    return this.shuffleArray(baseOptions);
  }

  /**
   * 将句子拆分成单词块
   */
  private splitSentenceIntoBlocks(sentence: string): string[] {
    return sentence.split(/\s+/).filter(block => block.trim().length > 0);
  }

  /**
   * 打乱数组
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 检查句子是否支持智能复用
   */
  async checkSentenceReusability(questionId: number): Promise<{
    canConvertToReorder: boolean;
    canConvertToCompletion: boolean;
    missingFields: string[];
  }> {
    const question = await this.getQuestionById(questionId);
    if (!question) {
      return {
        canConvertToReorder: false,
        canConvertToCompletion: false,
        missingFields: ['题目不存在']
      };
    }

    const missingFields: string[] = [];

    // 检查是否能转换为重组题
    const canConvertToReorder = !!(question.wordBlocks && question.wordBlocks.length > 0);
    if (!canConvertToReorder) {
      missingFields.push('word_blocks（单词块数据）');
    }

    // 检查是否能转换为填空题
    const canConvertToCompletion = !!(question.modifiedSentence && question.options && question.options.length > 0);
    if (!canConvertToCompletion) {
      missingFields.push('modified_sentence（填空句子）或 options（选项）');
    }

    return {
      canConvertToReorder,
      canConvertToCompletion,
      missingFields
    };
  }

  /**
   * 保存题目到数据库
   */
  private async saveQuestionToDatabase(question: IntelligentQuestion): Promise<number> {
    try {
      const query = `
        INSERT INTO ai_generated_questions (
          word_id, question_type, word, meaning, grade, difficulty,
          original_sentence, modified_sentence, word_blocks, shuffled_blocks,
          options, correct_answer, explanation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;
      
      const result = await pool.query(query, [
        question.wordId,
        question.questionType,
        question.word,
        question.meaning,
        question.grade,
        question.difficulty,
        question.originalSentence,
        question.modifiedSentence || null,
        question.wordBlocks ? JSON.stringify(question.wordBlocks) : null,
        question.shuffledBlocks ? JSON.stringify(question.shuffledBlocks) : null,
        question.options ? JSON.stringify(question.options) : null,
        question.correctAnswer,
        question.explanation || null
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ 保存题目到数据库失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const intelligentSentenceService = new IntelligentSentenceService();