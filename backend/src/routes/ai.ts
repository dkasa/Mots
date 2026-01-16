import express from 'express';
import { aiConnectionQueries, questionRatingQueries, pool } from '../database/postgresql';
import { aiService } from '../services/aiService';
import { authenticateToken } from '../utils/auth';
import { AIConnectionConfig } from '../types/ai';

const router: express.Router = express.Router();

// 获取用户的所有AI连接配置
router.get('/connections', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const connections = await aiConnectionQueries.findByUserId(userId);
    
    res.json({
      success: true,
      data: connections
    });
  } catch (error) {
    console.error('获取AI连接配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取AI连接配置失败'
    });
  }
});

// 创建AI连接配置
router.post('/connections', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      name,
      type,
      baseUrl,
      apiKey,
      model,
      maxTokens,
      temperature,
      enabled
    } = req.body;

    // 验证必填字段
    if (!name || !type || !baseUrl || !apiKey || !model) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：name, type, baseUrl, apiKey, model'
      });
    }

    // 验证类型
    if (!['openai', 'siliconflow'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type必须是 openai 或 siliconflow'
      });
    }

    const connectionId = await aiConnectionQueries.create({
      userId,
      name,
      type,
      baseUrl,
      apiKey,
      model,
      maxTokens,
      temperature,
      enabled
    });

    res.json({
      success: true,
      data: { id: connectionId }
    });
  } catch (error) {
    console.error('创建AI连接配置失败:', error);
    res.status(500).json({
      success: false,
      message: '创建AI连接配置失败'
    });
  }
});

// 更新AI连接配置
router.put('/connections/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const connectionId = parseInt(req.params.id);
    
    // 验证配置是否存在且属于当前用户
    const existingConnection = await aiConnectionQueries.findById(connectionId);
    if (!existingConnection || existingConnection.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'AI连接配置不存在'
      });
    }

    const {
      name,
      baseUrl,
      apiKey,
      model,
      maxTokens,
      temperature,
      enabled
    } = req.body;

    await aiConnectionQueries.update(connectionId, {
      name,
      baseUrl,
      apiKey,
      model,
      maxTokens,
      temperature,
      enabled
    });

    res.json({
      success: true,
      message: 'AI连接配置更新成功'
    });
  } catch (error) {
    console.error('更新AI连接配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新AI连接配置失败'
    });
  }
});

// 删除AI连接配置
router.delete('/connections/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const connectionId = parseInt(req.params.id);
    
    // 验证配置是否存在且属于当前用户
    const existingConnection = await aiConnectionQueries.findById(connectionId);
    if (!existingConnection || existingConnection.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'AI连接配置不存在'
      });
    }

    await aiConnectionQueries.delete(connectionId);

    res.json({
      success: true,
      message: 'AI连接配置删除成功'
    });
  } catch (error) {
    console.error('删除AI连接配置失败:', error);
    res.status(500).json({
      success: false,
      message: '删除AI连接配置失败'
    });
  }
});

// 测试AI连接
router.post('/connections/:id/test', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const connectionId = parseInt(req.params.id);
    
    // 验证配置是否存在且属于当前用户
    const connection = await aiConnectionQueries.findById(connectionId);
    if (!connection || connection.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'AI连接配置不存在'
      });
    }

    const isConnected = await aiService.testConnection(connection);

    res.json({
      success: true,
      data: { connected: isConnected }
    });
  } catch (error) {
    console.error('测试AI连接失败:', error);
    res.status(500).json({
      success: false,
      message: '测试AI连接失败'
    });
  }
});

// 生成句子问题
router.post('/generate-sentence', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      word,
      meaning,
      frenchWord,
      grade,
      difficulty,
      questionType,
      excludeQuestionIds // 可选：排除已使用的题目ID（已废弃）
    } = req.body;

    // 验证必填字段
    if (!word || !meaning || !frenchWord || !grade || !difficulty || !questionType) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：word, meaning, frenchWord, grade, difficulty, questionType'
      });
    }

    // 获取用户启用的AI连接配置，优先使用第一个启用的配置
    const enabledConnections = await aiConnectionQueries.findEnabledByUserId(userId);
    let userConnection: AIConnectionConfig | undefined = undefined;

    if (enabledConnections.length > 0) {
      userConnection = enabledConnections[0];
      // 确保userConnection不为undefined后再使用其属性
      if (userConnection) {
        console.log(`使用用户AI配置: ${userConnection.name} (${userConnection.type})`);
      }
    } else {
      console.log('用户没有启用AI配置，使用默认配置');
    }

    const result = await aiService.generateSentenceQuestion({
      word,
      meaning,
      frenchWord,
      grade,
      difficulty,
      question_type: questionType
    }, userConnection, excludeQuestionIds);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('生成句子问题失败:', error);
    res.status(500).json({
      success: false,
      message: '生成句子问题失败'
    });
  }
});

