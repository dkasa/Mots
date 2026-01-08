import { Request, Response } from 'express';
import { pool } from '../database/postgresql';

export class QuizController {
  // 保存测试会话和结果
  async saveQuizData(req: Request, res: Response) {
    try {
      const { session, results } = req.body;

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: '用户未认证' 
        });
      }

      // 开始事务
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // 1. 保存测试会话
        const sessionQuery = `
          INSERT INTO quiz_sessions (
            user_id, mode, grade, question_count, correct_count, 
            total_time, start_time, end_time, is_completed
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `;

        const sessionValues = [
          userId,
          session.mode,
          session.grade,
          session.questionCount,
          session.correctCount || 0,
          session.totalTime || 0,
          new Date(session.startTime),
          session.endTime ? new Date(session.endTime) : null,
          session.isCompleted || false
        ];

        const sessionResult = await client.query(sessionQuery, sessionValues);
        const sessionId = sessionResult.rows[0].id;

        // 2. 更新单词记忆数据
        for (const result of results) {
          // 检查是否已存在该单词的进度记录
          const checkQuery = `
            SELECT id FROM user_progress 
            WHERE user_id = $1 AND word_id = $2
          `;
          
          const checkResult = await client.query(checkQuery, [userId, result.wordId]);

          let progressQuery: string;
          let progressValues: any[];

          if (checkResult.rows.length > 0) {
            // 更新现有记录
            progressQuery = `
              UPDATE user_progress SET
                total_attempts = total_attempts + 1,
                correct_attempts = correct_attempts + $3,
                last_attempted = CURRENT_TIMESTAMP,
                last_correct = CASE WHEN $3 = 1 THEN CURRENT_TIMESTAMP ELSE last_correct END,
                consecutive_correct = CASE 
                  WHEN $3 = 1 THEN consecutive_correct + 1 
                  ELSE 0 
                END,
                is_mastered = CASE 
                  WHEN consecutive_correct >= 2 AND $3 = 1 THEN true  -- 连续正确3次（当前是第3次）
                  WHEN $3 = 0 THEN false  -- 错一次就取消已掌握状态
                  ELSE is_mastered
                END,
                average_time = CASE 
                  WHEN total_attempts = 0 THEN $4
                  ELSE (average_time * total_attempts + $4) / (total_attempts + 1)
                END,
                updated_at = CURRENT_TIMESTAMP
              WHERE user_id = $1 AND word_id = $2
            `;

            progressValues = [
              userId,
              result.wordId,
              result.isCorrect ? 1 : 0,
              result.timeSpent || 0
            ];
          } else {
            // 插入新记录
            progressQuery = `
              INSERT INTO user_progress (
                user_id, word_id, total_attempts, correct_attempts,
                last_attempted, last_correct, consecutive_correct,
                memory_level, average_time, grade, is_learned
              ) VALUES ($1, $2, 1, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, true)
            `;

            progressValues = [
              userId,
              result.wordId,
              result.isCorrect ? 1 : 0,
              result.isCorrect ? new Date() : null,
              result.isCorrect ? 1 : 0,
              result.isCorrect ? 1 : 0,
              result.timeSpent || 0,
              session.grade || 81
            ];
          }

          await client.query(progressQuery, progressValues);
        }

        await client.query('COMMIT');
        
        res.json({
          success: true,
          data: { sessionId }
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('保存测试数据失败:', error);
      res.status(500).json({
        success: false,
        error: '保存测试数据失败'
      });
    }
  }

  // 获取单词记忆数据
  async getWordMemories(req: Request, res: Response) {
    try {
      const { wordIds } = req.body;

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: '用户未认证' 
        });
      }

      if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }

      const placeholders = wordIds.map((_, index) => `$${index + 2}`).join(',');
      
      const query = `
        SELECT 
          word_id as "wordId",
          total_attempts as "totalAttempts",
          correct_attempts as "correctAttempts",
          last_attempted as "lastAttempted",
          last_correct as "lastCorrect",
          consecutive_correct as "consecutiveCorrect",
          memory_level as "memoryLevel",
          average_time as "averageTime"
        FROM user_progress 
        WHERE user_id = $1 AND word_id IN (${placeholders})
      `;

      const values = [userId, ...wordIds];
      const result = await pool.query(query, values);
      
      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      console.error('获取单词记忆失败:', error);
      res.status(500).json({
        success: false,
        error: '获取单词记忆失败'
      });
    }
  }
}