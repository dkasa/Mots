import { Pool, PoolClient } from 'pg';

// PostgreSQL连接配置
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mots',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时
  connectionTimeoutMillis: 2000, // 连接超时
  ssl: false
});

// 数据库连接测试
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    
    // 检查当前数据库
    const dbResult = await client.query('SELECT current_database()');
    console.log('🗄️ 当前数据库:', dbResult.rows[0].current_database);
    
    const result = await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL连接成功:', result.rows[0]);
    
    // 检查现有表
    const tableResult = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    console.log('📋 现有表数量:', tableResult.rows.length);
    if (tableResult.rows.length > 0) {
      console.log('📋 现有表:', tableResult.rows.map(row => row.tablename));
    }
    
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL连接失败:', error);
    return false;
  }
}

// 数据库初始化 - 创建表结构
export async function initDatabase(): Promise<void> {
  const createTablesSQL = `
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 用户设置表
    CREATE TABLE IF NOT EXISTS user_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      current_grade INTEGER DEFAULT 81,
      current_view_mode VARCHAR(20) DEFAULT 'learn',
      current_filter VARCHAR(20) DEFAULT 'all',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    );

    -- 用户进度表
    CREATE TABLE IF NOT EXISTS user_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      word_id VARCHAR(50) NOT NULL,
      grade INTEGER NOT NULL,
      is_learned BOOLEAN DEFAULT FALSE,
      is_mastered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, word_id)
    );

    -- 创建索引以提高查询性能
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_progress_word_id ON user_progress(word_id);
    CREATE INDEX IF NOT EXISTS idx_user_progress_grade ON user_progress(grade);
    CREATE INDEX IF NOT EXISTS idx_user_progress_mastered ON user_progress(is_mastered);
    CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

    -- 创建触发器自动更新 updated_at 字段
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- 为需要的表添加更新时间触发器
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
    CREATE TRIGGER update_user_settings_updated_at 
        BEFORE UPDATE ON user_settings 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
    CREATE TRIGGER update_user_progress_updated_at 
        BEFORE UPDATE ON user_progress 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `;

  try {
    console.log('🔍 开始执行SQL创建表...');
    
    // 分步执行SQL，便于调试
    const steps = [
      '-- 用户表',
      'CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);',
      '-- 用户设置表',
      'CREATE TABLE IF NOT EXISTS user_settings (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, current_grade INTEGER DEFAULT 81, current_view_mode VARCHAR(20) DEFAULT \'learn\', current_filter VARCHAR(20) DEFAULT \'all\', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id));',
      '-- 用户进度表',
      'CREATE TABLE IF NOT EXISTS user_progress (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, word_id VARCHAR(50) NOT NULL, grade INTEGER NOT NULL, is_learned BOOLEAN DEFAULT FALSE, is_mastered BOOLEAN DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, word_id));'
    ];
    
    for (let i = 0; i < steps.length; i += 2) {
      console.log(`📝 执行步骤 ${Math.floor(i/2) + 1}: ${steps[i]}`);
      await pool.query(steps[i + 1]);
      console.log(`✅ 步骤 ${Math.floor(i/2) + 1} 完成`);
    }
    
    console.log('✅ PostgreSQL数据库表结构初始化完成');
    
    // 验证表是否创建成功
    const checkResult = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    console.log('📋 当前数据库中的表:', checkResult.rows.map(row => row.tablename));
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
    }
    throw error;
  }
}

// 事务管理类
export class DatabaseTransaction {
  private client: PoolClient | null = null;

  async begin(): Promise<void> {
    this.client = await pool.connect();
    await this.client.query('BEGIN');
  }

  async commit(): Promise<void> {
    if (this.client) {
      await this.client.query('COMMIT');
      this.client.release();
      this.client = null;
    }
  }

  async rollback(): Promise<void> {
    if (this.client) {
      await this.client.query('ROLLBACK');
      this.client.release();
      this.client = null;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.client) {
      throw new Error('事务未开始或已结束');
    }
    return this.client.query(text, params);
  }

  // 获取事务客户端用于复杂操作
  getClient(): PoolClient {
    if (!this.client) {
      throw new Error('事务未开始或已结束');
    }
    return this.client;
  }
}

// 用户相关操作
export const userQueries = {
  // 根据用户名查找用户
  async findByUsername(username: string): Promise<any> {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
  },

  // 根据邮箱查找用户
  async findByEmail(email: string): Promise<any> {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  },

  // 根据ID查找用户
  async findById(id: number): Promise<any> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  // 创建新用户
  async create(username: string, email: string, passwordHash: string): Promise<number> {
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [username, email, passwordHash]
    );
    return result.rows[0].id;
  }
};

