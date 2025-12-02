// 数据库模块入口文件
// 根据环境变量决定使用PostgreSQL还是JSON存储

import { 
  initDatabase as initPostgres,
  testConnection,
  DatabaseTransaction,
  userQueries,
  userSettingsQueries,
  userProgressQueries,
  db as postgresDb,
  healthCheck as postgresHealthCheck,
  closeConnection
} from './postgresql';

import {
  initDatabase as initJsonDb,
  jsonStorage,
  db as jsonDb
} from './jsonStorage';

// 环境变量控制
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

// 导出统一的初始化函数
export async function initDatabase(): Promise<void> {
  if (USE_POSTGRES) {
    console.log('🐘 使用PostgreSQL数据库');
    await initPostgres();
  } else {
    console.log('📄 使用JSON文件存储');
    initJsonDb();
  }
}

// 导出健康检查
export async function healthCheck(): Promise<{ status: string, timestamp: string }> {
  if (USE_POSTGRES) {
    return postgresHealthCheck();
  } else {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }
}

// 导出测试连接
export async function testDbConnection(): Promise<boolean> {
  if (USE_POSTGRES) {
    return testConnection();
  } else {
    return true; // JSON存储总是可用的
  }
}

// 导出事务类
export { DatabaseTransaction };

// 导出查询接口 - 统一接口
export const db = USE_POSTGRES ? postgresDb : jsonDb;

// 导出用户相关操作
export const users = USE_POSTGRES ? {
  findByUsername: userQueries.findByUsername,
  findByEmail: userQueries.findByEmail,
  findById: userQueries.findById,
  create: userQueries.create
} : {
  findByUsername: jsonStorage.getUserByUsername,
  findByEmail: jsonStorage.getUserByEmail,
  findById: (id: number | string) => jsonStorage.getUserById(id.toString()),
  create: (username: string, email: string, passwordHash: string) => 
    jsonStorage.insertUser(username, email, passwordHash).then(result => parseInt(result.lastID.toString()))
};

// 导出用户设置相关操作
export const userSettings = USE_POSTGRES ? {
  findByUserId: userSettingsQueries.findByUserId,
  create: userSettingsQueries.create,
  update: userSettingsQueries.update
} : {
  findByUserId: jsonStorage.getUserSettings,
  create: (userId: number | string) => jsonStorage.insertUserSettings(userId.toString()),
  update: (userId: number | string, currentGrade: number, currentViewMode: string, currentFilter: string) =>
    jsonStorage.updateUserSettings(userId.toString(), currentGrade, currentViewMode, currentFilter)
};

// 导出用户进度相关操作
export const userProgress = USE_POSTGRES ? {
  findByUserId: userProgressQueries.findByUserId,
  getLastUpdatedTime: userProgressQueries.getLastUpdatedTime,
  upsert: userProgressQueries.upsert,
  delete: userProgressQueries.delete,
  batchUpdate: userProgressQueries.batchUpdate
} : {
  findByUserId: jsonStorage.getUserProgress,
  getLastUpdatedTime: (userId: number | string) => 
    jsonStorage.getLastUpdatedTime(userId.toString()).then(result => result[0]?.last_updated || null),
  upsert: async (userId: number | string, wordId: string, grade: number, isLearned: boolean, isMastered: boolean) => {
    // JSON存储需要检查是否存在
    const existing = await jsonStorage.getUserProgress(userId.toString());
    const exists = existing.some(p => p.word_id === wordId);
    
    if (exists) {
      return jsonStorage.updateUserProgress(userId.toString(), wordId, isLearned, isMastered);
    } else {
      return jsonStorage.insertUserProgress(userId.toString(), wordId, grade, isLearned, isMastered);
    }
  },
  delete: (userId: number | string, wordId: string) => jsonStorage.deleteUserProgress(userId.toString(), wordId),
  batchUpdate: async (userId: number | string, updates: Array<{wordId: string, grade: number, isLearned: boolean, isMastered: boolean}>) => {
    // JSON存储的批量更新
    for (const update of updates) {
      await jsonStorage.updateUserProgress(userId.toString(), update.wordId, update.isLearned, update.isMastered);
    }
  }
};

// 导出事务相关函数
export const transaction = USE_POSTGRES ? {
  begin: () => {
    const tx = new DatabaseTransaction();
    return tx.begin();
  },
  commit: (tx: DatabaseTransaction) => tx.commit(),
  rollback: (tx: DatabaseTransaction) => tx.rollback()
} : {
  begin: () => jsonStorage.beginTransaction(),
  commit: () => jsonStorage.commit(),
  rollback: () => jsonStorage.rollback()
};

// 导出关闭连接函数
export const closeDbConnection = USE_POSTGRES ? closeConnection : () => {
  console.log('📄 JSON存储无需关闭连接');
};

// 导出当前使用的数据库类型
export const getDatabaseType = () => USE_POSTGRES ? 'postgresql' : 'json';

// 导出迁移函数
export { migrateFromJsonToPostgres } from './migrate';