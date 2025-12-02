import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USER_PROGRESS_FILE = path.join(DATA_DIR, 'user_progress.json');
const USER_SETTINGS_FILE = path.join(DATA_DIR, 'user_settings.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据文件
function initDataFile(filename: string, defaultData: any = {}) {
  if (!fs.existsSync(filename)) {
    const content = JSON.stringify(defaultData, null, 2);
    // 使用 Buffer 确保创建干净的 UTF-8 文件，不带 BOM
    fs.writeFileSync(filename, Buffer.from(content, 'utf8'));
  }
}

// 安全读取JSON文件，处理BOM标记
function readJSONFile(filename: string): any {
  const buffer = fs.readFileSync(filename);
  let content = buffer.toString('utf8');
  
  // 检测并移除 UTF-8 BOM (EF BB BF)
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    content = buffer.slice(3).toString('utf8');
  }
  // 检测并移除 UTF-16 LE BOM (FF FE)
  else if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    content = buffer.slice(2).toString('utf16le');
  }
  // 检测并移除 UTF-16 BE BOM (FE FF)
  else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // 手动处理 UTF-16 BE 编码
    const bytes = buffer.slice(2);
    const chars = [];
    for (let i = 0; i < bytes.length; i += 2) {
      const codeUnit = (bytes[i] << 8) | bytes[i + 1];
      chars.push(String.fromCharCode(codeUnit));
    }
    content = chars.join('');
  }
  
  return JSON.parse(content);
}

