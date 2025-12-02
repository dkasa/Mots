# 数据库管理指南

## 概述

Mots 支持两种数据存储方式：
- **PostgreSQL 17** (生产环境推荐)
- **JSON 文件** (开发环境)

## 🐘 PostgreSQL 管理

### 环境变量配置

```env
# 启用 PostgreSQL
USE_POSTGRES=true

# 连接配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mots
DB_USER=postgres
DB_PASSWORD=password
```

### CLI 工具

项目提供了完整的数据库管理 CLI：

```bash
# 测试连接
npm run db:test

# 初始化数据库结构
npm run db:init

# 查看状态
npm run db:status

# 数据迁移
npm run db:migrate

# 重置数据库
npm run db:reset

# 添加种子数据
npm run db:seed
```

### 数据库架构

#### 用户表 (users)
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 用户设置表 (user_settings)
```sql
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_grade INTEGER DEFAULT 81,
    current_view_mode VARCHAR(20) DEFAULT 'learn',
    current_filter VARCHAR(20) DEFAULT 'all',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);
```

#### 用户进度表 (user_progress)
```sql
CREATE TABLE user_progress (
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
```

### 索引优化

```sql
-- 性能索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_word_id ON user_progress(word_id);
CREATE INDEX idx_user_progress_grade ON user_progress(grade);
CREATE INDEX idx_user_progress_mastered ON user_progress(is_mastered);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
```

### 备份与恢复

#### 备份数据库
```bash
# 创建备份
docker-compose exec postgres pg_dump -U postgres mots > backup.sql

# 压缩备份
gzip backup.sql
```

#### 恢复数据库
```bash
# 解压备份
gunzip backup.sql.gz

# 恢复数据
docker-compose exec -T postgres psql -U postgres mots < backup.sql
```

### 性能监控

#### 查看连接数
```sql
SELECT count(*) FROM pg_stat_activity;
```

#### 查看慢查询
```sql
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

#### 查看表大小
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 📄 JSON 存储管理

### 文件结构

```
data/
├── users.json          # 用户账户数据
├── user_progress.json   # 学习进度数据
├── user_settings.json   # 用户设置数据
└── backup_*/           # 自动备份目录
```

### 数据格式

#### users.json
```json
{
  "1": {
    "id": "1",
    "username": "demo",
    "email": "demo@mots.com",
    "password_hash": "...",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### user_progress.json
```json
{
  "1": {
    "81_1": {
      "id": "1_81_1",
      "user_id": "1",
      "word_id": "81_1",
      "grade": 81,
      "is_learned": true,
      "is_mastered": false,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### user_settings.json
```json
{
  "1": {
    "id": "1",
    "user_id": "1",
    "current_grade": 81,
    "current_view_mode": "learn",
    "current_filter": "all",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 备份策略

JSON 存储会在以下情况自动备份：
- 执行 PostgreSQL 迁移前
- 手动重置数据库前

备份目录格式：`data/backup_YYYY-MM-DD-HH-mm-ss/`

## 🔄 数据迁移

### JSON → PostgreSQL

```bash
# 方法一：使用 CLI 工具
npm run db:migrate

# 方法二：使用 Docker
docker-compose exec backend npm run db:migrate
```

迁移过程：
1. 自动备份 JSON 文件
2. 创建 PostgreSQL 表结构
3. 迁移用户数据
4. 迁移用户设置
5. 迁移学习进度

### PostgreSQL → JSON

```bash
# 1. 导出数据
docker-compose exec postgres pg_dump -U postgres mots > export.sql

# 2. 转换为 JSON 格式（需要自定义脚本）

# 3. 切换到 JSON 模式
# 编辑 .env 文件：USE_POSTGRES=false

# 4. 重启服务
docker-compose restart backend
```

## 🛠️ 故障排除

### 常见问题

#### 1. 连接失败
```bash
# 检查 PostgreSQL 状态
docker-compose ps postgres

# 检查连接配置
docker-compose exec backend npm run db:test

# 查看日志
docker-compose logs postgres
```

#### 2. 权限错误
```sql
-- 重新授权
GRANT ALL PRIVILEGES ON DATABASE mots TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
```

#### 3. 数据损坏
```bash
# 重置数据库
npm run db:reset

# 从备份恢复
docker-compose exec postgres psql -U postgres mots < backup.sql
```

### 性能优化

#### PostgreSQL 配置
```sql
-- 内存配置
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';

-- 连接配置
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';

-- WAL 配置
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- 应用配置
SELECT pg_reload_conf();
```

#### 应用层优化
- 使用连接池
- 批量操作
- 合理的索引
- 查询缓存

## 📊 监控

### 健康检查
```bash
# 应用健康状态
curl http://localhost:3001/health

# 数据库状态
npm run db:status
```

### 日志监控
```bash
# 应用日志
docker-compose logs -f backend

# 数据库日志
docker-compose logs -f postgres

# 系统资源
docker stats
```

## 🔒 安全

### 数据库安全
1. 使用强密码
2. 限制网络访问
3. 定期更新
4. 启用 SSL（生产环境）

### 应用安全
1. 密码哈希（bcrypt）
2. JWT 认证
3. 输入验证
4. SQL 注入防护

---

**注意**：在生产环境中，请务必：
1. 使用强密码
2. 启用 SSL 连接
3. 定期备份数据
4. 监控性能指标
5. 及时更新依赖包