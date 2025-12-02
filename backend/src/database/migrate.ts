import { initDatabase, testConnection } from './postgresql';
import { initDatabase as initJsonDb, jsonStorage } from './jsonStorage';
import fs from 'fs';
import path from 'path';

// 数据迁移脚本 - 从JSON文件迁移到PostgreSQL
async function migrateFromJsonToPostgres(): Promise<void> {
  console.log('🚀 开始从JSON存储迁移到PostgreSQL...');
  
  try {
    // 1. 测试PostgreSQL连接
    console.log('📡 测试PostgreSQL连接...');
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('PostgreSQL连接失败');
    }
    
    // 2. 初始化PostgreSQL数据库结构
    console.log('🏗️ 初始化PostgreSQL数据库结构...');
    await initDatabase();
    
    // 3. 读取JSON数据
    console.log('📖 读取JSON数据文件...');
    const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : './data';
    const usersFile = path.join(dataDir, 'users.json');
    const userProgressFile = path.join(dataDir, 'user_progress.json');
    const userSettingsFile = path.join(dataDir, 'user_settings.json');
    
    let usersData: any = {};
    let userProgressData: any = {};
    let userSettingsData: any = {};
    
    if (fs.existsSync(usersFile)) {
      const content = fs.readFileSync(usersFile, 'utf8');
      usersData = JSON.parse(content);
    }
    
    if (fs.existsSync(userProgressFile)) {
      const content = fs.readFileSync(userProgressFile, 'utf8');
      userProgressData = JSON.parse(content);
    }
    
    if (fs.existsSync(userSettingsFile)) {
      const content = fs.readFileSync(userSettingsFile, 'utf8');
      userSettingsData = JSON.parse(content);
    }
    
    console.log(`📊 找到 ${Object.keys(usersData).length} 个用户`);
    console.log(`📊 找到 ${Object.keys(userProgressData).length} 个用户的进度数据`);
    console.log(`📊 找到 ${Object.keys(userSettingsData).length} 个用户的设置数据`);
    
    // 4. 迁移数据
    const { DatabaseTransaction } = await import('./postgresql');
    const { userQueries, userSettingsQueries, userProgressQueries } = await import('./postgresql');
    
    const transaction = new DatabaseTransaction();
    await transaction.begin();
    
    try {
      // 迁移用户数据
      console.log('👥 迁移用户数据...');
      const userIdMap: Record<string, number> = {}; // JSON ID -> PostgreSQL ID 映射
      
      for (const [jsonId, userData] of Object.entries(usersData)) {
        const user = userData as any;
        const newUserId = await userQueries.create(
          user.username,
          user.email,
          user.password_hash
        );
        userIdMap[jsonId] = newUserId;
        console.log(`✅ 迁移用户: ${user.username} (ID: ${jsonId} -> ${newUserId})`);
      }
      
      // 迁移用户设置
      console.log('⚙️ 迁移用户设置...');
      for (const [jsonUserId, settings] of Object.entries(userSettingsData)) {
        const newUserId = userIdMap[jsonUserId];
        if (newUserId) {
          const settingData = settings as any;
          await transaction.query(
            `INSERT INTO user_settings (user_id, current_grade, current_view_mode, current_filter, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              newUserId,
              settingData.current_grade || 81,
              settingData.current_view_mode || 'learn',
              settingData.current_filter || 'all',
              settingData.created_at || new Date().toISOString(),
              settingData.updated_at || new Date().toISOString()
            ]
          );
          console.log(`✅ 迁移用户设置: 用户ID ${newUserId}`);
        }
      }
      
      // 迁移用户进度
      console.log('📈 迁移用户进度数据...');
      let totalProgressRecords = 0;
      for (const [jsonUserId, progress] of Object.entries(userProgressData)) {
        const newUserId = userIdMap[jsonUserId];
        if (newUserId) {
          const userProgressData = progress as Record<string, any>;
          
          for (const [wordId, progressData] of Object.entries(userProgressData)) {
            const data = progressData as any;
            await transaction.query(
              `INSERT INTO user_progress (user_id, word_id, grade, is_learned, is_mastered, created_at, updated_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                newUserId,
                wordId,
                data.grade || parseInt(wordId.split('_')[0]) || 81,
                data.is_learned || false,
                data.is_mastered || false,
                data.created_at || new Date().toISOString(),
                data.updated_at || new Date().toISOString()
              ]
            );
            totalProgressRecords++;
          }
        }
      }
      
      console.log(`✅ 迁移了 ${totalProgressRecords} 条进度记录`);
      
      await transaction.commit();
      console.log('🎉 数据迁移完成！');
      
      // 5. 备份JSON文件
      console.log('💾 备份JSON文件...');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(dataDir, `backup_${timestamp}`);
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      if (fs.existsSync(usersFile)) {
        fs.copyFileSync(usersFile, path.join(backupDir, 'users.json'));
      }
      if (fs.existsSync(userProgressFile)) {
        fs.copyFileSync(userProgressFile, path.join(backupDir, 'user_progress.json'));
      }
      if (fs.existsSync(userSettingsFile)) {
        fs.copyFileSync(userSettingsFile, path.join(backupDir, 'user_settings.json'));
      }
      
      console.log(`✅ JSON文件已备份到: ${backupDir}`);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateFromJsonToPostgres()
    .then(() => {
      console.log('✅ 迁移成功完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 迁移失败:', error);
      process.exit(1);
    });
}

export { migrateFromJsonToPostgres };