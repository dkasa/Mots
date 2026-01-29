import { AIConnectionConfig, SentenceGenerationRequest, SentenceGenerationResponse, AIService, AICompletionRequest, AICompletionResponse, WordLookupResponse } from '../types/ai';
import { aiQuestionCacheQueries, pool } from '../database/postgresql';
import { getGradeDescription } from '../shared/constants';

// 使用 Node.js 内置的 undici
import { request as httpRequest } from 'undici';

const MAX_CACHED_QUESTIONS = 10; // 每个单词每个题型最多缓存10题

export class AIServiceImpl implements AIService {
  async generateSentenceQuestion(
    request: SentenceGenerationRequest,
    connection?: AIConnectionConfig,
    _excludeQuestionIds?: number[] // 已废弃，保留参数兼容性
  ): Promise<SentenceGenerationResponse> {
    const { word, frenchWord, meaning, grade, difficulty, question_type } = request;

    // 转换 question_type 格式: completion -> sentence-completion, reordering -> sentence-reordering
    const normalizedQuestionType = this.normalizeQuestionType(question_type);

    console.log(`🔍 请求生成题目: word=${frenchWord}, type=${question_type} -> ${normalizedQuestionType}`);

    // 1. 优先从题库中查找（可以重复使用）
    try {
      const cachedCount = await aiQuestionCacheQueries.countByWordAndType(word, normalizedQuestionType);
      console.log(`📊 数据库中【${frenchWord} - ${normalizedQuestionType}】已缓存 ${cachedCount}/${MAX_CACHED_QUESTIONS} 题`);

      // 只有当题库缓存了10道题时，才从题库中取题
      if (cachedCount >= MAX_CACHED_QUESTIONS) {
        const cachedQuestion = await aiQuestionCacheQueries.getRandomQuestion(word, normalizedQuestionType, []);

        if (cachedQuestion) {
          console.log('✅ 从题库中获取到题目:', {
            id: cachedQuestion.id,
            word: cachedQuestion.word,
            type: cachedQuestion.question_type,
            original_sentence: cachedQuestion.original_sentence?.substring(0, 50) + '...',
            has_options: !!cachedQuestion.options,
            options_count: cachedQuestion.options?.length || 0,
            has_word_blocks: !!cachedQuestion.word_blocks,
            word_blocks_count: cachedQuestion.word_blocks?.length || 0
          });

          // 简化逻辑：直接使用数据库标记的题型，智能复用由新服务处理
          const actualQuestionType = cachedQuestion.question_type;
          
          // 检查题型是否匹配
          if (actualQuestionType !== normalizedQuestionType) {
            console.warn(`⚠️ 题型不匹配：数据库存储的是${actualQuestionType}，但请求的是${normalizedQuestionType}`);
            console.warn('❌ 无法使用题库中的题目，将重新生成');
            throw new Error(`题库中题目类型不匹配：存储的是${actualQuestionType}，但请求的是${normalizedQuestionType}`);
          }

          // 根据实际题型返回对应的字段
          if (actualQuestionType === 'sentence-completion') {
            return {
              original_sentence: cachedQuestion.original_sentence,
              modified_sentence: cachedQuestion.modified_sentence || cachedQuestion.original_sentence,
              options: cachedQuestion.options || [],
              correct_answer: cachedQuestion.correct_answer || frenchWord,
              explanation: cachedQuestion.explanation || '',
              questionId: cachedQuestion.id // 返回题库ID
            };
          } else {
            // 词卡重组题
            return {
              original_sentence: cachedQuestion.original_sentence,
              word_blocks: cachedQuestion.word_blocks || [],
              shuffled_blocks: cachedQuestion.shuffled_blocks || [],
              explanation: cachedQuestion.explanation || '',
              questionId: cachedQuestion.id // 返回题库ID
            };
          }
        }
      }

      // 2. 如果题库为空，生成新题目
      console.log('⚠️ 题库为空，生成新题目...');
      const newQuestion = await this.generateNewQuestion(request, connection);

      // 3. 保存到题库
      // 只有AI生成的、并且数据完整的题目才保存
      if (newQuestion && cachedCount < MAX_CACHED_QUESTIONS) {
        // 验证题目数据完整性
        let isValidQuestion = true;

        if (normalizedQuestionType === 'sentence-completion') {
          // 填空题必须有 options
          if (!newQuestion.options || newQuestion.options.length === 0) {
            console.warn('⚠️ AI生成的填空题缺少options，不保存到题库');
            isValidQuestion = false;
          }
        } else if (normalizedQuestionType === 'sentence-reordering') {
          // 词卡重组题必须有 word_blocks 和 shuffled_blocks
          if (!newQuestion.word_blocks || newQuestion.word_blocks.length === 0 ||
              !newQuestion.shuffled_blocks || newQuestion.shuffled_blocks.length === 0) {
            console.warn('⚠️ AI生成的词卡重组题缺少word_blocks，不保存到题库');
            isValidQuestion = false;
          }
        }

        if (isValidQuestion) {
          try {
            const questionId = await aiQuestionCacheQueries.saveQuestion({
              wordId: word,
              questionType: normalizedQuestionType,
              word: frenchWord,
              meaning: meaning,
              grade: grade,
              difficulty: difficulty,
              originalSentence: newQuestion.original_sentence,
              modifiedSentence: newQuestion.modified_sentence,
              wordBlocks: newQuestion.word_blocks,
              shuffledBlocks: newQuestion.shuffled_blocks,
              options: newQuestion.options,
              correctAnswer: newQuestion.correct_answer || '',
              explanation: newQuestion.explanation
            });
            console.log(`💾 新题目已保存到题库 (${cachedCount + 1}/${MAX_CACHED_QUESTIONS})`);

            // 返回新生成题目的ID
            return {
              ...newQuestion,
              questionId: questionId
            };
          } catch (cacheError) {
            console.warn('⚠️ 保存到题库失败:', cacheError);
            // 题库保存失败不影响返回结果
          }
        }
      }

      return newQuestion;
    } catch (error) {
      console.warn('❌ 从题库获取失败，直接生成:', error);
      return this.generateNewQuestion(request, connection);
    }
  }

