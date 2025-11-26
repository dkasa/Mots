# Docker 部署指南

## 快速部署

### 1. 使用 Docker Compose（推荐）

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问地址：
- 前端：http://localhost:2402
- 后端API：http://localhost:3001

### 2. 单独构建和运行

#### 构建前端
```bash
cd docker
docker build -f Dockerfile.frontend -t mots-frontend ..
docker run -d -p 2402:2402 --name mots-frontend mots-frontend
```

#### 构建后端
```bash
cd docker
docker build -f Dockerfile.backend -t mots-backend ..
docker run -d -p 3001:3001 --name mots-backend -v $(pwd)/../../data:/app/data mots-backend
```

## 环境变量配置

### 前端环境变量
- `VITE_API_URL`: 后端API地址（默认：http://localhost:3001）

### 后端环境变量
- `NODE_ENV`: 运行环境（development/production）
- `PORT`: 服务端口（默认：3001）
- `CORS_ORIGIN`: 允许的跨域来源
- `JWT_SECRET`: JWT密钥（生产环境必须设置）

## 数据持久化

后端数据存储在 `./data` 目录，通过Docker volume挂载到容器内的 `/app/data`。

## 生产环境部署

### 1. 使用环境变量文件
创建 `.env` 文件：
```env
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-domain.com
JWT_SECRET=your-secret-key-here
```

### 2. 使用反向代理
使用Nginx或Traefik作为反向代理，配置SSL证书。

### 3. 健康检查
- 后端健康检查：GET /health
- 前端：检查nginx状态

## 故障排除

### 查看容器状态
```bash
docker ps
docker-compose ps
```

### 查看日志
```bash
docker logs mots-frontend
docker logs mots-backend
docker-compose logs frontend
docker-compose logs backend
```

### 重新构建
```bash
docker-compose build --no-cache
docker-compose up -d
```

## 网络配置

默认使用Docker bridge网络 `mots-network`，前后端通过容器名通信。

## 性能优化

- 前端：使用nginx缓存静态资源
- 后端：可根据需要添加Redis缓存
- 数据库：当前使用JSON文件存储，生产环境建议迁移到PostgreSQL或MongoDB