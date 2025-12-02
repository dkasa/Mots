import { Response } from 'express';
import { 
  userProgress, 
  userSettings, 
  DatabaseTransaction
} from '../database';
import { ProgressSyncRequest, ProgressSyncResponse } from '../types';

export async function syncProgress(req: any, res: Response) {
  try {
    const userId = parseInt(req.user.id);
    const { learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter }: ProgressSyncRequest = req.body;

    try {
      // 使用事务确保数据一致性
      const tx = new DatabaseTransaction();
      await tx.begin();

      // 更新用户设置
      await (userSettings.update as any)(userId, currentGrade, currentViewMode, currentFilter);

      // 获取当前数据库中的进度（包含时间戳）
      const existingProgress = await (userProgress.findByUserId as any)(userId);

      const existingProgressMap = new Map<string, {
        is_learned: boolean;
        is_mastered: boolean;
        updated_at: Date;
      }>();
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

      // 准备批量更新数据
      const updates: Array<{wordId: string, grade: number, isLearned: boolean, isMastered: boolean}> = [];
      const deletions: string[] = [];

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
            const grade = parseInt(wordId.split('_')[0]) || parseInt(wordId.split('-')[0]) || 81;
            updates.push({ wordId, grade, isLearned: clientLearned, isMastered: clientMastered });
          }
        } else if (clientLearned || clientMastered) {
          // 云端没有记录，但客户端有，插入新记录
          const grade = parseInt(wordId.split('_')[0]) || parseInt(wordId.split('-')[0]) || 81;
          updates.push({ wordId, grade, isLearned: clientLearned, isMastered: clientMastered });
        }
        // 如果云端有记录但客户端没有，且客户端状态为false，则删除云端记录
        else if (existing && !clientLearned && !clientMastered) {
          deletions.push(wordId);
        }
      }

      // 执行批量更新
      if (updates.length > 0) {
        await (userProgress.batchUpdate as any)(userId, updates, tx);
      }

      // 执行删除操作
      for (const wordId of deletions) {
        await (userProgress.delete as any)(userId, wordId);
      }

      // 获取更新后的完整进度数据
      const updatedProgress = await (userProgress.findByUserId as any)(userId);

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
      const settings = await (userSettings.findByUserId as any)(userId);

      await tx.commit();

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
      // 事务回滚
      const tx = new DatabaseTransaction();
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Sync progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProgress(req: any, res: Response) {
  try {
    const userId = parseInt(req.user.id);

    // 获取用户进度
    const progress = await (userProgress.findByUserId as any)(userId);

    // 获取用户设置
    const settings = await (userSettings.findByUserId as any)(userId);

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

export async function getLastSyncTimestamp(req: any, res: Response) {
  try {
    const userId = parseInt(req.user.id);

    // 获取用户进度中最新更新时间
    const progressLastUpdated = await (userProgress.getLastUpdatedTime as any)(userId);

    // 获取用户设置中最新更新时间
    const settings = await (userSettings.findByUserId as any)(userId);

    // 比较两个时间戳，返回最新的
    let lastTimestamp = progressLastUpdated;
    
    if (settings && settings.updated_at) {
      const settingsTimestamp = new Date(settings.updated_at);
      if (!lastTimestamp || settingsTimestamp > new Date(lastTimestamp)) {
        lastTimestamp = settings.updated_at;
      }
    }

    res.json({ 
      timestamp: lastTimestamp 
    });
  } catch (error) {
    console.error('Get last sync timestamp error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}