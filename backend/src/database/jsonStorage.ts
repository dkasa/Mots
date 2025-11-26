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
    fs.writeFileSync(filename, JSON.stringify(defaultData, null, 2));
  }
}

export function initDatabase() {
  initDataFile(USERS_FILE, {});
  initDataFile(USER_PROGRESS_FILE, {});
  initDataFile(USER_SETTINGS_FILE, {});
  console.log('Database initialized successfully');
}

// 用户相关操作
export async function dbGet(sql: string, params: any[] = []): Promise<any> {
  if (sql.includes('users')) {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (sql.includes('WHERE username = ?')) {
      return Object.values(users).find((user: any) => user.username === params[0]);
    }
    if (sql.includes('WHERE email = ?')) {
      return Object.values(users).find((user: any) => user.email === params[0]);
    }
    if (sql.includes('WHERE id = ?')) {
      return users[params[0]];
    }
  }
  
  if (sql.includes('user_settings')) {
    const settings = JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8'));
    if (sql.includes('WHERE user_id = ?')) {
      return settings[params[0]];
    }
  }
  
  return null;
}

export async function dbAll(sql: string, params: any[] = []): Promise<any[]> {
  if (sql.includes('user_progress')) {
    const progress = JSON.parse(fs.readFileSync(USER_PROGRESS_FILE, 'utf8'));
    if (sql.includes('WHERE user_id = ?')) {
      const userProgress = progress[params[0]] || {};
      return Object.entries(userProgress).map(([word_id, data]: [string, any]) => ({
        word_id,
        ...data
      }));
    }
  }
  
  return [];
}

export async function dbRun(sql: string, params: any[] = []): Promise<any> {
  if (sql.includes('INSERT INTO users')) {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const [username, email, passwordHash] = params;
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
    
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return { lastID: parseInt(id) };
  }
  
  if (sql.includes('INSERT INTO user_settings')) {
    const settings = JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8'));
    const [userId] = params;
    
    settings[userId] = {
      id: (Object.keys(settings).length + 1).toString(),
      user_id: userId,
      current_grade: 81,
      current_view_mode: 'learn',
      current_filter: 'all',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return { lastID: 1 };
  }
  
  if (sql.includes('UPDATE user_settings')) {
    const settings = JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8'));
    const [currentGrade, currentViewMode, currentFilter, userId] = params;
    
    if (settings[userId]) {
      settings[userId].current_grade = currentGrade;
      settings[userId].current_view_mode = currentViewMode;
      settings[userId].current_filter = currentFilter;
      settings[userId].updated_at = new Date().toISOString();
    }
    
    fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return { changes: 1 };
  }
  
  if (sql.includes('UPDATE user_progress')) {
    const progress = JSON.parse(fs.readFileSync(USER_PROGRESS_FILE, 'utf8'));
    const [isLearned, isMastered, userId, wordId] = params;
    
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
    
    fs.writeFileSync(USER_PROGRESS_FILE, JSON.stringify(progress, null, 2));
    return { changes: 1 };
  }
  
  if (sql.includes('INSERT INTO user_progress')) {
    const progress = JSON.parse(fs.readFileSync(USER_PROGRESS_FILE, 'utf8'));
    const [userId, wordId, grade, isLearned, isMastered] = params;
    
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
    
    fs.writeFileSync(USER_PROGRESS_FILE, JSON.stringify(progress, null, 2));
    return { lastID: 1 };
  }
  
  if (sql.includes('DELETE FROM user_progress')) {
    const progress = JSON.parse(fs.readFileSync(USER_PROGRESS_FILE, 'utf8'));
    const [userId, wordId] = params;
    
    if (progress[userId] && progress[userId][wordId]) {
      delete progress[userId][wordId];
      fs.writeFileSync(USER_PROGRESS_FILE, JSON.stringify(progress, null, 2));
      return { changes: 1 };
    }
    
    return { changes: 0 };
  }
  
  return { changes: 0 };
}

// 导出数据库对象以保持兼容性
export const db = {
  run: dbRun,
  get: dbGet,
  all: dbAll
};