import { Router } from 'express';
import { syncProgress, getProgress, getLastSyncTimestamp } from '../controllers/progressController';
import { authenticateToken } from '../utils/auth';
import { validateBody, progressSyncSchema } from '../middleware/validation';

const router: Router = Router();

// 所有进度路由都需要认证
router.use(authenticateToken);

// 同步进度
router.post('/sync', validateBody(progressSyncSchema), syncProgress);

// 获取进度
router.get('/', getProgress);

// 获取最后同步时间戳
router.get('/timestamp', getLastSyncTimestamp);

export default router;