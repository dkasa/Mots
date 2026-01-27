import { Router } from 'express';
import { getVocabularyHashes } from '../controllers/vocabularyController';
import { authenticateToken } from '../utils/auth';

const router: Router = Router();

// 获取单词表文件哈希 - 不需要认证，因为单词表是公共数据
router.get('/hashes', getVocabularyHashes);

export default router;