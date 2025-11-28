#!/bin/bash

echo "🚀 启动 Mots 开发环境..."

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

# 启动开发环境
echo "📦 构建并启动前端和后端服务..."
docker-compose up --build -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

echo ""
echo "✅ 开发环境启动成功！"
echo ""
echo "🌐 前端开发地址: http://localhost:2402"
echo "🔧 后端API地址: http://localhost:3001"
echo "📊 健康检查: http://localhost:3001/health"
echo ""
echo "📋 常用命令:"
echo "  查看日志: docker-compose logs -f"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"
echo ""
echo "💡 提示: 前端支持热重载，修改代码会自动刷新页面"