-- PostgreSQL 数据库初始化脚本
-- 这个脚本会在容器启动时自动执行

-- 设置数据库编码和时区
SET client_encoding = 'UTF8';
SET timezone = 'Asia/Shanghai';

-- 创建扩展（如果需要）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 设置搜索路径
SET search_path TO public;

-- 创建索引优化配置
-- 这些设置已经在应用程序的迁移脚本中处理
-- 这里只是作为文档记录

-- 性能优化设置
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- 提交配置更改
SELECT pg_reload_conf();