  async generateNewQuestion(request: SentenceGenerationRequest, connection?: AIConnectionConfig): Promise<SentenceGenerationResponse> {
    // 只使用AI生成，如果失败则直接抛出错误
    try {
      // 优先使用传入的用户AI配置
      if (connection && connection.enabled) {
        console.log(`使用用户AI配置: ${connection.name} (${connection.type})`);
        const aiResult = await this.generateWithAI(connection, request);
        console.log('AI生成成功，返回AI生成的内容');
        return aiResult;
      }
      
      // 如果没有用户配置，使用系统默认配置
      console.log('使用系统默认AI配置');
      const aiResult = await this.generateWithSystemDefaultConfig(request);
      console.log('AI生成成功，返回AI生成的内容');
      return aiResult;
    } catch (error) {
      console.warn('❌ AI生成失败，直接抛出错误:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`AI生成失败: ${errorMessage}`);
    }
  }
  
  // 使用系统默认配置生成题目
  private async generateWithSystemDefaultConfig(request: SentenceGenerationRequest): Promise<SentenceGenerationResponse> {
    try {
      // 获取系统默认配置
      const systemConfig = await this.getSystemDefaultAIConfig();
      if (systemConfig) {
        console.log(`使用系统默认AI配置: ${systemConfig.name} (${systemConfig.type})`);
        return await this.generateWithAI(systemConfig, request);
      }
      
      // 如果系统默认配置不存在，使用环境变量配置
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'your-openai-api-key-here') {
        console.warn('⚠️ 未配置有效的AI API密钥，请检查环境变量或配置AI连接');
        throw new Error('未配置有效的AI API密钥');
      }
      
      // 使用环境变量配置
      const defaultConnection: AIConnectionConfig = {
        id: 'default',
        user_id: 0,
        name: '环境变量默认配置',
        type: 'openai',
        base_url: 'https://api.openai.com/v1',
        api_key: apiKey,
        model: 'gpt-3.5-turbo',
        max_tokens: 1000,
        temperature: 0.7,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('使用环境变量默认配置');
      return await this.generateWithAI(defaultConnection, request);
    } catch (error) {
      console.error('使用系统默认配置失败:', error);
      throw error;
    }
  }
  
  // 获取系统默认AI配置（从环境变量读取）
  private async getSystemDefaultAIConfig(): Promise<AIConnectionConfig | null> {
    try {
      // 优先使用硅基流动的系统配置
      const apiKey = process.env.SYSTEM_AI_API_KEY;
      if (!apiKey || apiKey === 'your-siliconflow-api-key') {
        console.warn('⚠️ 未配置系统默认AI API密钥，请检查SYSTEM_AI_API_KEY环境变量');
        return null;
      }

      return {
        id: 'system-default',
        user_id: 0,
        name: '系统默认配置',
        type: (process.env.SYSTEM_AI_PROVIDER || 'siliconflow') as 'openai' | 'siliconflow',
        base_url: process.env.SYSTEM_AI_BASE_URL || 'https://api.siliconflow.cn/v1',
        api_key: apiKey,
        model: process.env.SYSTEM_AI_MODEL || 'Qwen/Qwen3-8B',
        max_tokens: parseInt(process.env.SYSTEM_AI_MAX_TOKENS || '1000'),
        temperature: parseFloat(process.env.SYSTEM_AI_TEMPERATURE || '0.7'),
        enabled: true,
        is_system_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.warn('获取系统默认AI配置失败:', error);
      return null;
    }
  }
  
  private async generateWithAI(connection: AIConnectionConfig, request: SentenceGenerationRequest): Promise<SentenceGenerationResponse> {
    const { word, meaning, frenchWord, grade, difficulty, question_type } = request;
    
    console.log(`🔍 开始AI生成：单词=${frenchWord}, 难度=${difficulty}, 类型=${question_type}`);
    
    // 构建AI提示词
    const prompt = this.buildAIPrompt(frenchWord, meaning, grade, difficulty, question_type);
    console.log('📝 AI提示词构建完成');
    
    // 调用AI API
    console.log(`🌐 调用AI API：${connection.base_url}`);
    const aiResponse = await this.callAIAPI(connection, {
      prompt,
      model: connection.model,
      max_tokens: connection.max_tokens || 1000,
      temperature: connection.temperature || 0.7
    });
    
    console.log('✅ AI API调用成功');
    
    // 解析AI返回的内容
    const result = this.parseAIResponse(aiResponse, frenchWord, meaning, question_type);
          console.log('📄 AI返回内容解析完成');
    console.log('📋 返回题目详情:', {
      questionType: question_type,
      hasOptions: !!result.options,
      optionsCount: result.options?.length || 0,
      hasWordBlocks: !!result.word_blocks,
      wordBlocksCount: result.word_blocks?.length || 0
    });

    return result;
  }
  
  private getGradeDescription(grade: number): string {
    return getGradeDescription(grade);
  }

  private buildAIPrompt(frenchWord: string, meaning: string, grade: number, difficulty: string, questionType: string): string {
    // 将数字年级转换为更友好的描述
    const gradeDescription = this.getGradeDescription(grade);
    
    if (questionType === 'sentence-completion') {
      return `你是一位经验丰富的法语教师，为${gradeDescription}学生创建一个法语填空练习题。

目标单词：${frenchWord}（${meaning}）
难度级别：${difficulty}
学生水平：${gradeDescription}

**教学要求：**
1. 创建一个简单、实用的法语句子，适合${gradeDescription}学生的理解水平
2. 句子长度控制在5-8个单词，语法简单清晰
3. 将"${frenchWord}"替换为下划线"______"
4. 提供4个选项，第一个是正确答案
5. 句子内容要贴近学生的日常生活和学习场景

**选项设计原则：**
- 如果"${frenchWord}"是名词：提供正确形式、常见相关形式（如阴性形式或复数形式）
- 如果"${frenchWord}"是动词：提供正确的变位形式，避免过于复杂的时态
- 如果"${frenchWord}"是其他词性：提供正确形式和常见混淆形式
- **4个选项必须完全不相同，有明显区别，适合${gradeDescription}学生的认知水平**

**内容限制：**
- 句子要简单实用，避免过于复杂的语法结构
- 选项要合理，不能有过于明显的错误选项
- explanation字段只能包含完整原句的准确且自然的中文翻译
  - 翻译要符合中文表达习惯，自然流畅
  - 避免直译和僵硬表达，如"一会儿见，我回来！"改为"一会儿见，我马上回来！"
  - 避免重复表达，如"一会儿见，我们再见！"改为"一会儿见，我们待会儿见！"
- 不要添加任何额外的解释或分析

请严格按照以下JSON格式返回，只包含JSON：
{
  "original_sentence": "适合${gradeDescription}学生的简单法语句子",
  "modified_sentence": "将${frenchWord}替换为下划线后的句子",
  "options": ["正确的${frenchWord}形式", "干扰项1", "干扰项2", "干扰项3"],
  "correct_answer": "正确的${frenchWord}形式",
  "explanation": "完整原句的准确中文翻译"
}`;
    } else {
      // 将数字年级转换为更友好的描述
      const gradeDescription = this.getGradeDescription(grade);
      
      return `你是一位经验丰富的法语教师，为${gradeDescription}学生创建一个词卡重组法语练习题。

目标单词：${frenchWord}（${meaning}）
难度级别：${difficulty}
学生水平：${gradeDescription}

**教学要求：**
- 句子必须语法正确，符合法语语法规则
- 如果${frenchWord}是动词，要使用简单的时态和变位
- 如果${frenchWord}是名词，要考虑性别和单复数
- 句子内容要贴近学生的日常生活和学习场景
- 避免生成过于复杂的句子结构

**练习题要求：**
1. 创建一个包含"${frenchWord}"的简单法语句子（5-8个单词）
2. 将句子拆分成独立的单词块
3. 提供打乱顺序的单词块列表
4. 句子要简单明了，适合${gradeDescription}学生的理解水平

**内容限制：**
- explanation字段只能包含准确且自然的中文翻译
  - 翻译要符合中文表达习惯，自然流畅
  - 避免直译和僵硬表达，如"一会儿见，我回来！"改为"一会儿见，我马上回来！"
  - 避免重复表达，如"一会儿见，我们再见！"改为"一会儿见，我们待会儿见！"
- 不要添加任何语法解释或分析
- 句子要简单实用，避免复杂语法

请严格按照以下JSON格式返回，只包含JSON：
{
  "original_sentence": "适合${gradeDescription}学生的简单法语句子",
  "word_blocks": ["单词1", "单词2", "单词3", "单词4", "单词5"],
  "shuffled_blocks": ["单词3", "单词1", "单词5", "单词2", "单词4"],
  "explanation": "准确的中文翻译"
}`;
    }
  }
  
  private async callAIAPI(config: AIConnectionConfig, request: AICompletionRequest): Promise<AICompletionResponse> {
    // 根据不同的AI提供商调整请求格式
    let requestBody: any;
    
    if (config.type === 'siliconflow') {
      // 硅基流动API格式
      requestBody = {
        model: request.model,
        messages: [
          {
            role: 'user',
            content: request.prompt
          }
        ],
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        stream: false
      };
    } else {
      // OpenAI兼容格式
      requestBody = {
        model: request.model,
        messages: [
          {
            role: 'user',
            content: request.prompt
          }
        ],
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        stream: false
      };
    }
    
    console.log(`📤 发送AI请求到: ${config.base_url}/chat/completions`);
    console.log(`📋 请求体:`, JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');
    
    const response = await httpRequest(`${config.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (response.statusCode < 200 || response.statusCode >= 300) {
      // 获取详细的错误信息
      const statusText = (response as any).statusMessage || response.statusCode.toString();
      let errorDetail = `${response.statusCode} ${statusText}`;
      try {
        const errorText = await response.body.text();
        errorDetail += ` - ${errorText}`;
      } catch (e) {
        // 忽略文本读取错误
      }
      console.error(`❌ AI API调用失败: ${errorDetail}`);
      throw new Error(`AI API调用失败: ${errorDetail}`);
    }
    
    const data = await response.body.json() as any;
    
    // 检查响应结构
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ AI返回格式异常:', JSON.stringify(data, null, 2));
      throw new Error('AI返回格式异常');
    }
    
    console.log('✅ AI响应接收完成');
    
    return {
      text: data.choices[0].message.content,
      usage: data.usage
    };
  }
  
  private parseAIResponse(aiResponse: AICompletionResponse, frenchWord: string, meaning: string, questionType: string): SentenceGenerationResponse {
    try {
      console.log('📄 AI返回内容:', aiResponse.text.substring(0, 200) + '...');
      
      // 清理AI返回内容，移除Markdown代码块标记
      const content = this.cleanAIResponse(aiResponse.text);
      
      // 首先尝试直接解析JSON
      try {
        const parsed = JSON.parse(content);
        console.log('✅ 直接JSON解析成功');

        // 根据问题类型验证关键字段
        if (questionType === 'sentence-completion') {
          // 填空练习验证
          if (!parsed.original_sentence || !parsed.modified_sentence || !parsed.options) {
            console.warn('❌ AI返回内容缺少填空练习关键字段，尝试手动提取');
            throw new Error('AI返回内容不完整');
          }
          
          console.log('📝 原句:', parsed.original_sentence);
          console.log('✏️ 填空句:', parsed.modified_sentence);
          console.log('🔢 选项:', parsed.options);
          console.log('💡 解释:', parsed.explanation?.substring(0, 100) + '...');

          // 检查选项是否有重复
          const uniqueOptions = [...new Set(parsed.options)];
          if (uniqueOptions.length < 4) {
            console.warn('⚠️ AI返回的选项有重复，重新生成选项...');
            const generatedOptions = this.generateOptionsForCompletionQuestion(parsed.original_sentence, parsed.correct_answer || frenchWord);
            parsed.options = generatedOptions;
            console.log('🔧 重新生成的选项:', generatedOptions);
          } else {
            // 打乱选项顺序
            parsed.options = this.shuffleArray(parsed.options);
          }

          return {
            original_sentence: parsed.original_sentence,
            modified_sentence: parsed.modified_sentence,
            options: parsed.options,
            correct_answer: parsed.correct_answer || frenchWord,
            explanation: parsed.explanation || `正确的形式是 ${frenchWord}，意思是${meaning}`
          };
        } else {
          // 词卡重组练习验证
          if (!parsed.original_sentence || !parsed.word_blocks || !parsed.shuffled_blocks) {
            console.warn('❌ AI返回内容缺少词卡重组关键字段，尝试手动提取');
            throw new Error('AI返回内容不完整');
          }
          
          // 验证word_blocks是否包含了原句中的所有单词
          const originalWords = parsed.original_sentence
            .replace(/[.,!?;:'"()]/g, '')
            .split(' ')
            .filter((word: string) => word && word.trim() !== '');
          
          const wordBlocksSet = new Set(parsed.word_blocks);
          const missingWords = originalWords.filter((word: string) => !wordBlocksSet.has(word));
          
          if (missingWords.length > 0) {
            console.warn(`⚠️ word_blocks缺少原句中的单词: ${missingWords.join(', ')}，自动补充`);
            // 自动补充缺失的单词到word_blocks和shuffled_blocks
            parsed.word_blocks = [...parsed.word_blocks, ...missingWords];
            parsed.shuffled_blocks = [...parsed.shuffled_blocks, ...missingWords];
            
            console.log('🔧 补充后的单词块:', parsed.word_blocks);
            console.log('🔧 补充后的打乱块:', parsed.shuffled_blocks);
          }
          
          console.log('📝 原句:', parsed.original_sentence);
          console.log('🧩 单词块:', parsed.word_blocks);
          console.log('🔀 打乱块:', parsed.shuffled_blocks);
          console.log('💡 解释:', parsed.explanation?.substring(0, 100) + '...');
          
          return {
            original_sentence: parsed.original_sentence,
            word_blocks: parsed.word_blocks,
            shuffled_blocks: parsed.shuffled_blocks,
            explanation: parsed.explanation || `正确的语序是：${parsed.original_sentence}，意思是${meaning}`
          };
        }
      } catch (jsonError) {
        console.log('⚠️ 直接JSON解析失败，尝试手动提取字段');
        
        // 直接JSON解析失败，使用手动提取
        let parsed = this.extractFieldsFromText(content, frenchWord, meaning, questionType);
        
        if (parsed) {
          console.log('✅ 手动构建JSON成功');

          // 根据问题类型验证关键字段
          if (questionType === 'sentence-completion') {
            // 填空练习验证
            if (!parsed.original_sentence || !parsed.modified_sentence || !parsed.options) {
              console.warn('❌ AI返回内容缺少填空练习关键字段，使用本地生成');
              throw new Error('AI返回内容不完整');
            }
            
            console.log('📝 原句:', parsed.original_sentence);
            console.log('✏️ 填空句:', parsed.modified_sentence);
            console.log('🔢 选项:', parsed.options);
            console.log('💡 解释:', parsed.explanation?.substring(0, 100) + '...');

            // 检查选项是否有重复
            const uniqueOptions = [...new Set(parsed.options)];
            if (uniqueOptions.length < 4) {
              console.warn('⚠️ AI返回的选项有重复，重新生成选项...');
              const generatedOptions = this.generateOptionsForCompletionQuestion(parsed.original_sentence, parsed.correct_answer || frenchWord);
              parsed.options = generatedOptions;
              console.log('🔧 重新生成的选项:', generatedOptions);
            } else {
              // 打乱选项顺序
              parsed.options = this.shuffleArray(parsed.options);
            }

            return {
              original_sentence: parsed.original_sentence,
              modified_sentence: parsed.modified_sentence,
              options: parsed.options,
              correct_answer: parsed.correct_answer || frenchWord,
              explanation: parsed.explanation || `正确的形式是 ${frenchWord}，意思是${meaning}`
            };
          } else {
            // 词卡重组练习验证
            if (!parsed.original_sentence || !parsed.word_blocks || !parsed.shuffled_blocks) {
              console.warn('❌ AI返回内容缺少词卡重组关键字段，使用本地生成');
              throw new Error('AI返回内容不完整');
            }
            
            console.log('📝 原句:', parsed.original_sentence);
            console.log('🧩 单词块:', parsed.word_blocks);
            console.log('🔀 打乱块:', parsed.shuffled_blocks);
            console.log('💡 解释:', parsed.explanation?.substring(0, 100) + '...');
            
            return {
              original_sentence: parsed.original_sentence,
              word_blocks: parsed.word_blocks,
              shuffled_blocks: parsed.shuffled_blocks,
              explanation: parsed.explanation || `正确的语序是：${parsed.original_sentence}，意思是${meaning}`
            };
          }
        }
        
        console.warn('❌ JSON解析失败，使用本地生成');
        throw new Error('AI返回内容格式错误');
      }
    } catch (error) {
      console.error('❌ AI返回内容解析失败:', error);
      throw new Error('AI响应解析失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  // 清理AI返回内容，移除Markdown代码块标记和非法控制字符
  private cleanAIResponse(text: string): string {
    // 移除常见的Markdown代码块标记
    let cleaned = text
      .replace(/```json\n?/g, '')  // 移除```json
      .replace(/```\n?/g, '')      // 移除```
      .replace(/`/g, '')           // 移除单个`
      .trim();
    
    // 移除JSON字符串中的非法控制字符（ASCII 0-31，除了\t, \n, \r）
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    
    // 优化单引号处理：将转义的单引号转换为普通单引号
    cleaned = cleaned.replace(/\\'/g, "'");
    
    // 修复JSON格式问题：添加缺失的逗号
    cleaned = cleaned
      .replace(/(\"[^\"]+\")\s*(\"[^\"]+\")/g, "$1, $2")  // 在属性之间添加逗号
      .replace(/(\"[^\"]+\")\s*\n\s*(\"[^\"]+\")/g, "$1,\n$2")  // 换行时添加逗号
      .replace(/(\"[^\"]+\")\s*\n\s*(\"[^\"]+\")/g, "$1,\n$2")  // 再次处理换行
      .replace(/(\"[^\"]+\")\s*\n\s*(\"[^\"]+\")/g, "$1,\n$2"); // 多次处理确保添加逗号
    
    // 修复数组格式
    cleaned = cleaned
      .replace(/,\s*}/g, '}')      // 修复尾随逗号
      .replace(/,\s*]/g, ']');     // 修复数组尾随逗号
    
    // 如果清理后有变化，记录日志
    if (cleaned !== text.trim()) {
      console.log('🧹 清理了Markdown标记和非法字符，清理后内容:', cleaned.substring(0, 200) + '...');
    }
    
    return cleaned;
  }
  
  // 从文本中手动提取字段构建JSON对象
  private extractFieldsFromText(text: string, frenchWord: string, meaning: string, questionType: string): any | null {
    try {
      const result: any = {};
      
      // 提取 original_sentence
      const originalMatch = text.match(/"original_sentence"\s*:\s*"([^"]+)"/) || 
                           text.match(/original_sentence[\s:]*"([^"]+)"/);
      if (originalMatch) {
        let sentence = originalMatch[1];
        // 处理转义字符：将转义的单引号恢复为正常单引号
        sentence = sentence.replace(/\\'/g, "'");
        // 移除多余的转义反斜杠
        sentence = sentence.replace(/\\\\/g, "\\");
        result.original_sentence = sentence;
      }
      
      // 提取 modified_sentence
      const modifiedMatch = text.match(/"modified_sentence"\s*:\s*"([^"]+)"/) || 
                           text.match(/modified_sentence[\s:]*"([^"]+)"/);
      if (modifiedMatch) {
        let sentence = modifiedMatch[1];
        // 处理转义字符：将转义的单引号恢复为正常单引号
        sentence = sentence.replace(/\\'/g, "'");
        // 移除多余的转义反斜杠
        sentence = sentence.replace(/\\\\/g, "\\");
        result.modified_sentence = sentence;
      }
      
      // 提取 options (数组)
      const optionsMatch = text.match(/"options"\s*:\s*\[([^\]]+)\]/) ||
                          text.match(/options[\s:]*\[([^\]]+)\]/);
      if (optionsMatch) {
      // 解析选项数组
      const optionsText = optionsMatch[1];
      const options = optionsText.split(',').map(opt => {
        let trimmedOpt = opt.trim();

        // 移除外部的引号（只移除字符串开头和结尾的引号，保留内部的法语撇号）
        const quotedMatch = trimmedOpt.match(/^"(.+)"$|^'(.+)'$/);
        if (quotedMatch) {
          trimmedOpt = quotedMatch[1] || quotedMatch[2] || trimmedOpt;
        }

        // 处理转义字符：将转义的单引号恢复为正常单引号
        trimmedOpt = trimmedOpt.replace(/\\'/g, "'");
        // 移除多余的转义反斜杠
        trimmedOpt = trimmedOpt.replace(/\\\\/g, "\\");

        return trimmedOpt;
      });

      // 确保选项唯一性
      const uniqueOptions = [...new Set(options)];
      result.options = uniqueOptions;
      }
      
      // 提取 word_blocks (数组)
      const wordBlocksMatch = text.match(/"word_blocks"\s*:\s*\[([^\]]+)\]/) ||
                              text.match(/word_blocks[\s:]*\[([^\]]+)\]/);
      if (wordBlocksMatch) {
        // 解析单词块数组
        const blocksText = wordBlocksMatch[1];
        const blocks = blocksText.split(',').map(block => {
          let trimmedBlock = block.trim();

          // 移除外部的引号（只移除字符串开头和结尾的引号，保留内部的法语撇号）
          // 匹配 "..." 或 '...' 形式的字符串
          const quotedMatch = trimmedBlock.match(/^"(.+)"$|^'(.+)'$/);
          if (quotedMatch) {
            trimmedBlock = quotedMatch[1] || quotedMatch[2] || trimmedBlock;
          }

          // 处理转义字符：将转义的单引号恢复为正常单引号
          trimmedBlock = trimmedBlock.replace(/\\'/g, "'");
          // 移除多余的转义反斜杠
          trimmedBlock = trimmedBlock.replace(/\\\\/g, "\\");

          return trimmedBlock;
        });
        result.word_blocks = blocks;
      }
      
      // 提取 shuffled_blocks (数组)
      const shuffledBlocksMatch = text.match(/"shuffled_blocks"\s*:\s*\[([^\]]+)\]/) ||
                                  text.match(/shuffled_blocks[\s:]*\[([^\]]+)\]/);
      if (shuffledBlocksMatch) {
        // 解析打乱块数组
        const blocksText = shuffledBlocksMatch[1];
        const blocks = blocksText.split(',').map(block => {
          let trimmedBlock = block.trim();

          // 移除外部的引号（只移除字符串开头和结尾的引号，保留内部的法语撇号）
          // 匹配 "..." 或 '...' 形式的字符串
          const quotedMatch = trimmedBlock.match(/^"(.+)"$|^'(.+)'$/);
          if (quotedMatch) {
            trimmedBlock = quotedMatch[1] || quotedMatch[2] || trimmedBlock;
          }

          // 处理转义字符：将转义的单引号恢复为正常单引号
          trimmedBlock = trimmedBlock.replace(/\\'/g, "'");
          // 移除多余的转义反斜杠
          trimmedBlock = trimmedBlock.replace(/\\\\/g, "\\");

          return trimmedBlock;
        });
        result.shuffled_blocks = blocks;
      }
      
      // 提取 explanation - 支持多行内容，并移除各种前缀和语法解释
      const explanationMatch = text.match(/"explanation"\s*:\s*"([^"]+)"/) || 
                               text.match(/explanation[\s:]*"([^"]+)"/) ||
                               text.match(/explanation[\s:]*"([^\n]*?)"/);
      if (explanationMatch) {
        let explanation = explanationMatch[1];
          // 简化处理：如果包含明显的语法解释，则使用默认翻译
          if (explanation.includes('正确的填空形式是') ||
            explanation.includes('语法上') ||
            explanation.includes('时态') ||
            explanation.includes('选项')) {
          explanation = questionType === 'sentence-completion'
            ? `正确的形式是 ${frenchWord}，意思是${meaning}`
            : `正确的语序是：${result.original_sentence || frenchWord}，意思是${meaning}`;
        }
        result.explanation = explanation;
      } else {
        // 如果标准匹配失败，尝试匹配多行内容
        const multilineMatch = text.match(/explanation[\s:]*([^,\n}]+)/);
        if (multilineMatch) {
          let explanation = multilineMatch[1].trim();
          // 简化处理：如果包含明显的语法解释，则使用默认翻译
          if (explanation.includes('正确的填空形式是') ||
              explanation.includes('语法上') ||
              explanation.includes('时态') ||
              explanation.includes('选项')) {
            explanation = questionType === 'sentence-completion' 
              ? `正确的形式是 ${frenchWord}，意思是${meaning}`
              : `正确的语序是：${result.original_sentence || frenchWord}，意思是${meaning}`;
          }
          result.explanation = explanation;
        }
      }
      
      // 根据问题类型验证必需字段
      if (questionType === 'sentence-completion') {
        // 填空练习验证
        if (result.original_sentence && result.modified_sentence && result.options) {
          // 设置默认值
          result.correct_answer = result.options[0] || frenchWord;
          result.explanation = result.explanation || `正确的形式是 ${frenchWord}，意思是${meaning}`;
          
          console.log('🔍 填空练习手动提取字段结果:', {
            original_sentence: result.original_sentence,
            modified_sentence: result.modified_sentence,
            options: result.options,
            explanation: result.explanation?.substring(0, 50) + '...'
          });
          
          return result;
        }
      } else {
        // 词卡重组验证
        if (result.original_sentence && result.word_blocks && result.shuffled_blocks) {
          result.explanation = result.explanation || `正确的语序是：${result.original_sentence}，意思是${meaning}`;
          
          console.log('🔍 词卡重组手动提取字段结果:', {
            original_sentence: result.original_sentence,
            word_blocks: result.word_blocks,
            shuffled_blocks: result.shuffled_blocks,
            explanation: result.explanation?.substring(0, 50) + '...'
          });
          
          return result;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('❌ 手动提取字段失败:', error);
      return null;
    }
  }
  
  // 标准化题型名称：completion -> sentence-completion, reordering -> sentence-reordering
  private normalizeQuestionType(questionType: string): 'sentence-completion' | 'sentence-reordering' {
    // 先检查是否已经是正确的长格式
    if (questionType === 'sentence-completion' || questionType === 'sentence-reordering') {
      return questionType as 'sentence-completion' | 'sentence-reordering';
    }
    // 转换短格式
    if (questionType === 'completion') {
      return 'sentence-completion';
    } else if (questionType === 'reordering') {
      return 'sentence-reordering';
    }
    // 默认返回 sentence-completion
    return 'sentence-completion';
  }

  // 为填空题生成选项（当题库中缺少选项时）
  private generateOptionsForCompletionQuestion(originalSentence: string, targetWord: string): string[] {
    // 从原句中提取所有单词作为干扰项候选
    const wordsInSentence = originalSentence
      .replace(/[.,!?;:'"()]/g, '')
      .split(' ')
      .filter(w => w && w !== targetWord && w.length > 2);

    const baseOptions: string[] = [];

    // 方法1：生成动词变位形式（适用于动词）
    const verbVariations = [
      targetWord,           // 原形
      targetWord + 's',     // 第二人称单数
      targetWord + 't',     // 第三人称单数
      targetWord + 'ons',   // 第一人称复数
      targetWord + 'ez',    // 第二人称复数
      targetWord + 'ent'    // 第三人称复数
    ];

    // 方法2：生成名词变体（适用于名词）
    const nounVariations = [
      targetWord,           // 原形
      targetWord + 'e',     // 阴性
      targetWord + 's',     // 复数
      targetWord + 'es',    // 阴性复数
      'un ' + targetWord,   // 阳性单数
      'une ' + targetWord   // 阴性单数
    ];

    // 方法3：常见法语词汇作为干扰项
    const commonDistractors = [
      'le', 'la', 'les', 'un', 'une', 'des',
      'mon', 'ton', 'son', 'ma', 'ta', 'sa',
      'ce', 'cette', 'ces',
      'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
      'est', 'suis', 'es', 'sommes', 'êtes', 'sont',
      'a', 'ai', 'as', 'avons', 'avez', 'ont'
    ];

    // 优先添加原词
    baseOptions.push(targetWord);

    // 检查是否可能是动词（通常以er、ir、re结尾）
    const isLikelyVerb = /(er|ir|re)$/.test(targetWord.toLowerCase());

    if (isLikelyVerb) {
      // 如果是动词，使用动词变位
      for (const variation of verbVariations) {
        if (variation !== targetWord && baseOptions.length < 6) {
          baseOptions.push(variation);
        }
      }
    } else {
      // 如果是名词或其他词性，使用名词变体
      for (const variation of nounVariations) {
        if (variation !== targetWord && baseOptions.length < 6) {
          baseOptions.push(variation);
        }
      }
    }

    // 从原句中提取单词作为干扰项
    for (const word of wordsInSentence) {
      if (baseOptions.length < 10) {
        baseOptions.push(word);
      }
    }

    // 如果还不够，添加常见干扰项
    for (const distractor of commonDistractors) {
      if (baseOptions.length < 12 && !baseOptions.includes(distractor)) {
        baseOptions.push(distractor);
      }
    }

    // 确保包含目标词
    if (!baseOptions.includes(targetWord)) {
      baseOptions.unshift(targetWord);
    }

    // 去重
    const uniqueOptions = [...new Set(baseOptions)];

    // 打乱并返回前4个
    const shuffled = this.shuffleArray(uniqueOptions);

    // 确保第一个是正确答案
    const options = shuffled.slice(0, 4);
    if (options[0] !== targetWord) {
      const targetIndex = options.indexOf(targetWord);
      if (targetIndex > -1) {
        [options[0], options[targetIndex]] = [options[targetIndex], options[0]];
      }
    }

    return options;
  }

  async testConnection(config: AIConnectionConfig): Promise<boolean> {
    try {
      // 真实的AI连接测试
      const response = await httpRequest(`${config.base_url}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.api_key}`
        }
      });
      
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (error) {
      console.error('AI连接测试失败:', error);
      return false;
    }
  }
  
  private generateLocally(request: SentenceGenerationRequest): SentenceGenerationResponse {
    const { frenchWord, meaning, question_type } = request;

    if (question_type === 'sentence-completion') {
      return this.generateCompletionSentence(frenchWord, meaning, request.grade, {
        sentenceLength: 'medium',
        vocabularyComplexity: 'moderate'
      });
    } else {
      return this.generateReorderingSentence(frenchWord, meaning, request.grade, {
        sentenceLength: 'medium',
        vocabularyComplexity: 'moderate'
      });
    }
  }
  
  private generateFallbackOriginal(frenchWord: string, questionType: string): string {
    if (questionType === 'sentence-completion') {
      return `Je mange une ${frenchWord}.`;
    } else {
      return `Je vais à la ${frenchWord} demain.`;
    }
  }

  private generateFallbackModified(frenchWord: string, questionType: string): string {
    if (questionType === 'sentence-completion') {
      return `Je ______ une ${frenchWord}.`;
    } else {
      return `demain vais Je la ${frenchWord} à`;
    }
  }

  private generateFallbackOptions(frenchWord: string, questionType: string): string[] {
    if (questionType === 'sentence-completion') {
      return [frenchWord, frenchWord + 's', frenchWord + 't', frenchWord + 'ons'];
    } else {
      return [
        `Je vais à la ${frenchWord} demain`,
        `vais Je à la ${frenchWord} demain`,
        `demain Je vais à la ${frenchWord}`,
        `Je la vais à ${frenchWord} demain`
      ];
    }
  }
  
  private generateCompletionSentence(frenchWord: string, meaning: string, grade: number, difficulty: any): SentenceGenerationResponse {
    // 根据年级和难度生成更丰富的句子模板
    const sentenceTemplates = this.getSentenceTemplates(frenchWord, grade, difficulty);
    
    const randomTemplate = sentenceTemplates[Math.floor(Math.random() * sentenceTemplates.length)];
    
    // 生成干扰项（动词变位）
    const options = this.generateVerbOptions(frenchWord, randomTemplate.correctForm);
    
    // 生成完整的句子
    const originalSentence = randomTemplate.template.replace('______', randomTemplate.correctForm);
    
    return {
      original_sentence: originalSentence,
      modified_sentence: randomTemplate.template,
      options,
      correct_answer: randomTemplate.correctForm,
      explanation: `${randomTemplate.explanation}，意思是${meaning}`
    };
  }
  
  private getSentenceTemplates(frenchWord: string, grade: number, difficulty: string): any[] {
    // 基础句子模板 - 使用自然法语句子，不再直接插入 ${frenchWord}
    const baseTemplates = [
      {
        template: `Je ______ une pomme.`,
        correctForm: frenchWord,
        explanation: `第一人称单数：Je ${frenchWord} (${frenchWord} 的现在时形式)`
      },
      {
        template: `Tu ______ français à l'école.`,
        correctForm: frenchWord + 's',
        explanation: `第二人称单数：Tu ${frenchWord}s (${frenchWord} 的第二人称单数形式)`
      },
      {
        template: `Il ______ son livre.`,
        correctForm: frenchWord + 't',
        explanation: `第三人称单数：Il ${frenchWord}t (${frenchWord} 的第三人称单数形式)`
      },
      {
        template: `Nous ______ des devoirs.`,
        correctForm: frenchWord + 'ons',
        explanation: `第一人称复数：Nous ${frenchWord}ons (${frenchWord} 的第一人称复数形式)`
      },
      {
        template: `Vous ______ la leçon.`,
        correctForm: frenchWord + 'ez',
        explanation: `第二人称复数：Vous ${frenchWord}ez (${frenchWord} 的第二人称复数形式)`
      },
      {
        template: `Ils ______ des exercices.`,
        correctForm: frenchWord + 'ent',
        explanation: `第三人称复数：Ils ${frenchWord}ent (${frenchWord} 的第三人称复数形式)`
      }
    ];
    
    // 根据年级和难度添加更丰富的句子模板
    const advancedTemplates = [
      {
        template: `Je veux ______ demain.`,
        correctForm: frenchWord,
        explanation: `第一人称单数 + 将来时：Je veux ${frenchWord} (想${frenchWord})`
      },
      {
        template: `Nous devons ______ ensemble.`,
        correctForm: frenchWord + 'ons',
        explanation: `第一人称复数 + 义务：Nous devons ${frenchWord}ons (必须${frenchWord})`
      },
      {
        template: `Il faut que tu ______ maintenant.`,
        correctForm: frenchWord + 's',
        explanation: `第二人称单数 + 虚拟式：Il faut que tu ${frenchWord}s (必须${frenchWord})`
      },
      {
        template: `Les enfants aiment ______ dans le parc.`,
        correctForm: frenchWord,
        explanation: `第三人称复数 + 爱好：Les enfants aiment ${frenchWord} (喜欢${frenchWord})`
      },
      {
        template: `Je peux ______ avec toi.`,
        correctForm: frenchWord,
        explanation: `第一人称单数 + 能力：Je peux ${frenchWord} (可以${frenchWord})`
      },
      {
        template: `Elle va ______ ce soir.`,
        correctForm: frenchWord,
        explanation: `第三人称单数 + 将来时：Elle va ${frenchWord} (将要${frenchWord})`
      },
      {
        template: `Nous allons ______ après l'école.`,
        correctForm: frenchWord,
        explanation: `第一人称复数 + 将来时：Nous allons ${frenchWord} (将要${frenchWord})`
      },
      {
        template: `Tu dois ______ tes devoirs.`,
        correctForm: frenchWord,
        explanation: `第二人称单数 + 义务：Tu dois ${frenchWord} (必须${frenchWord})`
      },
      {
        template: `Ils peuvent ______ rapidement.`,
        correctForm: frenchWord,
        explanation: `第三人称复数 + 能力：Ils peuvent ${frenchWord} (可以${frenchWord})`
      },
      {
        template: `J'aime ______ le matin.`,
        correctForm: frenchWord,
        explanation: `第一人称单数 + 爱好：J'aime ${frenchWord} (喜欢${frenchWord})`
      }
    ];
    
    // 根据难度选择模板
    if (difficulty === 'easy' || grade <= 7) {
      return baseTemplates;
    } else if (difficulty === 'medium' || grade <= 8) {
      return [...baseTemplates, ...advancedTemplates.slice(0, 5)];
    } else {
      // 困难模式或高年级使用所有模板
      return [...baseTemplates, ...advancedTemplates];
    }
  }
  
  private generateVerbOptions(baseWord: string, correctForm: string): string[] {
    // 生成动词变位选项 - 基于目标单词的变位形式
    const verbForms = [
      baseWord,           // 原形
      baseWord + 's',     // 第二人称单数
      baseWord + 't',     // 第三人称单数
      baseWord + 'ons',   // 第一人称复数
      baseWord + 'ez',    // 第二人称复数
      baseWord + 'ent'    // 第三人称复数
    ];
    
    // 确保包含正确答案
    const options = [correctForm];
    
    // 添加其他干扰项，但不重复正确答案
    for (const form of verbForms) {
      if (form !== correctForm && options.length < 4) {
        options.push(form);
      }
    }
    
    // 打乱顺序
    return this.shuffleArray(options);
  }
  
  private generateCompletionOptions(word: string, difficulty: 'easy' | 'medium' | 'hard'): string[] {
    const options = [word];
    
    // 根据难度生成干扰项
    if (difficulty === 'easy') {
      options.push('manger', 'boire', 'parler', 'écouter');
    } else if (difficulty === 'medium') {
      options.push('mange', 'manges', 'mangeons', 'mangent');
    } else {
      // 更复杂的变体
      options.push('mangerais', 'mangerai', 'mangeais', 'mangeait');
    }
    
    // 随机排序并取前4个
    return options.sort(() => Math.random() - 0.5).slice(0, 4);
  }
  
  private generateReorderingSentence(frenchWord: string, meaning: string, grade: number, difficulty: any): SentenceGenerationResponse {
    // 生成包含目标单词的简单句子
    const sentences = [
      `Je vais à la ${frenchWord} demain`,
      `J'aime la ${frenchWord} de mon école`,
      `La ${frenchWord} est très belle`,
      `Nous visitons la ${frenchWord} ensemble`,
      `Tu connais cette ${frenchWord} ?`
    ];
    
    const originalSentence = sentences[Math.floor(Math.random() * sentences.length)];
    
    // 将句子拆分成单词块
    const wordBlocks = originalSentence.split(' ');
    const shuffledBlocks = this.shuffleArray([...wordBlocks]);
    
    return {
      original_sentence: originalSentence,
      word_blocks: wordBlocks,
      shuffled_blocks: shuffledBlocks,
      explanation: `正确的语序是："${originalSentence}"，意思是${meaning}`
    };
  }
  
  private generateReorderingOptions(parts: string[]): string[] {
    const options: string[] = [];
    
    // 确保包含正确答案
    options.push(parts.join(' '));
    
    // 生成不同顺序的选项
    for (let i = 0; i < 3; i++) {
      const shuffled = this.shuffleArray([...parts]);
      options.push(shuffled.join(' '));
    }
    
    // 打乱选项顺序
    return this.shuffleArray(options);
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

  // 修复题目数据（异步执行，不影响当前返回）
  private async fixQuestionData(questionId: number, correctQuestionType: string, generatedOptions?: string[]): Promise<void> {
    try {
      const client = await pool.connect();
      
      // 更新数据库中的题型标记
      await client.query(
        'UPDATE ai_generated_questions SET question_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [correctQuestionType, questionId]
      );
      
      // 如果是填空题且生成了选项，更新options字段
      if (correctQuestionType === 'sentence-completion' && generatedOptions) {
        await client.query(
          'UPDATE ai_generated_questions SET options = $1 WHERE id = $2',
          [generatedOptions, questionId]
        );
      }
      
      client.release();
      console.log(`✅ 已修复题目ID ${questionId} 的题型标记为: ${correctQuestionType}`);
    } catch (error) {
      console.warn('⚠️ 修复题目数据失败:', error);
      // 修复失败不影响正常使用
    }
  }

  // AI查词方法
  async lookupWord(word: string, connection?: AIConnectionConfig): Promise<WordLookupResponse> {
    try {
      console.log(`🔍 开始AI查词: ${word}`);

      // 获取AI配置
      let aiConfig: AIConnectionConfig | null = null;

      // 优先使用传入的用户AI配置
      if (connection && connection.enabled) {
        aiConfig = connection;
        console.log(`使用用户AI配置: ${aiConfig.name} (${aiConfig.type})`);
      } else {
        // 如果没有用户配置，使用系统默认配置
        aiConfig = await this.getSystemDefaultAIConfig();
        if (aiConfig) {
          console.log(`使用系统默认AI配置: ${aiConfig.name} (${aiConfig.type})`);
        } else {
          throw new Error('未配置有效的AI API');
        }
      }

      // 构建AI提示词
      const prompt = this.buildWordLookupPrompt(word);
      console.log('📝 AI查词提示词构建完成');

      // 调用AI API
      const aiResponse = await this.callAIAPI(aiConfig, {
        prompt,
        model: aiConfig.model,
        max_tokens: aiConfig.max_tokens || 500,
        temperature: aiConfig.temperature || 0.3
      });

      console.log('✅ AI查词API调用成功');

      // 解析AI返回的内容
      const result = this.parseWordLookupResponse(aiResponse, word);
      console.log('📄 AI查词内容解析完成');

      return result;
    } catch (error) {
      console.error('❌ AI查词失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`AI查词失败: ${errorMessage}`);
    }
  }

  // 构建查词的AI提示词
  private buildWordLookupPrompt(word: string): string {
    return `你是一位专业的法语教师，请为用户提供单词"${word}"的详细信息。

**重要提示：**
- 如果输入的是中文单词，请先将其翻译为法语，然后提供法语单词的详细信息
- 如果输入的是英语或其他语言单词，请先将其翻译为法语，然后提供法语单词的详细信息
- 如果输入的是法语单词，直接提供该单词的详细信息

请严格按照以下JSON格式返回，只包含JSON：
{
  "french": "法语单词（如果是中文/英文输入，这里是翻译后的法语单词）",
  "chinese": "单词的中文释义（如果有多个含义，用分号分隔）",
  "phonetic": "单词的法语音标",
  "part_of_speech": "词性格式要求：中文词性+空格+法语缩写（如：阴性名词 n.f.，阳性名词 n.m.，动词 v.，形容词 adj.，副词 adv.）",
  "examples": ["例句1（法语句子的中文翻译）", "例句2（法语句子的中文翻译）"]
}

要求：
1. 如果输入是中文/英文，先进行准确的法语翻译
2. 中文释义要准确、完整
3. 音标要准确
4. 词性必须按照"中文词性+空格+法语缩写"的格式返回，例如：
   - 阴性名词 n.f.
   - 阳性名词 n.m.
   - 动词 v.
   - 形容词 adj.
   - 副词 adv.
5. 提供至少2个实用的例句，例句格式为：法语句子（中文翻译）
6. **例句必须包含完整的中文翻译，格式为：法语句子（中文翻译）**
7. **中文翻译必须准确、自然，避免直译和生硬表达**
8. **如果AI无法生成中文翻译，请提供法语句子，我将在前端处理翻译问题**`;
  }

  // 解析查词的AI响应
  private parseWordLookupResponse(aiResponse: AICompletionResponse, word: string): WordLookupResponse {
    console.log('📄 AI返回内容:', aiResponse.text.substring(0, 200) + '...');

    // 清理AI返回内容，移除Markdown代码块标记
    const content = this.cleanAIResponse(aiResponse.text);

    try {
      // 尝试解析JSON
      const parsed = JSON.parse(content);
      console.log('✅ 查词JSON解析成功');

      return {
        french: parsed.french || word,
        chinese: parsed.chinese || '',
        phonetic: parsed.phonetic || '',
        part_of_speech: parsed.part_of_speech || '',
        examples: parsed.examples || []
      };
    } catch (jsonError) {
      console.log('⚠️ 直接JSON解析失败，尝试手动提取字段');

      // 手动提取字段
      let parsed: any = {};

      const originalMatch = content.match(/"french"\s*:\s*"([^"]+)"/) ||
                           content.match(/french[\s:]*"([^"]+)"/);
      if (originalMatch) {
        parsed.french = originalMatch[1];
      }

      const chineseMatch = content.match(/"chinese"\s*:\s*"([^"]+)"/) ||
                           content.match(/chinese[\s:]*"([^"]+)"/);
      if (chineseMatch) {
        parsed.chinese = chineseMatch[1];
      }

      const phoneticMatch = content.match(/"phonetic"\s*:\s*"([^"]+)"/) ||
                            content.match(/phonetic[\s:]*"([^"]+)"/);
      if (phoneticMatch) {
        parsed.phonetic = phoneticMatch[1];
      }

      const partOfSpeechMatch = content.match(/"part_of_speech"\s*:\s*"([^"]+)"/) ||
                                content.match(/part_of_speech[\s:]*"([^"]+)"/);
      if (partOfSpeechMatch) {
        parsed.part_of_speech = partOfSpeechMatch[1];
      }

      const examplesMatch = content.match(/"examples"\s*:\s*\[([^\]]+)\]/) ||
                          content.match(/examples[\s:]*\[([^\]]+)\]/);
      if (examplesMatch) {
        const examplesText = examplesMatch[1];
        parsed.examples = examplesText.split(',').map((ex: string) => ex.trim().replace(/^"|"$/g, ''));
      }

      if (parsed.french && parsed.chinese) {
        console.log('✅ 手动提取字段成功');
        return {
          french: parsed.french,
          chinese: parsed.chinese,
          phonetic: parsed.phonetic || '',
          part_of_speech: parsed.part_of_speech || '',
          examples: parsed.examples || []
        };
      }

      console.warn('❌ JSON解析失败');
      throw new Error('AI返回内容格式错误');
    }
  }

  // AI造句 - 生成包含指定单词的句子
  async generateSentences(request: any, connection?: AIConnectionConfig): Promise<any> {
    const { word, meaning, frenchWord, grade, partOfSpeech } = request;

    try {
      console.log(`🔍 开始AI造句: ${frenchWord} (${meaning})`);

      // 获取AI配置
      let aiConfig: AIConnectionConfig | null = null;

      // 优先使用传入的用户AI配置
      if (connection && connection.enabled) {
        aiConfig = connection;
        console.log(`使用用户AI配置生成句子: ${aiConfig.name} (${aiConfig.type})`);
      } else {
        // 如果没有用户配置，使用系统默认配置
        aiConfig = await this.getSystemDefaultAIConfig();
        if (aiConfig) {
          console.log(`使用系统默认AI配置生成句子: ${aiConfig.name} (${aiConfig.type})`);
        } else {
          throw new Error('未配置有效的AI API');
        }
      }

      // 构建AI提示词 - 要求生成完整的题目数据
      const prompt = this.buildSentenceGenerationPrompt(frenchWord, meaning, grade, partOfSpeech);
      console.log('📝 AI造句提示词构建完成');

      // 调用AI API
      const aiResponse = await this.callAIAPI(aiConfig, {
        prompt,
        model: aiConfig.model,
        max_tokens: aiConfig.max_tokens || 1200,
        temperature: aiConfig.temperature || 0.3
      });

      console.log('✅ AI造句API调用成功');

      // 解析AI返回的内容
      const result = this.parseSentenceGenerationResponse(aiResponse, frenchWord, meaning);
      console.log('📄 AI造句内容解析完成');

      // 将生成的句子保存到数据库，包括词卡重组和填空两种格式
      await this.saveSentencesToDatabase(result.sentences, word, frenchWord, meaning, grade, partOfSpeech);
      console.log('💾 句子已保存到数据库');

      return result;
    } catch (error) {
      console.error('❌ AI造句失败:', error);
      throw new Error('AI生成句子失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  // 构建造句的AI提示词
  private buildSentenceGenerationPrompt(frenchWord: string, meaning: string, grade: number, partOfSpeech?: string): string {
    const gradeDescription = getGradeDescription(grade);
    const partOfSpeechText = partOfSpeech ? `，词性为${partOfSpeech}` : '';

    // 检查单词是否包含性别标记（如 "lourd, e" 或 "grand, e"）
    const hasGenderMarker = frenchWord.includes(', ');
    const genderInstruction = hasGenderMarker
      ? `\n**特别注意**：单词"${frenchWord}"包含性别标记，表示它有阳性形式（去掉 ", e" 部分）和阴性形式（阳性形式 + "e"）。\n在生成句子时，请根据句子的语法和语境选择正确的形式：\n- 如果修饰阳性名词，使用阳性形式\n- 如果修饰阴性名词，使用阴性形式\n- 不要在句子中直接包含 ", e" 这样的标记`
      : '';

    return `你是一位专业的法语教师，请为法语单词"${frenchWord}"（中文意思：${meaning}${partOfSpeechText}）生成两个实用的法语句子，并为每个句子创建词卡重组和填空两种练习形式。
${genderInstruction}

要求：
1. 句子要自然、实用，语法正确
2. 句子难度要适合${gradeDescription}的学生
3. 每个句子都要提供准确且自然的中文翻译，避免直译和僵硬表达
   - 翻译要符合中文表达习惯，自然流畅
   - 避免"一会儿见，我回来！"这样的直译，改为"一会儿见，我马上回来！"或"待会儿见，我很快就回来！"
   - 避免"一会儿见，我们再见！"这样的重复表达，改为"一会儿见，我们待会儿见！"或"待会儿见，我们等会儿见！"
4. 为每个句子创建：
   - 词卡重组练习：将句子拆分成单词块，并打乱顺序
   - 填空练习：将目标单词替换为空白，并提供干扰选项

请严格按照以下JSON格式返回，只包含JSON：
{
  "sentences": [
    {
      "french": "第一个法语句子",
      "chinese": "第一个句子的中文翻译",
      "word_blocks": ["单词块1", "单词块2", "单词块3"],
      "shuffled_blocks": ["打乱后的单词块1", "打乱后的单词块2", "打乱后的单词块3"],
      "modified_sentence": "包含空白的句子，如：Je mange une _____.",
      "options": ["正确选项", "干扰项1", "干扰项2", "干扰项3"],
      "correct_answer": "句子中实际使用的单词形式（不是${frenchWord}）",
      "explanation": "句子用法说明"
    },
    {
      "french": "第二个法语句子", 
      "chinese": "第二个句子的中文翻译",
      "word_blocks": ["单词块1", "单词块2", "单词块3"],
      "shuffled_blocks": ["打乱后的单词块1", "打乱后的单词块2", "打乱后的单词块3"],
      "modified_sentence": "包含空白的句子",
      "options": ["正确选项", "干扰项1", "干扰项2", "干扰项3"],
      "correct_answer": "句子中实际使用的单词形式（不是${frenchWord}）",
      "explanation": "句子用法说明"
    }
  ]
}`;
  }

  // 解析造句的AI响应
  private parseSentenceGenerationResponse(aiResponse: AICompletionResponse, frenchWord: string, meaning: string): any {
    console.log('📄 AI返回内容:', aiResponse.text.substring(0, 200) + '...');

    // 清理AI返回内容，移除Markdown代码块标记
    const content = this.cleanAIResponse(aiResponse.text);

    try {
      // 尝试解析JSON
      const parsed = JSON.parse(content);
      console.log('✅ 造句JSON解析成功');

      // 验证返回的数据结构
      if (!parsed.sentences || !Array.isArray(parsed.sentences) || parsed.sentences.length === 0) {
        throw new Error('AI返回的句子数据格式不正确');
      }

      // 确保每个句子都包含必要的字段
      const validSentences = parsed.sentences.filter((sentence: any) =>
        sentence.french && sentence.chinese
      );

      if (validSentences.length === 0) {
        throw new Error('AI返回的句子缺少必要字段');
      }

      // 验证每个句子是否包含完整的练习数据
      const enhancedSentences = validSentences.slice(0, 2).map((sentence: any) => {
        // 验证句子是否包含所有必要的数据
        if (!sentence.word_blocks || !sentence.shuffled_blocks || !sentence.modified_sentence || !sentence.options) {
          console.error('❌ AI返回的句子数据不完整:', JSON.stringify(sentence, null, 2));
          throw new Error('AI返回的句子数据不完整，缺少必要的练习字段');
        }

        // 创建完整的句子对象
        const enhancedSentence = {
          french: sentence.french,
          chinese: sentence.chinese,
          word_blocks: sentence.word_blocks,
          shuffled_blocks: sentence.shuffled_blocks,
          modified_sentence: sentence.modified_sentence,
          options: sentence.options,
          correct_answer: sentence.correct_answer || frenchWord
        };

        return enhancedSentence;
      });

      return {
        sentences: enhancedSentences
      };
    } catch (jsonError) {
      console.log('⚠️ 直接JSON解析失败，尝试手动提取字段');

      // 手动提取字段
      const sentencesMatch = content.match(/"sentences"\s*:\s*\[([^\]]+)\]/) ||
                           content.match(/sentences[\s:]*\[([^\]]+)\]/);

      if (sentencesMatch) {
        const sentencesText = sentencesMatch[1];
        // 尝试解析句子数组
        const sentenceMatches = sentencesText.match(/\{[^}]+\}/g);

        if (sentenceMatches && sentenceMatches.length > 0) {
          const sentences = sentenceMatches.slice(0, 2).map((sentenceStr: string) => {
            const frenchMatch = sentenceStr.match(/"french"\s*:\s*"([^"]+)"/) ||
                               sentenceStr.match(/french[\s:]*"([^"]+)"/);
            const chineseMatch = sentenceStr.match(/"chinese"\s*:\s*"([^"]+)"/) ||
                               sentenceStr.match(/chinese[\s:]*"([^"]+)"/);

            const frenchSentence = frenchMatch ? frenchMatch[1] : '';
            const chineseTranslation = chineseMatch ? chineseMatch[1] : '';

            // 验证手动提取的数据是否完整
            if (!frenchSentence || !chineseTranslation) {
              console.error('❌ 手动提取的句子数据不完整:', { frenchSentence, chineseTranslation });
              throw new Error('手动提取句子数据失败，无法生成完整的练习数据');
            }

            // 由于无法使用本地方法生成练习数据，需要确保AI返回了所有必要的数据
            console.error('❌ 无法手动生成练习数据，需要AI返回完整的JSON格式');
            throw new Error('AI返回格式不符合要求，无法生成练习题目');
          }).filter((sentence: any) => sentence.french && sentence.chinese);

          if (sentences.length > 0) {
            console.log('✅ 手动提取句子字段成功');
            return { sentences };
          }
        }
      }

      console.warn('❌ JSON解析失败，使用本地生成');
      throw new Error('AI返回内容格式错误');
    }
  }

  // 保存句子到数据库（简化版：专注于基础数据保存，智能复用由新服务处理）
  private async saveSentencesToDatabase(sentences: any[], wordId: string, frenchWord: string, meaning: string, grade: number, partOfSpeech?: string): Promise<void> {
    try {
      console.log(`📝 准备保存 ${sentences.length} 个句子到数据库`);

      const questionsToSave = sentences.map((sentence, index) => {
        console.log(`📄 处理句子 ${index + 1}: ${sentence.french}`);

        // 验证句子数据是否完整
        if (!sentence.word_blocks || !sentence.shuffled_blocks || !sentence.modified_sentence || !sentence.options) {
          console.error(`❌ 句子 ${index + 1} 数据不完整，跳过保存:`);
          console.error('  - word_blocks:', sentence.word_blocks);
          console.error('  - shuffled_blocks:', sentence.shuffled_blocks);
          console.error('  - modified_sentence:', sentence.modified_sentence);
          console.error('  - options:', sentence.options);
          return []; // 跳过不完整的数据
        }

        // 使用AI返回的完整数据
        const wordBlocks = sentence.word_blocks;
        const shuffledBlocks = sentence.shuffled_blocks;
        const correctAnswer = sentence.correct_answer || frenchWord;
        const modifiedSentence = sentence.modified_sentence;
        const options = sentence.options;

        console.log(`  - correctAnswer: ${correctAnswer}`);
        console.log(`  - wordBlocks: ${JSON.stringify(wordBlocks)}`);
        console.log(`  - options: ${JSON.stringify(options)}`);

        return [
          // 词卡重组题目
          {
            wordId,
            questionType: 'sentence-reordering',
            word: frenchWord,
            meaning,
            grade,
            difficulty: 'medium',
            originalSentence: sentence.french,
            modifiedSentence: sentence.french,
            wordBlocks,
            shuffledBlocks,
            options: [],
            correctAnswer: sentence.french,
            explanation: sentence.chinese
          },
          // 填空题目
          {
            wordId,
            questionType: 'sentence-completion',
            word: frenchWord,
            meaning,
            grade,
            difficulty: 'medium',
            originalSentence: sentence.french,
            modifiedSentence,
            wordBlocks: [],
            shuffledBlocks: [],
            options,
            correctAnswer: correctAnswer,
            explanation: sentence.chinese
          }
        ];
      }).flat();

      console.log(`📊 准备保存 ${questionsToSave.length} 个题目到数据库`);

      // 批量保存到数据库
      const savedIds = await aiQuestionCacheQueries.saveQuestionsBatch(questionsToSave);
      console.log(`✅ 成功保存 ${savedIds.length} 个题目到数据库，IDs: ${savedIds.join(', ')}`);
    } catch (error) {
      console.error('❌ 保存句子到数据库失败:', error);
      console.error('❌ 错误详情:', error instanceof Error ? error.stack : String(error));
      // 不抛出错误，避免影响主流程
    }
  }






}

// 导出单例实例
export const aiService = new AIServiceImpl();