/**
 * 智能句子API路由 - 支持句子题型的灵活转换和复用
 */

import express, { Router } from 'express';
import { intelligentSentenceService } from '../services/intelligentSentenceService';

const router: Router = express.Router();

/**
 * 获取智能句子（支持题型转换）
 * GET /api/intelligent-sentences/:questionId
 * Query参数: targetType (可选) - 目标题型: sentence-reordering | sentence-completion
 */
router.get('/:questionId', async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId);
    const targetType = req.query.targetType as string;

    if (isNaN(questionId)) {
      return res.status(400).json({
        success: false,
        message: '题目ID格式错误'
      });
    }

    const intelligentSentence = await intelligentSentenceService.getIntelligentSentence(questionId, targetType);

    if (!intelligentSentence) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    res.json({
      success: true,
      data: intelligentSentence
    });
  } catch (error) {
    console.error('❌ 获取智能句子失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 获取单词的所有智能句子
 * GET /api/intelligent-sentences/word/:wordId
 */
router.get('/word/:wordId', async (req, res) => {
  try {
    const wordId = req.params.wordId;

    if (!wordId) {
      return res.status(400).json({
        success: false,
        message: '单词ID不能为空'
      });
    }

    const sentences = await intelligentSentenceService.getIntelligentSentencesByWord(wordId);

    res.json({
      success: true,
      data: sentences
    });
  } catch (error) {
    console.error('❌ 获取单词智能句子失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 检查句子的复用能力
 * GET /api/intelligent-sentences/:questionId/reusability
 */
router.get('/:questionId/reusability', async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId);

    if (isNaN(questionId)) {
      return res.status(400).json({
        success: false,
        message: '题目ID格式错误'
      });
    }

    const reusability = await intelligentSentenceService.checkSentenceReusability(questionId);

    res.json({
      success: true,
      data: reusability
    });
  } catch (error) {
    console.error('❌ 检查句子复用能力失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 删除句子
 * DELETE /api/intelligent-sentences/:questionId
 */
router.delete('/:questionId', async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId);

    if (isNaN(questionId)) {
      return res.status(400).json({
        success: false,
        message: '题目ID格式错误'
      });
    }

    const deleted = await intelligentSentenceService.deleteSentence(questionId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '句子不存在或删除失败'
      });
    }

    res.json({
      success: true,
      message: '句子删除成功'
    });
  } catch (error) {
    console.error('❌ 删除句子失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

export default router;