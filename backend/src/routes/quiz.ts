import { Router } from 'express';
import { QuizController } from '../controllers/quizController';
import { authenticateToken } from '../utils/auth';

const router: Router = Router();
const quizController = new QuizController();

// 所有测试数据接口都需要认证
router.use(authenticateToken);

// 保存测试数据（会话 + 结果）
router.post('/save', quizController.saveQuizData.bind(quizController));

// 获取单词记忆数据
router.post('/memories', quizController.getWordMemories.bind(quizController));

export default router;