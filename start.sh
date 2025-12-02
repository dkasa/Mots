#!/bin/bash

echo "🚀 启动 Mots PostgreSQL 版本..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 检查 docker-compose 是否存在
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose 未安装"
    exit 1
fi

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose down

# 构建并启动服务
echo "🏗️ 构建并启动服务..."
docker-compose up --build -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose ps

# 测试数据库连接
echo "🔍 测试数据库连接..."
docker-compose exec backend pnpm run db:test

# 初始化数据库（如果需要）
echo "🏗️ 初始化数据库..."
docker-compose exec backend pnpm run db:init

# 添加种子数据
echo "🌱 添加种子数据..."
docker-compose exec backend pnpm run db:seed

# 显示服务信息
echo ""
echo "✅ 服务启动完成！"
echo ""
echo "🌐 服务地址："
echo "  前端: http://localhost:2402"
echo "  后端: http://localhost:3001"
echo "  健康检查: http://localhost:3001/health"
echo ""
echo "📋 测试账号："
echo "  用户名: demo,    密码: demo123"
echo "  用户名: testuser, 密码: test123"
echo "  用户名: admin,   密码: admin123"
echo ""
echo "🔧 管理命令："
echo "  查看日志: docker-compose logs -f"
echo "  停止服务: docker-compose down"
echo "  重启后端: docker-compose restart backend"
echo "  数据库状态: docker-compose exec backend pnpm run db:status"
echo ""