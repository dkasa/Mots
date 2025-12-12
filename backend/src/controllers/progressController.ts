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
    const { learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, clientTimestamp }: ProgressSyncRequest = req.body;

    console.log(`🔄 用户 ${userId} 开始同步`);
    console.log('📤 发送掌握单词数:', Object.keys(masteredWords || {}).length);
    console.log('📤 发送学习单词数:', Object.keys(learnedWords || {}).length);

    const tx = new DatabaseTransaction();
    try {
      await tx.begin();

      // 更新用户设置
      await (userSettings.update as any)(userId, currentGrade, currentViewMode, currentFilter);

      // 获取当前数据库中的进度
      const existingProgress = await (userProgress.findByUserId as any)(userId);
      const existingProgressMap = new Map<string, { is_learned: boolean; is_mastered: boolean; updated_at: string }>();
      
      existingProgress.forEach((row: any) => {
        existingProgressMap.set(row.word_id, {
          is_learned: Boolean(row.is_learned),
          is_mastered: Boolean(row.is_mastered),
          updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        });
      });

      // 智能同步策略：基于时间戳的冲突解决
      const updates: Array<{wordId: string, grade: number, isLearned: boolean, isMastered: boolean}> = [];
      const deletions: string[] = [];

      // 处理客户端发送的单词
      const clientWordIds = new Set([
        ...Object.keys(learnedWords || {}),
        ...Object.keys(masteredWords || {})
      ]);

      // 解析客户端时间戳
      let clientSyncTime: Date | null = null;
      if (clientTimestamp) {
        try {
          clientSyncTime = new Date(clientTimestamp);
        } catch (error) {
          console.warn('无效的客户端时间戳:', clientTimestamp);
        }
      }

      // 更新或插入单词进度
      for (const wordId of clientWordIds) {
        const clientLearned = Boolean(learnedWords?.[wordId]);
        const clientMastered = Boolean(masteredWords?.[wordId]);
        const grade = parseInt(wordId.split('_')[0]) || parseInt(wordId.split('-')[0]) || 81;
        
        const existing = existingProgressMap.get(wordId);
        
        // 如果客户端状态为false且服务器有记录，需要删除
        if (!clientLearned && !clientMastered && existing && (existing.is_learned || existing.is_mastered)) {
          deletions.push(wordId);
        }
        // 如果客户端状态为true，需要更新或插入（智能冲突解决）
        else if ((clientLearned || clientMastered)) {
          // 如果服务器没有记录，直接插入
          if (!existing) {
            updates.push({ wordId, grade, isLearned: clientLearned, isMastered: clientMastered });
          }
          // 如果服务器有记录但状态不同，需要智能判断
          else if (existing.is_learned !== clientLearned || existing.is_mastered !== clientMastered) {
            // 获取服务器记录的更新时间
            const serverUpdatedAt = new Date(existing.updated_at);
            
            // 默认使用客户端数据（因为客户端刚刚更新了数据）
            // 除非服务器数据比客户端数据更新时间还新（这通常不应该发生）
            if (!clientSyncTime || clientSyncTime >= serverUpdatedAt) {
              console.log(`🔄 使用客户端更新的单词: ${wordId} (客户端时间: ${clientSyncTime?.toISOString() || 'unknown'}, 服务器时间: ${serverUpdatedAt.toISOString()})`);
              updates.push({ wordId, grade, isLearned: clientLearned, isMastered: clientMastered });
            }
            // 只有在明确知道服务器数据更新时间比客户端更新时才保持服务器数据
            else {
              console.log(`🔄 保持服务器数据的单词: ${wordId} (服务器数据更新时间更新)`);
            }
          }
        }
      }

      // 找出服务器有但客户端没有的单词（可能客户端删除了）
      for (const [wordId] of existingProgressMap.entries()) {
        if (!clientWordIds.has(wordId)) {
          deletions.push(wordId);
        }
      }

      // 执行删除操作
      if (deletions.length > 0) {
        const client = tx.getClient();
        const placeholders = deletions.map((_, index) => `$${index + 2}`).join(',');
        await client.query(
          `DELETE FROM user_progress WHERE user_id = $1 AND word_id IN (${placeholders})`,
          [userId, ...deletions]
        );
        console.log('🗑️ 删除单词记录数:', deletions.length);
      }

      // 执行批量更新
      if (updates.length > 0) {
        await (userProgress.batchUpdate as any)(userId, updates, tx);
        console.log('✅ 更新单词记录数:', updates.length);
      }

      await tx.commit();

      // 获取最终状态
      const finalProgress = await (userProgress.findByUserId as any)(userId);
      const finalLearnedWords: Record<string, boolean> = {};
      const finalMasteredWords: Record<string, boolean> = {};

      finalProgress.forEach((row: any) => {
        if (row.is_learned) {
          finalLearnedWords[row.word_id] = true;
        }
        if (row.is_mastered) {
          finalMasteredWords[row.word_id] = true;
        }
      });

      const settings = await (userSettings.findByUserId as any)(userId);

      console.log('✅ 同步完成:', {
        掌握单词数: Object.keys(finalMasteredWords).length,
        学习单词数: Object.keys(finalLearnedWords).length
      });

      const response: ProgressSyncResponse = {
        success: true,
        data: {
          learnedWords: finalLearnedWords,
          masteredWords: finalMasteredWords,
          currentGrade: settings?.current_grade || 81,
          currentViewMode: settings?.current_view_mode || 'learn',
          currentFilter: settings?.current_filter || 'all'
        }
      };

      res.json(response);
    } catch (error) {
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