// 写入JSON文件
function writeJSONFile(filename: string, data: any) {
  fs.writeFileSync(filename, Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
}

export function initDatabase() {
  initDataFile(USERS_FILE, {});
  initDataFile(USER_PROGRESS_FILE, {});
  initDataFile(USER_SETTINGS_FILE, {});
  console.log('Database initialized successfully');
}

// 用户相关操作
export async function getUserByUsername(username: string): Promise<any> {
  const users = readJSONFile(USERS_FILE);
  return Object.values(users).find((user: any) => user.username === username) || null;
}

export async function getUserByEmail(email: string): Promise<any> {
  const users = readJSONFile(USERS_FILE);
  return Object.values(users).find((user: any) => user.email === email) || null;
}

export async function getUserById(id: string): Promise<any> {
  const users = readJSONFile(USERS_FILE);
  return users[id] || null;
}

export async function getUserSettings(userId: string): Promise<any> {
  const settings = readJSONFile(USER_SETTINGS_FILE);
  return settings[userId] || null;
}

export async function getUserProgress(userId: string): Promise<any[]> {
  const progress = readJSONFile(USER_PROGRESS_FILE);
  const userProgress = progress[userId] || {};
  
  return Object.entries(userProgress).map(([word_id, data]: [string, any]) => ({
    word_id,
    ...data
  }));
}

export async function getLastUpdatedTime(userId: string): Promise<any[]> {
  const progress = readJSONFile(USER_PROGRESS_FILE);
  const userProgress = progress[userId] || {};
  
  let lastUpdated: string | null = null;
  Object.values(userProgress).forEach((data: any) => {
    if (data.updated_at) {
      const updatedTime = new Date(data.updated_at);
      if (!lastUpdated || updatedTime > new Date(lastUpdated)) {
        lastUpdated = data.updated_at;
      }
    }
  });
  
  return [{ last_updated: lastUpdated }];
}

// 保持兼容性的SQL接口函数
export async function dbGet(table: string, field: string, value: any): Promise<any> {
  if (table === 'users') {
    if (field === 'username') return getUserByUsername(value);
    if (field === 'email') return getUserByEmail(value);
    if (field === 'id') return getUserById(value);
  }
  
  if (table === 'user_settings' && field === 'user_id') {
    return getUserSettings(value);
  }
  
  return null;
}

export async function dbAll(table: string, field: string, value: any, specialField?: string): Promise<any[]> {
  if (table === 'user_progress' && field === 'user_id') {
    if (specialField && specialField === 'MAX(updated_at) as last_updated') {
      return getLastUpdatedTime(value);
    }
    return getUserProgress(value);
  }
  
  return [];
}

// 用户数据操作函数
export async function insertUser(username: string, email: string, passwordHash: string): Promise<any> {
  const users = readJSONFile(USERS_FILE);
  const id = (Object.keys(users).length + 1).toString();
  const now = new Date().toISOString();
  
  users[id] = {
    id,
    username,
    email,
    password_hash: passwordHash,
    created_at: now,
    updated_at: now
  };
  
  writeJSONFile(USERS_FILE, users);
  return { lastID: parseInt(id) };
}

// 用户设置操作函数
export async function insertUserSettings(userId: string): Promise<any> {
  const settings = readJSONFile(USER_SETTINGS_FILE);
  
  settings[userId] = {
    id: (Object.keys(settings).length + 1).toString(),
    user_id: userId,
    current_grade: 81,
    current_view_mode: 'learn',
    current_filter: 'all',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  writeJSONFile(USER_SETTINGS_FILE, settings);
  return { lastID: 1 };
}

export async function updateUserSettings(
  userId: string, 
  currentGrade: number, 
  currentViewMode: string, 
  currentFilter: string
): Promise<any> {
  const settings = readJSONFile(USER_SETTINGS_FILE);
  
  if (settings[userId]) {
    settings[userId].current_grade = currentGrade;
    settings[userId].current_view_mode = currentViewMode;
    settings[userId].current_filter = currentFilter;
    settings[userId].updated_at = new Date().toISOString();
    
    writeJSONFile(USER_SETTINGS_FILE, settings);
    return { changes: 1 };
  }
  
  return { changes: 0 };
}

// 用户进度操作函数
export async function updateUserProgress(
  userId: string, 
  wordId: string, 
  isLearned: boolean, 
  isMastered: boolean
): Promise<any> {
  const progress = readJSONFile(USER_PROGRESS_FILE);
  
  if (!progress[userId]) {
    progress[userId] = {};
  }
  
  if (!progress[userId][wordId]) {
    const grade = parseInt(wordId.split('_')[0]);
    progress[userId][wordId] = {
      id: `${userId}_${wordId}`,
      user_id: userId,
      word_id: wordId,
      grade,
      is_learned: false,
      is_mastered: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
  
  progress[userId][wordId].is_learned = isLearned;
  progress[userId][wordId].is_mastered = isMastered;
  progress[userId][wordId].updated_at = new Date().toISOString();
  
  writeJSONFile(USER_PROGRESS_FILE, progress);
  return { changes: 1 };
}

export async function insertUserProgress(
  userId: string, 
  wordId: string, 
  grade: number, 
  isLearned: boolean, 
  isMastered: boolean
): Promise<any> {
  const progress = readJSONFile(USER_PROGRESS_FILE);
  
  if (!progress[userId]) {
    progress[userId] = {};
  }
  
  progress[userId][wordId] = {
    id: `${userId}_${wordId}`,
    user_id: userId,
    word_id: wordId,
    grade,
    is_learned: isLearned,
    is_mastered: isMastered,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  writeJSONFile(USER_PROGRESS_FILE, progress);
  return { lastID: 1 };
}

export async function deleteUserProgress(userId: string, wordId: string): Promise<any> {
  const progress = readJSONFile(USER_PROGRESS_FILE);
  
  if (progress[userId] && progress[userId][wordId]) {
    delete progress[userId][wordId];
    writeJSONFile(USER_PROGRESS_FILE, progress);
    return { changes: 1 };
  }
  
  return { changes: 0 };
}

// 事务操作
export async function beginTransaction(): Promise<any> {
  // JSON存储不支持真正的事务，但保持接口兼容性
  return { changes: 0 };
}

export async function commit(): Promise<any> {
  return { changes: 0 };
}

export async function rollback(): Promise<any> {
  return { changes: 0 };
}

// 保持兼容性的SQL接口函数
export async function dbRun(operation: string, table: string, params: any[]): Promise<any> {
  // 处理事务语句
  if (operation === 'BEGIN TRANSACTION' || operation === 'COMMIT' || operation === 'ROLLBACK') {
    if (operation === 'BEGIN TRANSACTION') return beginTransaction();
    if (operation === 'COMMIT') return commit();
    if (operation === 'ROLLBACK') return rollback();
    return { changes: 0 };
  }
  
  if (table === 'users') {
    if (operation === 'INSERT') {
      const [username, email, passwordHash] = params;
      return insertUser(username, email, passwordHash);
    }
  }
  
  if (table === 'user_settings') {
    if (operation === 'INSERT') {
      const [userId] = params;
      return insertUserSettings(userId);
    }
    
    if (operation === 'UPDATE') {
      const [currentGrade, currentViewMode, currentFilter, userId] = params;
      return updateUserSettings(userId, currentGrade, currentViewMode, currentFilter);
    }
  }
  
  if (table === 'user_progress') {
    if (operation === 'UPDATE') {
      const [isLearned, isMastered, userId, wordId] = params;
      return updateUserProgress(userId, wordId, isLearned, isMastered);
    }
    
    if (operation === 'INSERT') {
      const [userId, wordId, grade, isLearned, isMastered] = params;
      return insertUserProgress(userId, wordId, grade, isLearned, isMastered);
    }
    
    if (operation === 'DELETE') {
      const [userId, wordId] = params;
      return deleteUserProgress(userId, wordId);
    }
  }
  
  return { changes: 0 };
}

// 导出数据库对象以保持兼容性
export const db = {
  run: dbRun,
  get: dbGet,
  all: dbAll
};

// 导出新的纯JSON操作接口
export const jsonStorage = {
  // 用户操作
  getUserByUsername,
  getUserByEmail,
  getUserById,
  insertUser,
  
  // 用户设置操作
  getUserSettings,
  insertUserSettings,
  updateUserSettings,
  
  // 用户进度操作
  getUserProgress,
  getLastUpdatedTime,
  updateUserProgress,
  insertUserProgress,
  deleteUserProgress,
  
  // 事务操作
  beginTransaction,
  commit,
  rollback
};