// 用户设置相关操作
export const userSettingsQueries = {
  // 获取用户设置
  async findByUserId(userId: number): Promise<any> {
    const result = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  },

  // 创建用户设置
  async create(userId: number): Promise<void> {
    await pool.query(
      'INSERT INTO user_settings (user_id, current_grade, current_view_mode, current_filter) VALUES ($1, $2, $3, $4)',
      [userId, 81, 'learn', 'all']
    );
  },

  // 更新用户设置
  async update(userId: number, currentGrade: number, currentViewMode: string, currentFilter: string): Promise<void> {
    await pool.query(
      'UPDATE user_settings SET current_grade = $1, current_view_mode = $2, current_filter = $3 WHERE user_id = $4',
      [currentGrade, currentViewMode, currentFilter, userId]
    );
  }
};

// 用户进度相关操作
export const userProgressQueries = {
  // 获取用户所有进度
  async findByUserId(userId: number): Promise<any[]> {
    const result = await pool.query(
      'SELECT * FROM user_progress WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    return result.rows;
  },

  // 获取用户最后更新时间
  async getLastUpdatedTime(userId: number): Promise<string | null> {
    const result = await pool.query(
      'SELECT MAX(updated_at) as last_updated FROM user_progress WHERE user_id = $1',
      [userId]
    );
    return result.rows[0].last_updated || null;
  },

  // 更新或插入用户进度
  async upsert(
    userId: number, 
    wordId: string, 
    grade: number, 
    isLearned: boolean, 
    isMastered: boolean,
    transaction?: DatabaseTransaction
  ): Promise<void> {
    const queryClient = transaction ? transaction.getClient() : pool;
    
    await queryClient.query(
      `INSERT INTO user_progress (user_id, word_id, grade, is_learned, is_mastered) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (user_id, word_id) 
       DO UPDATE SET 
         is_learned = EXCLUDED.is_learned,
         is_mastered = EXCLUDED.is_mastered,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, wordId, grade, isLearned, isMastered]
    );
  },

  // 删除用户进度
  async delete(userId: number, wordId: string): Promise<void> {
    await pool.query('DELETE FROM user_progress WHERE user_id = $1 AND word_id = $2', [userId, wordId]);
  },

  // 批量更新进度（用于事务中）
  async batchUpdate(
    userId: number,
    updates: Array<{wordId: string, grade: number, isLearned: boolean, isMastered: boolean}>,
    transaction: DatabaseTransaction
  ): Promise<void> {
    const client = transaction.getClient();
    
    for (const update of updates) {
      await client.query(
        `INSERT INTO user_progress (user_id, word_id, grade, is_learned, is_mastered) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (user_id, word_id) 
         DO UPDATE SET 
           is_learned = EXCLUDED.is_learned,
           is_mastered = EXCLUDED.is_mastered,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, update.wordId, update.grade, update.isLearned, update.isMastered]
      );
    }
  }
};

// 导出连接池
export { pool };

// 导出数据库对象以保持与原有代码的兼容性
export const db = {
  run: async (operation: string, table: string, params: any[]): Promise<any> => {
    // 这是一个简化的兼容层，建议直接使用上面的查询函数
    console.warn('使用了兼容层，建议直接使用新的查询函数');
    return { changes: 0 };
  },
  
  get: async (table: string, field: string, value: any): Promise<any> => {
    if (table === 'users') {
      if (field === 'username') return userQueries.findByUsername(value);
      if (field === 'email') return userQueries.findByEmail(value);
      if (field === 'id') return userQueries.findById(value);
    }
    
    if (table === 'user_settings' && field === 'user_id') {
      return userSettingsQueries.findByUserId(value);
    }
    
    return null;
  },
  
  all: async (table: string, field: string, value: any, specialField?: string): Promise<any[]> => {
    if (table === 'user_progress' && field === 'user_id') {
      if (specialField && specialField.includes('MAX(updated_at)')) {
        const lastUpdated = await userProgressQueries.getLastUpdatedTime(value);
        return lastUpdated ? [{ last_updated: lastUpdated }] : [];
      }
      return userProgressQueries.findByUserId(value);
    }
    
    return [];
  }
};

// 数据库健康检查
export async function healthCheck(): Promise<{ status: string, timestamp: string }> {
  try {
    const result = await pool.query('SELECT NOW() as timestamp');
    return {
      status: 'healthy',
      timestamp: result.rows[0].timestamp
    };
  } catch (error) {
    throw new Error('数据库连接失败');
  }
}

// 优雅关闭连接池
export async function closeConnection(): Promise<void> {
  await pool.end();
  console.log('📴 PostgreSQL连接池已关闭');
}