// 题目评估（点赞/反赞）
router.post('/questions/:questionId/rate', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const questionId = parseInt(req.params.questionId);
    const { rating } = req.body;

    // 验证必填字段
    if (!rating || ![-1, 1].includes(rating)) {
      return res.status(400).json({
        success: false,
        message: 'rating必须是1（赞）或-1（反赞）'
      });
    }

    // 检查题目是否存在
    const questionExists = await pool.query(
      'SELECT id FROM ai_generated_questions WHERE id = $1',
      [questionId]
    );

    if (questionExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 评估题目
    await questionRatingQueries.rateQuestion(userId, questionId, rating);

    res.json({
      success: true,
      message: rating > 0 ? '点赞成功' : '反赞成功',
      data: { rating }
    });
  } catch (error) {
    console.error('题目评估失败:', error);
    res.status(500).json({
      success: false,
      message: '题目评估失败'
    });
  }
});

// 获取题目评价统计
router.get('/questions/:questionId/ratings', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const questionId = parseInt(req.params.questionId);

    // 获取题目评价统计
    const ratings = await questionRatingQueries.getQuestionRatingsWithUser(userId, questionId);

    res.json({
      success: true,
      data: ratings
    });
  } catch (error) {
    console.error('获取题目评价失败:', error);
    res.status(500).json({
      success: false,
      message: '获取题目评价失败'
    });
  }
});

// 获取题库统计
router.get('/questions/stats', authenticateToken, async (req, res) => {
  try {
    const { wordId, questionType } = req.query;

    let query = `
      SELECT
        word_id,
        word,
        question_type,
        COUNT(*) as question_count,
        MAX(created_at) as last_generated
      FROM ai_generated_questions
    `;

    const params: any[] = [];

    if (wordId) {
      query += ' WHERE word_id = $1';
      params.push(wordId);
    }

    if (questionType) {
      if (wordId) {
        query += ' AND question_type = $2';
        params.push(questionType);
      } else {
        query += ' WHERE question_type = $1';
        params.push(questionType);
      }
    }

    query += ' GROUP BY word_id, word, question_type ORDER BY word, question_type';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('获取题库统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取题库统计失败'
    });
  }
});

// 获取题目列表（包含评价数据）
router.get('/questions/list', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { wordId, questionType } = req.query;

    let query = `
      SELECT
        q.id,
        q.word_id,
        q.word,
        q.question_type,
        q.original_sentence,
        q.modified_sentence,
        q.options,
        q.word_blocks,
        q.shuffled_blocks,
        q.correct_answer,
        q.explanation,
        q.created_at,
        COALESCE(SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END), 0) as positive,
        COALESCE(SUM(CASE WHEN r.rating = -1 THEN 1 ELSE 0 END), 0) as negative,
        (
          SELECT rating
          FROM question_ratings
          WHERE user_id = $1 AND question_id = q.id
          LIMIT 1
        ) as user_rating
      FROM ai_generated_questions q
      LEFT JOIN question_ratings r ON q.id = r.question_id
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (wordId) {
      query += ` WHERE q.word_id = $${paramIndex}`;
      params.push(wordId);
      paramIndex++;
    }

    if (questionType) {
      const whereClause = wordId
        ? ` AND q.question_type = $${paramIndex}`
        : ` WHERE q.question_type = $${paramIndex}`;
      query += whereClause;
      params.push(questionType);
      paramIndex++;
    }

    query += ' GROUP BY q.id ORDER BY q.created_at DESC';

    const result = await pool.query(query, params);

    // 转换数据格式，将评价数据嵌套在ratings对象中
    const questions = result.rows.map(row => ({
      id: row.id,
      word_id: row.word_id,
      word: row.word,
      question_type: row.question_type,
      original_sentence: row.original_sentence,
      modified_sentence: row.modified_sentence,
      options: row.options,
      word_blocks: row.word_blocks,
      shuffled_blocks: row.shuffled_blocks,
      correct_answer: row.correct_answer,
      explanation: row.explanation,
      created_at: row.created_at,
      ratings: {
        positive: parseInt(row.positive) || 0,
        negative: parseInt(row.negative) || 0,
        userRating: row.user_rating || null
      }
    }));

    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('获取题目列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取题目列表失败'
    });
  }
});

export default router;