import express from 'express';
import { aiConnectionQueries } from '../database/postgresql';
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
      questionType
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
    }, userConnection);

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

export default router;