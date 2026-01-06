import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase, healthCheck, getDatabaseType } from './database';

// 导入路由
import authRoutes from './routes/auth';
import progressRoutes from './routes/progress';
import quizRoutes from './routes/quiz';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// 中间件
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 更宽松的CORS配置，支持移动设备访问
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000', 
    'http://192.168.0.28:3000',
    // 允许所有localhost和127.0.0.1的端口
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    // 允许192.168.x.x网段的所有端口
    /^http:\/\/192\.168\.0\.\d+:\d+$/,
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    // 允许手机可能使用的其他IP段
    /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
    /^http:\/\/172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+:\d+$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // 添加预检请求缓存时间
  maxAge: 86400 // 24小时
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查端点
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        type: getDatabaseType(),
        ...dbHealth
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: {
        type: getDatabaseType(),
        error: 'Database connection failed'
      }
    });
  }
});

// API路由 - 支持两种路径格式以兼容不同环境
app.use('/api/auth', authRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/quiz', quizRoutes);
// 兼容生产环境nginx配置（移除/api前缀）
app.use('/auth', authRoutes);
app.use('/progress', progressRoutes);
app.use('/quiz', quizRoutes);

// API健康检查路由
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        type: getDatabaseType(),
        ...dbHealth
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: {
        type: getDatabaseType(),
        error: 'Database connection failed'
      }
    });
  }
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 LAN access: http://[YOUR_IP]:${PORT}/health`);
      console.log(`🌐 Listening on all interfaces (0.0.0.0)`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();