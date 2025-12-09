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
    const { learnedWords, masteredWords, currentGrade, currentViewMode, currentFilter, clientTimestamp, wordProgressTimestamps }: ProgressSyncRequest & { wordProgressTimestamps?: Record<string, string> } = req.body;

    console.log(`🔄 用户 ${userId} 开始同步`);
    console.log('📤 发送的掌握单词数:', Object.keys(masteredWords || {}).length);
    console.log('📤 发送的学习单词数:', Object.keys(learnedWords || {}).length);
    console.log('📤 客户端时间戳:', clientTimestamp);
    console.log('📤 单词时间戳数量:', Object.keys(wordProgressTimestamps || {}).length);

    try {
      const tx = new DatabaseTransaction();
      await tx.begin();

      // 更新用户设置
      await (userSettings.update as any)(userId, currentGrade, currentViewMode, currentFilter);

      // 获取当前数据库中的进度（包含时间戳）
      const existingProgress = await (userProgress.findByUserId as any)(userId);

      // 创建现有进度的映射，包含时间戳
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

      // 准备合并后的数据
      const mergedLearnedWords: Record<string, boolean> = {};
      const mergedMasteredWords: Record<string, boolean> = {};
      const updates: Array<{wordId: string, grade: number, isLearned: boolean, isMastered: boolean}> = [];

      // 获取客户端发送的所有单词ID
      const clientWordIds = new Set([
        ...Object.keys(learnedWords || {}),
        ...Object.keys(masteredWords || {})
      ]);

      // 基于精确时间戳的合并策略
      console.log('🔄 开始基于精确时间戳的合并...');
      
      // 首先处理客户端发送的单词
      for (const wordId of clientWordIds) {
        const clientLearned = learnedWords[wordId] || false;
        const clientMastered = masteredWords[wordId] || false;
        const existing = existingProgressMap.get(wordId);
        
        const grade = parseInt(wordId.split('_')[0]) || parseInt(wordId.split('-')[0]) || 81;
        
        if (!existing) {
          // 新记录，直接使用客户端数据
          if (clientLearned || clientMastered) { // 只有在学习或掌握时才添加
            mergedLearnedWords[wordId] = clientLearned;
            mergedMasteredWords[wordId] = clientMastered;
            updates.push({ wordId, grade, isLearned: clientLearned, isMastered: clientMastered });
          }
        } else {
          // 现有记录，比较每个单词的精确时间戳
          const wordTimestamp = wordProgressTimestamps?.[wordId];
          const clientUpdatedAt = wordTimestamp ? new Date(wordTimestamp) : (clientTimestamp ? new Date(clientTimestamp) : new Date());
          const serverUpdatedAt = existing.updated_at;
          
          console.log(`📊 单词 ${wordId} 时间戳比较:`, {
            客户端: clientUpdatedAt.toISOString(),
            服务器: serverUpdatedAt.toISOString(),
            客户端较新: clientUpdatedAt > serverUpdatedAt,
            客户端学习: clientLearned,
            客户端掌握: clientMastered,
            服务器学习: existing.is_learned,
            服务器掌握: existing.is_mastered
          });
          
          // 如果状态有变化，优先使用客户端数据（即时效性更重要）
          const hasStateChange = (
            existing.is_learned !== clientLearned || 
            existing.is_mastered !== clientMastered
          );
          
          if (hasStateChange) {
            console.log(`📝 检测到状态变化: ${wordId}`);
            // 如果客户端状态与服务器不同，且客户端有时间戳，优先使用客户端数据
            if (wordTimestamp && clientUpdatedAt >= serverUpdatedAt) {
              mergedLearnedWords[wordId] = clientLearned;
              mergedMasteredWords[wordId] = clientMastered;
              updates.push({ wordId, grade, isLearned: clientLearned, isMastered: clientMastered });
              console.log(`✨ 使用客户端数据（状态变化）: ${wordId}`);
            } else if (clientUpdatedAt > serverUpdatedAt) {
              mergedLearnedWords[wordId] = clientLearned;
              mergedMasteredWords[wordId] = clientMastered;
              updates.push({ wordId, grade, isLearned: clientLearned, isMastered: clientMastered });
              console.log(`✨ 使用客户端数据（时间戳较新）: ${wordId}`);
            } else {
              // 客户端数据较旧，但状态不同，仍然保留服务器数据
              if (existing.is_learned || existing.is_mastered) {
                mergedLearnedWords[wordId] = existing.is_learned;
                mergedMasteredWords[wordId] = existing.is_mastered;
                console.log(`🔄 保留服务器数据（客户端较旧）: ${wordId}`);
              }
            }
          } else {
            // 状态相同，使用较新的时间戳的数据
            if (clientUpdatedAt > serverUpdatedAt) {
              if (clientLearned || clientMastered) {
                mergedLearnedWords[wordId] = clientLearned;
                mergedMasteredWords[wordId] = clientMastered;
                updates.push({ wordId, grade, isLearned: clientLearned, isMastered: clientMastered });
                console.log(`✨ 使用客户端数据（状态相同，时间戳较新）: ${wordId}`);
              }
            } else {
              if (existing.is_learned || existing.is_mastered) {
                mergedLearnedWords[wordId] = existing.is_learned;
                mergedMasteredWords[wordId] = existing.is_mastered;
                console.log(`🔄 使用服务器数据（状态相同，服务器较新）: ${wordId}`);
              }
            }
          }
        }
      }

      // 找出需要删除的单词（数据库中有但客户端没有发送的，且客户端状态为false）
      const deletions: string[] = [];
      for (const [wordId, existing] of existingProgressMap.entries()) {
        if (!clientWordIds.has(wordId)) {
          // 客户端没有发送这个单词，需要删除
          deletions.push(wordId);
        } else {
          const clientLearned = learnedWords[wordId] || false;
          const clientMastered = masteredWords[wordId] || false;
          // 客户端发送了但状态都是false，也需要删除
          if (!clientLearned && !clientMastered && (existing.is_learned || existing.is_mastered)) {
            deletions.push(wordId);
          }
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
        console.log('🗑️ 删除不需要的单词记录数:', deletions.length);
      }

      console.log('📊 合并统计:', {
        客户端发送单词数: clientWordIds.size,
        数据库现有单词数: existingProgressMap.size,
        需要更新单词数: updates.length,
        最终合并学习单词数: Object.keys(mergedLearnedWords).length,
        最终合并掌握单词数: Object.keys(mergedMasteredWords).length
      });

      // 执行批量更新
      if (updates.length > 0) {
        console.log('🔄 执行批量更新，记录数:', updates.length);
        await (userProgress.batchUpdate as any)(userId, updates, tx);
        console.log('✅ 批量更新完成');
      }

      await tx.commit();

      // 重新查询数据库获取最终状态（确保数据一致性）
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

      // 获取用户设置
      const settings = await (userSettings.findByUserId as any)(userId);

      console.log('✅ 同步完成:', {
        最终掌握单词数: Object.keys(finalMasteredWords).length,
        最终学习单词数: Object.keys(finalLearnedWords).length
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