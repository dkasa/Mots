import { Pool } from 'pg';
import { encryptAPIKey, isEncrypted } from '../src/utils/crypto';

// 数据库配置
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mots',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function migrateAPIKeys() {
  console.log('开始迁移API密钥加密...');
  
  try {
    // 获取所有未加密的API密钥
    const result = await pool.query('SELECT id, api_key FROM ai_connections');
    
    let migratedCount = 0;
    let alreadyEncryptedCount = 0;
    
    for (const row of result.rows) {
      if (isEncrypted(row.api_key)) {
        alreadyEncryptedCount++;
        continue;
      }
      
      // 加密API密钥
      const encryptedApiKey = encryptAPIKey(row.api_key);
      
      // 更新数据库
      await pool.query('UPDATE ai_connections SET api_key = $1 WHERE id = $2', [
        encryptedApiKey,
        row.id
      ]);
      
      migratedCount++;
      console.log(`已加密配置ID: ${row.id}`);
    }
    
    console.log(`\n迁移完成:`);
    console.log(`- 已加密: ${migratedCount} 个配置`);
    console.log(`- 已加密(无需处理): ${alreadyEncryptedCount} 个配置`);
    console.log(`- 总计: ${result.rows.length} 个配置`);
    
  } catch (error) {
    console.error('迁移失败:', error);
  } finally {
    await pool.end();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateAPIKeys();
}

export { migrateAPIKeys };