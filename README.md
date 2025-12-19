# Mots - 法语背单词工具

一款专为初中生设计的现代化法语词汇学习 PWA 应用，支持沪教版初中法语单词学习。

## 🚀 功能特色

- 📚 **完整词汇库**：初一上、初一下、初二上学期单词（共1000+词）
- 🔊 **真人语音**：支持男声/女声发音，智能处理复合单词
- 🎯 **智能学习**：掌握状态跟踪，个性化学习进度
- 🔍 **单词搜索**：快速查找所需单词，支持模糊匹配
- 📱 **PWA应用**：可安装到桌面，支持离线使用
- ☁️ **云端同步**：学习进度多设备同步
- 🎨 **移动优化**：支持PC、手机端，触摸友好
- 🌙 **暗色模式**：支持切换护眼模式，保护视力

## 🚀 快速开始

### 🐘 PostgreSQL 版本（生产环境推荐）

#### 环境要求
- Docker & Docker Compose
- Node.js 18+ (用于本地开发)

#### 一键启动
```bash
# Windows PowerShell 开发环境
.\start.ps1

# Linux/macOS
./start.sh
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
### 📄 JSON 存储版本（开发环境）

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
./start.sh
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

### 🌐 访问地址
- 前端应用：http://localhost:3000/
- 后端API：http://localhost:3001/
- 健康检查：http://localhost:3001/health

## 📁 项目结构

```
Mots/
├── app/                 # React前端应用 (Vite + TypeScript)
│   ├── src/
│   │   ├── components/  # React组件库
│   │   ├── hooks/       # 自定义Hook
│   │   ├── lib/         # 工具函数
│   │   ├── services/    # API服务
│   │   ├── types/       # TypeScript类型定义
│   │   └── styles/      # 样式文件
│   ├── public/          # 静态资源 (PWA配置)
│   └── dist/           # 构建输出
├── backend/            # Node.js后端API (Express + TypeScript)
│   ├── src/
│   │   ├── controllers/ # 控制器
│   │   ├── database/    # 数据库操作 (PostgreSQL/JSON)
│   │   ├── middleware/  # 中间件 (认证、错误处理)
│   │   ├── routes/      # 路由定义
│   │   ├── utils/       # 工具函数
│   │   └── cli/         # 命令行工具
│   └── data/           # 开发环境数据文件
├── data/              # 词汇数据文件 (JSON格式)
├── audio/             # 音频文件目录 (按年级/性别分类)
├── docker/            # Docker配置文件
└── images/            # 页面截图
```

## 📄 许可证

本项目采用 MIT 许可证。

---

**Mots** - 让法语学习更简单高效 🇫🇷

*最后更新: 2025年12月*