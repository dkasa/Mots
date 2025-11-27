# 更新记录

## v1.2.1 - 2025-11-27

### ✨ 新功能
- **灵活的单词选择模式**
  - 新增按单元选择单词功能：支持选择指定单元范围（如单元1-3）
  - 新增按随机个数选择功能：支持随机选择10/20/50/100个单词进行学习
  - 保留原有的全部单词选择模式
  - 三种模式满足不同学习场景需求

### ✨ 界面优化
- **抽屉式单词选择器**
  - 将单词选择功能改为抽屉式交互设计
  - 默认收起状态，节省屏幕空间
  - 点击展开详细设置，设置完成后自动收起
  - 平滑的动画过渡效果
  - 显示当前选择模式的摘要信息

- **单词过滤选择功能**
  - 新增单词状态过滤标签页
  - 支持按"全部"、"已掌握"、"未掌握"筛选单词
  - 实时显示各分类的单词数量统计
  - 圆角胶囊式设计，支持横向滚动
  - 列表模式下的快速筛选体验

### 🎨 用户体验改进
- 紧凑的触发按钮设计，优化界面布局
- 箭头图标动画效果，直观显示开合状态
- 选择"全部"模式时自动关闭抽屉
- 过滤标签页的视觉反馈和hover效果
- 单元范围选择的直观下拉菜单
- 随机数量选择的快捷按钮组

### 🔧 技术优化
- 创建新的 `SelectionDrawer.tsx` 组件
- 创建新的 `FilterTabs.tsx` 过滤组件
- 删除旧的 `SelectionModeSelector.tsx` 组件
- 扩展类型定义：新增 `SelectionMode`、`UnitRange`、`CountSelection`
- 优化单词筛选算法，支持单元范围过滤和随机选择
- 本地存储支持新的选择模式状态
- 保持所有原有功能完整性

### 📦 文件变更
**新增文件:**
```
app/src/components/SelectionDrawer.tsx  # 抽屉式选择器组件
app/src/components/FilterTabs.tsx       # 单词过滤标签页组件
```

**删除文件:**
```
app/src/components/SelectionModeSelector.tsx  # 旧的选择器组件
```

**修改文件:**
- `app/src/App.tsx` - 替换选择器组件引用，集成过滤和选择功能
- `app/src/components/ListMode.tsx` - 集成过滤标签页
- `app/src/types/vocabulary.ts` - 扩展类型定义，添加选择模式相关类型
- `app/src/hooks/useLocalStorage.ts` - 添加选择模式和过滤状态管理
- `app/src/hooks/useVocabularyData.ts` - 实现单元范围过滤和随机选择逻辑

---

## v1.2.0 - 2025-11-26

### 🎉 重大更新：用户认证与云端同步

### ✨ 新功能
- **用户认证系统**
  - 用户注册/登录功能
  - JWT token认证
  - 密码安全哈希存储
  - 登录状态自动刷新

- **云端进度同步**
  - 双向同步策略 (支持增删操作)
  - 8秒防抖机制
  - 时间戳冲突解决
  - 离线数据缓存

- **局域网访问支持**
  - 后端监听所有网络接口 (0.0.0.0)
  - 动态API地址配置
  - CORS跨域支持

- **Docker部署**
  - 完整的Docker Compose配置
  - 前后端分离部署
  - 数据持久化
  - 一键启动脚本

### 🔧 技术改进
- **前端架构**
  - React + TypeScript
  - Tailwind CSS响应式设计
  - Context API状态管理
  - 自定义Hook封装

- **后端架构**
  - Node.js + Express
  - JSON文件存储系统
  - RESTful API设计
  - 错误处理中间件

- **用户体验**
  - 法语单词字号加大2倍
  - 学习模式防干扰同步
  - 自动页面刷新机制
  - 加载状态优化

### 🛠️ 部署优化
- **开发环境**
  - 统一启动脚本 (`start.ps1`)
  - 开发数据清理工具
  - 环境变量配置

- **生产环境**
  - Docker容器化部署
  - Nginx静态文件服务
  - 数据卷挂载
  - 健康检查端点

### 🔒 安全改进
- 用户数据gitignore隔离
- JWT token安全存储
- CORS策略配置
- 密码强度验证

### 📦 文件变更
**新增文件:**
```
backend/                    # 后端服务
├── src/
│   ├── controllers/        # 控制器
│   ├── database/          # 数据存储
│   ├── middleware/        # 中间件
│   ├── routes/            # 路由
│   └── utils/             # 工具函数
├── package.json
└── tsconfig.json

app/src/
├── components/
│   ├── AuthModal.tsx      # 认证弹窗
│   ├── UserMenu.tsx       # 用户菜单
│   ├── SyncStatusIndicator.tsx  # 同步状态
│   └── ui/                # UI组件库
├── hooks/
│   ├── useAuth.ts         # 认证Hook
│   ├── useCloudStorage.ts # 云存储Hook
│   └── useSyncProgress.ts # 同步Hook
├── services/
│   └── api.ts             # API服务
└── types/
    └── auth.ts            # 认证类型

docker/
├── Dockerfile.frontend    # 前端Docker
├── Dockerfile.backend     # 后端Docker
└── nginx.conf            # Nginx配置

scripts/
├── clean-dev-data.sh      # Linux清理脚本
└── clean-dev-data.ps1     # Windows清理脚本

docker-compose.yml         # Docker编排
DOCKER_DEPLOY.md          # 部署文档
start.ps1                 # 启动脚本
start-dev.sh              # Linux启动脚本
```

**删除文件:**
```
code/                      # 旧代码目录
├── compile_french_vocabulary.py
└── validate_vocab.py
setup_node_pnpm.ps1       # 旧安装脚本
```

**修改文件:**
- `app/src/App.tsx` - 集成认证和同步
- `app/src/components/WordCard.tsx` - 字号优化
- `app/src/components/TopBar.tsx` - 添加用户界面
- `.gitignore` - 添加数据目录隔离
- `README.md` - 更新使用说明

### 🚀 快速开始
```bash
# 开发环境
./start.ps1

# Docker部署
docker-compose up -d


### 📱 访问地址
- 前端: http://localhost:3000
- 后端API: http://localhost:3001
- 健康检查: http://localhost:3001/health

---

## v1.0.0 - 初始版本
- 基础法语词汇学习功能
- 本地进度存储
- 单词卡片学习模式
- 列表浏览模式