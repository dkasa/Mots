import { Router } from 'express';
import { register, login, getUserProfile } from '../controllers/authController';
import { authenticateToken } from '../utils/auth';
import { validateBody, loginSchema, registerSchema } from '../middleware/validation';

const router = Router();

// 注册
router.post('/register', validateBody(registerSchema), register);

// 登录
router.post('/login', validateBody(loginSchema), login);

// 获取用户信息（需要认证）
router.get('/profile', authenticateToken, getUserProfile);

export default router;