import { initDatabase, testDbConnection, getDatabaseType } from './index';
import { migrateFromJsonToPostgres } from './migrate';
import fs from 'fs';
import path from 'path';

// 重置数据库脚本
async function resetDatabase(): Promise<void> {
  console.log('🔄 重置数据库...');
  
  try {
    const dbType = getDatabaseType();
    
    if (dbType === 'postgresql') {
      console.log('🐘 重置PostgreSQL数据库...');
      
      // 测试连接
      const isConnected = await testDbConnection();
      if (!isConnected) {
        throw new Error('PostgreSQL连接失败');
      }
      
      // 删除所有表数据（保留表结构）
      const { pool } = await import('./postgresql');
      
      // 禁用外键约束
      await pool.query('SET session_replication_role = replica;');
      
      // 清空所有表
      await pool.query('TRUNCATE TABLE user_progress RESTART IDENTITY CASCADE;');
      await pool.query('TRUNCATE TABLE user_settings RESTART IDENTITY CASCADE;');
      await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
      
      // 重新启用外键约束
      await pool.query('SET session_replication_role = DEFAULT;');
      
      console.log('✅ PostgreSQL数据库已重置');
      
      // 询问是否要从JSON文件迁移数据
      const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : './data';
      const usersFile = path.join(dataDir, 'users.json');
      
      if (fs.existsSync(usersFile)) {
        console.log('📦 检测到JSON数据文件，是否要迁移数据？');
        console.log('运行迁移命令: npm run db:migrate');
      }
      
    } else {
      console.log('📄 重置JSON文件存储...');
      
      // 删除JSON数据文件
      const dataDir = process.env.NODE_ENV === 'production' ? '/app/data' : './data';
      const files = ['users.json', 'user_progress.json', 'user_settings.json'];
      
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`✅ 已删除: ${file}`);
        }
      }
      
      // 重新初始化
      await initDatabase();
      console.log('✅ JSON存储已重置');
    }
    
  } catch (error) {
    console.error('❌ 数据库重置失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('✅ 数据库重置完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 重置失败:', error);
      process.exit(1);
    });
}

export { resetDatabase };