import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase, healthCheck, getDatabaseType } from './database';

// 导入路由
import authRoutes from './routes/auth';
import progressRoutes from './routes/progress';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// 中间件
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: true, // 允许所有来源
  credentials: true
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

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/progress', progressRoutes);

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