import { AIConnectionConfig, SentenceGenerationRequest, SentenceGenerationResponse, AIService, AICompletionRequest, AICompletionResponse } from '../types/ai';

// 动态导入node-fetch，避免类型检查错误
import fetch from 'node-fetch';

export class AIServiceImpl implements AIService {
  async generateSentenceQuestion(request: SentenceGenerationRequest, connection?: AIConnectionConfig): Promise<SentenceGenerationResponse> {
    // 优先使用AI生成，如果失败则回退到本地生成
    try {
      // 优先使用传入的用户AI配置
      if (connection && connection.enabled) {
        console.log(`使用用户AI配置: ${connection.name} (${connection.type})`);
        const aiResult = await this.generateWithAI(connection, request);
        console.log('AI生成成功，返回AI生成的内容');
        return aiResult;
      }
      
      // 如果没有用户配置，使用默认配置
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'your-openai-api-key-here') {
        console.warn('⚠️ 未配置有效的AI API密钥，请检查环境变量或配置AI连接');
        console.warn('当前使用本地生成，句子多样性有限');
        return this.generateLocally(request);
      }
      
      // 使用默认的AI配置
      const defaultConnection: AIConnectionConfig = {
        id: 'default',
        user_id: 0,
        name: '默认AI连接',
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
      
      console.log('使用默认AI配置');
      const aiResult = await this.generateWithAI(defaultConnection, request);
      console.log('AI生成成功，返回AI生成的内容');
      return aiResult;
    } catch (error) {
      console.warn('❌ AI生成失败，使用本地生成:', error);
      console.warn('当前使用本地生成，句子多样性有限');
      // 回退到本地生成
      return this.generateLocally(request);
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
    console.log('📊 AI返回内容解析完成');
    
    return result;
  }
  
  private buildAIPrompt(frenchWord: string, meaning: string, grade: number, difficulty: string, questionType: string): string {
    if (questionType === 'completion') {
      return `为初中${grade}年级学生创建一个法语填空练习题。

单词：${frenchWord}（${meaning}）
难度：${difficulty}

要求：
1. 创建一个包含"${frenchWord}"的法语句子
2. 将"${frenchWord}"替换为下划线"______"
3. 提供4个选项，第一个是正确答案
4. explanation字段必须只包含完整原句的中文翻译

**严格限制：**
- explanation字段只能包含完整原句的中文翻译，不能有任何其他内容
- 不要添加任何语法解释、填空说明、练习题分析或其他文字
- 如果添加额外内容，将被视为错误
- **4个选项必须完全不相同，不能有任何重复答案**

请严格按照以下JSON格式返回，只包含JSON，不要有其他文字：
{
  "original_sentence": "完整的法语句子",
  "modified_sentence": "将${frenchWord}替换为下划线后的句子",
  "options": ["正确的${frenchWord}形式", "干扰项1", "干扰项2", "干扰项3"],
  "correct_answer": "正确的${frenchWord}形式",
  "explanation": "完整原句的中文翻译"
}`;
    } else {
      return `你是一位法语语法专家，为初中${grade}年级学生创建一个语法正确的词卡重组法语练习题。

目标单词：${frenchWord}（${meaning}）
难度：${difficulty}

**重要语法要求：**
- 句子必须语法正确，符合法语语法规则
- 如果${frenchWord}是动词，要使用正确的时态和变位
- 如果${frenchWord}是名词，要考虑性别和单复数
- 如果${frenchWord}是代词或介词，要放在正确的位置
- 避免生成类似"Nous avons des au revoir"这样的语法错误句子

**练习题要求：**
1. 创建一个包含"${frenchWord}"的语法正确的法语句子（5-8个单词）
2. 将句子拆分成独立的单词块
3. 提供打乱顺序的单词块列表
4. explanation字段必须只包含完整原句的准确中文翻译

**严格限制：**
- explanation字段只能包含准确的中文翻译，不能有任何其他内容
- 不要添加任何语法解释、填空说明、练习题分析或其他文字
- 如果添加额外内容，将被视为错误
- 句子必须语法正确，简单明了，适合初中${grade}年级学生

请严格按照以下JSON格式返回，只包含JSON，不要有其他文字：
{
  "original_sentence": "语法正确的句子语序",
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
    
    const response = await fetch(`${config.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      // 获取详细的错误信息
      let errorDetail = `${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorDetail += ` - ${JSON.stringify(errorData)}`;
      } catch (e) {
        // 忽略JSON解析错误
      }
      console.error(`❌ AI API调用失败: ${errorDetail}`);
      throw new Error(`AI API调用失败: ${errorDetail}`);
    }
    
    const data = await response.json();
    
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
        if (questionType === 'completion') {
          // 填空练习验证
          if (!parsed.original_sentence || !parsed.modified_sentence || !parsed.options) {
            console.warn('❌ AI返回内容缺少填空练习关键字段，尝试手动提取');
            throw new Error('AI返回内容不完整');
          }
          
          console.log('📝 原句:', parsed.original_sentence);
          console.log('✏️ 填空句:', parsed.modified_sentence);
          console.log('🔢 选项:', parsed.options);
          console.log('💡 解释:', parsed.explanation?.substring(0, 100) + '...');
          
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
          if (questionType === 'completion') {
            // 填空练习验证
            if (!parsed.original_sentence || !parsed.modified_sentence || !parsed.options) {
              console.warn('❌ AI返回内容缺少填空练习关键字段，使用本地生成');
              throw new Error('AI返回内容不完整');
            }
            
            console.log('📝 原句:', parsed.original_sentence);
            console.log('✏️ 填空句:', parsed.modified_sentence);
            console.log('🔢 选项:', parsed.options);
            console.log('💡 解释:', parsed.explanation?.substring(0, 100) + '...');
            
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
      console.warn('❌ AI返回内容解析失败:', error);
      
      // 如果解析失败，使用本地生成
      return this.generateLocally({
        word: '',
        meaning,
        frenchWord,
        grade: 81,
        difficulty: 'medium',
        question_type: questionType as any
      });
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
    
    // 修复法语引号转义问题 - 在JSON字符串中，引号需要转义为 \'
    cleaned = cleaned.replace(/(\w)'(\w)/g, "$1\\'$2");
    
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
      const options = optionsText.split(',').map(opt => opt.trim().replace(/["']/g, ''));
      
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
          // 处理转义字符：将转义的单引号恢复为正常单引号
          trimmedBlock = trimmedBlock.replace(/\\'/g, "'");
          // 移除多余的转义反斜杠
          trimmedBlock = trimmedBlock.replace(/\\\\/g, "\\");
          // 移除引号
          trimmedBlock = trimmedBlock.replace(/["']/g, '');
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
          // 处理转义字符：将转义的单引号恢复为正常单引号
          trimmedBlock = trimmedBlock.replace(/\\'/g, "'");
          // 移除多余的转义反斜杠
          trimmedBlock = trimmedBlock.replace(/\\\\/g, "\\");
          // 移除引号
          trimmedBlock = trimmedBlock.replace(/["']/g, '');
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
          explanation = questionType === 'completion' 
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
            explanation = questionType === 'completion' 
              ? `正确的形式是 ${frenchWord}，意思是${meaning}`
              : `正确的语序是：${result.original_sentence || frenchWord}，意思是${meaning}`;
          }
          result.explanation = explanation;
        }
      }
      
      // 根据问题类型验证必需字段
      if (questionType === 'completion') {
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
  
  async testConnection(config: AIConnectionConfig): Promise<boolean> {
    try {
      // 真实的AI连接测试
      const response = await fetch(`${config.base_url}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.api_key}`
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('AI连接测试失败:', error);
      return false;
    }
  }
  
  private generateLocally(request: SentenceGenerationRequest): SentenceGenerationResponse {
    const { frenchWord, meaning, question_type } = request;
    
    if (question_type === 'completion') {
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
    if (questionType === 'completion') {
      return `Je mange une ${frenchWord}.`;
    } else {
      return `Je vais à la ${frenchWord} demain.`;
    }
  }
  
  private generateFallbackModified(frenchWord: string, questionType: string): string {
    if (questionType === 'completion') {
      return `Je ______ une ${frenchWord}.`;
    } else {
      return `demain vais Je la ${frenchWord} à`;
    }
  }
  
  private generateFallbackOptions(frenchWord: string, questionType: string): string[] {
    if (questionType === 'completion') {
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
}

// 导出单例实例
export const aiService = new AIServiceImpl();