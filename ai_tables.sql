-- AI连接配置表 - 数据库建表语句
-- 如果数据库表不存在，请执行此脚本

-- AI连接配置表
CREATE TABLE IF NOT EXISTS ai_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('openai', 'siliconflow')),
  base_url VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  model VARCHAR(100) NOT NULL,
  max_tokens INTEGER DEFAULT 1000,
  temperature REAL DEFAULT 0.7,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_ai_connections_user_id ON ai_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_connections_enabled ON ai_connections(enabled);

-- 创建触发器自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_ai_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ai_connections_updated_at ON ai_connections;
CREATE TRIGGER update_ai_connections_updated_at 
    BEFORE UPDATE ON ai_connections 
    FOR EACH ROW EXECUTE FUNCTION update_ai_connections_updated_at();

-- 检查表是否创建成功
SELECT 'AI连接配置表创建完成' as status;