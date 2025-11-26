import { Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../database/schema';
import { ProgressSyncRequest, ProgressSyncResponse } from '../types';

export async function syncProgress(req: any, res: Response) {
  try {
    const userId = req.user.id;
    const { learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, clientTimestamp }: ProgressSyncRequest = req.body;

    // 开始事务
    await dbRun('BEGIN TRANSACTION');

    try {
      // 更新用户设置
      await dbRun(
        `UPDATE user_settings 
         SET current_grade = ?, current_view_mode = ?, current_filter = ? 
         WHERE user_id = ?`,
        [currentGrade, currentViewMode, currentFilter, userId]
      );

      // 获取当前数据库中的进度（包含时间戳）
      const existingProgress = await dbAll(
        'SELECT word_id, is_learned, is_mastered, updated_at FROM user_progress WHERE user_id = ?',
        [userId]
      );

      const existingProgressMap = new Map();
      existingProgress.forEach((row: any) => {
        existingProgressMap.set(row.word_id, {
          is_learned: Boolean(row.is_learned),
          is_mastered: Boolean(row.is_mastered),
          updated_at: new Date(row.updated_at)
        });
      });

      // 获取所有单词ID的并集
      const allWordIds = new Set([
        ...Object.keys(learnedWords),
        ...Object.keys(masteredWords),
        ...Array.from(existingProgressMap.keys())
      ]);

      // 智能同步：基于时间戳和状态变化
      for (const wordId of allWordIds) {
        const clientLearned = learnedWords[wordId] || false;
        const clientMastered = masteredWords[wordId] || false;
        const existing = existingProgressMap.get(wordId);

        if (existing) {
          // 如果客户端有变化，更新到云端
          const clientLearnedChanged = existing.is_learned !== clientLearned;
          const clientMasteredChanged = existing.is_mastered !== clientMastered;
          
          if (clientLearnedChanged || clientMasteredChanged) {
            // 客户端有变化，更新云端
            await dbRun(
              `UPDATE user_progress 
               SET is_learned = ?, is_mastered = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE user_id = ? AND word_id = ?`,
              [clientLearned, clientMastered, userId, wordId]
            );
          }
        } else if (clientLearned || clientMastered) {
          // 云端没有记录，但客户端有，插入新记录
          const grade = parseInt(wordId.split('_')[0]); // 假设word_id格式为 "grade_wordindex"
          await dbRun(
            `INSERT INTO user_progress (user_id, word_id, grade, is_learned, is_mastered) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, wordId, grade, clientLearned, clientMastered]
          );
        }
        // 如果云端有记录但客户端没有，且客户端状态为false，则删除云端记录
        else if (existing && !clientLearned && !clientMastered) {
          await dbRun(
            'DELETE FROM user_progress WHERE user_id = ? AND word_id = ?',
            [userId, wordId]
          );
        }
      }

      // 提交事务
      await dbRun('COMMIT');

      // 获取更新后的完整进度数据
      const updatedProgress = await dbAll(
        'SELECT word_id, is_learned, is_mastered FROM user_progress WHERE user_id = ?',
        [userId]
      );

      const updatedLearnedWords: Record<string, boolean> = {};
      const updatedMasteredWords: Record<string, boolean> = {};

      updatedProgress.forEach((row: any) => {
        if (row.is_learned) {
          updatedLearnedWords[row.word_id] = true;
        }
        if (row.is_mastered) {
          updatedMasteredWords[row.word_id] = true;
        }
      });

      // 获取用户设置
      const settings = await dbGet(
        'SELECT current_grade, current_view_mode, current_filter FROM user_settings WHERE user_id = ?',
        [userId]
      );

      const response: ProgressSyncResponse = {
        success: true,
        data: {
          learnedWords: updatedLearnedWords,
          masteredWords: updatedMasteredWords,
          currentGrade: settings?.current_grade || 81,
          currentViewMode: settings?.current_view_mode || 'learn',
          currentFilter: settings?.current_filter || 'all'
        }
      };

      res.json(response);
    } catch (error) {
      // 回滚事务
      await dbRun('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Sync progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProgress(req: any, res: Response) {
  try {
    const userId = req.user.id;

    // 获取用户进度
    const progress = await dbAll(
      'SELECT word_id, is_learned, is_mastered FROM user_progress WHERE user_id = ?',
      [userId]
    );

    // 获取用户设置
    const settings = await dbGet(
      'SELECT current_grade, current_view_mode, current_filter FROM user_settings WHERE user_id = ?',
      [userId]
    );

    const learnedWords: Record<string, boolean> = {};
    const masteredWords: Record<string, boolean> = {};

    progress.forEach((row: any) => {
      if (row.is_learned) {
        learnedWords[row.word_id] = true;
      }
      if (row.is_mastered) {
        masteredWords[row.word_id] = true;
      }
    });

    const response: ProgressSyncResponse = {
      success: true,
      data: {
        learnedWords,
        masteredWords,
        currentGrade: settings?.current_grade || 81,
        currentViewMode: settings?.current_view_mode || 'learn',
        currentFilter: settings?.current_filter || 'all'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}