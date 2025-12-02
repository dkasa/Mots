# Mots - 法语背单词工具

一款专为初中生设计的法语词汇学习 PWA 应用，支持沪教版初中法语单词学习。

## 功能特色

- 📚 **完整词汇库**：初一上、初一下、初二上学期单词（共1000+词）
- 🎯 **智能学习**：掌握状态跟踪，个性化学习进度
- 📱 **PWA应用**：可安装到桌面，支持离线使用
- ☁️ **云端同步**：学习进度多设备同步（可选）
- 🎨 **移动优化**：专为手机设计，触摸友好

## 快速开始

### 🐘 PostgreSQL 版本（推荐）

#### 环境要求
- Docker & Docker Compose
- Node.js 18+ (用于本地开发)

#### 一键启动
```bash
# Windows PowerShell 开发环境（连接远程数据库）
.\start-dev.ps1

# Linux/macOS
./start-postgres.sh
```

#### 手动启动
```bash
# 启动所有服务（包括 PostgreSQL）
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 测试账号
- 用户名: `demo`, 密码: `demo123`
- 用户名: `testuser`, 密码: `test123`
- 用户名: `admin`, 密码: `admin123`

### 📄 JSON 存储版本（开发用）

#### 环境要求
- Node.js 18+
- pnpm

#### 安装依赖
```bash
# 配置国内源（推荐）
pnpm config set registry https://registry.npmmirror.com

# 安装后端依赖
cd backend
pnpm install

# 安装前端依赖
cd ../app
pnpm install
```

#### 启动开发环境

##### 方式一：使用脚本
```bash
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File start.ps1

# Linux/macOS
./start-dev.sh
```

##### 方式二：手动启动
```bash
# 终端1：启动后端
cd backend
pnpm dev

# 终端2：启动前端
cd app
pnpm dev
```

### 访问地址
- 前端应用：http://localhost:3000/
- 后端API：http://localhost:3001/
- 健康检查：http://localhost:3001/health

## 项目结构

```
Mots/
├── app/                 # React前端应用
│   ├── src/
│   │   ├── components/  # React组件
│   │   ├── hooks/       # 自定义Hook
│   │   ├── lib/         # 工具函数
│   │   └── types/       # TypeScript类型
│   ├── public/          # 静态资源
│   └── dist/           # 构建输出
├── backend/            # Node.js后端API
│   ├── src/
│   │   ├── controllers/ # 控制器
│   │   ├── database/    # 数据库（JSON存储）
│   │   ├── middleware/  # 中间件
│   │   ├── routes/      # 路由
│   │   └── utils/       # 工具函数
│   └── data/           # 数据文件
├── images/             # 项目截图
└── data/              # 词汇数据
```

## 核心功能

### 1. 词汇学习
- 按年级分类学习（初一上、初一下、初二上）
- 法语单词、IPA音标、中文释义显示
- 已掌握/未掌握状态标记
- 自动切换下一个单词

### 2. 进度跟踪
- 实时统计学习进度
- 可视化进度条显示
- 按筛选条件查看单词列表
- 学习状态持久化保存

### 3. 用户系统（可选）
- 用户注册/登录
- 学习进度云端同步
- 离线使用，联网后自动同步

## 技术栈

### 前端
- **React 18** + TypeScript
- **TailwindCSS** - 样式框架
- **Vite** - 构建工具
- **PWA** - Service Worker + Web App Manifest

### 后端
- **Node.js** + Express
- **TypeScript** + tsx
- **JSON存储** - 轻量级数据持久化
- **JWT认证** - 安全的用户认证

## 开发指南

### 本地存储结构
```typescript
// 学习进度存储
interface LearnedWords {
  [grade: string]: {
    [wordId: string]: boolean
  }
}

// 用户设置
interface UserSettings {
  currentGrade: number
  viewMode: 'learn' | 'list'
  filter: 'all' | 'mastered' | 'not-mastered'
}
```

### API接口
```typescript
// 用户认证
POST /api/auth/register    // 用户注册
POST /api/auth/login       // 用户登录

// 学习进度
POST /api/progress/sync    // 同步进度
GET  /api/progress         // 获取进度
```

## 部署说明

### 开发环境
支持热重载，前后端分离开发

### 生产环境
前后端打包在一起，单端口部署

### 数据存储
- 开发环境：JSON文件存储（backend/data/）
- 生产环境：支持扩展为数据库存储

## 常见问题

### Q: 如何切换到国内源？
A: 执行 `pnpm config set registry https://registry.npmmirror.com`

### Q: 数据保存在哪里？
A: 开发环境保存在 `backend/data/` 目录下的JSON文件中

### Q: 如何重置学习进度？
A: 删除 `backend/data/` 目录下的JSON文件即可

### Q: 支持离线使用吗？
A: 是的，PWA支持离线使用，联网后自动同步数据

## 许可证

本项目采用 MIT 许可证。

---

**Mots** - 让法语学习更简单高效 🇫🇷
