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

-- AI题目缓存表 - 存储AI生成的题目
CREATE TABLE IF NOT EXISTS ai_generated_questions (
  id SERIAL PRIMARY KEY,
  word_id VARCHAR(50) NOT NULL,
  question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('sentence-completion', 'sentence-reordering')),
  word VARCHAR(255) NOT NULL,
  meaning VARCHAR(255) NOT NULL,
  grade INTEGER NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  original_sentence TEXT NOT NULL,

  -- 填空题专用字段
  modified_sentence TEXT,
  options TEXT[],

  -- 重组题专用字段
  word_blocks TEXT[],
  shuffled_blocks TEXT[],

  -- 通用字段
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 复合索引：最常用的查询（单词+题型）
CREATE INDEX IF NOT EXISTS idx_ai_questions_word_type
  ON ai_generated_questions(word_id, question_type);

-- 单独索引：按题型查询
CREATE INDEX IF NOT EXISTS idx_ai_questions_question_type
  ON ai_generated_questions(question_type);

-- 时间索引：查看最新生成的题目
CREATE INDEX IF NOT EXISTS idx_ai_questions_created_at
  ON ai_generated_questions(created_at DESC);

-- 触发器：自动更新时间
CREATE OR REPLACE FUNCTION update_ai_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ai_questions_updated_at ON ai_generated_questions;
CREATE TRIGGER update_ai_questions_updated_at
    BEFORE UPDATE ON ai_generated_questions
    FOR EACH ROW EXECUTE FUNCTION update_ai_questions_updated_at();

-- 题目评估表（点赞/反赞）
CREATE TABLE IF NOT EXISTS question_ratings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES ai_generated_questions(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating IN (1, -1)),  -- 1=赞, -1=反赞
  rated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, question_id)  -- 每个用户对每个题目只能评价一次
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_question_ratings_user_id ON question_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_question_ratings_question_id ON question_ratings(question_id);
CREATE INDEX IF NOT EXISTS idx_question_ratings_rating ON question_ratings(rating);

-- 创建触发器自动更新时间
CREATE OR REPLACE FUNCTION update_question_ratings_rated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.rated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_question_ratings_rated_at ON question_ratings;
CREATE TRIGGER update_question_ratings_rated_at
    BEFORE UPDATE ON question_ratings
    FOR EACH ROW EXECUTE FUNCTION update_question_ratings_rated_at();

-- 检查表是否创建成功
SELECT 'AI题目缓存表和题目评估表创建完成' as status;