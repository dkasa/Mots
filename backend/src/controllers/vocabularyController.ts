import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// 单词表文件列表
const VOCABULARY_FILES = [
  'grade71_words.json',
  'grade72_words.json', 
  'grade81_words.json',
  'grade82_words.json',
  'grade91_words.json',
  'grade92_words.json'
];

// 计算文件的MD5哈希
async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('md5');
    hash.update(fileBuffer);
    return hash.digest('hex');
  } catch (error) {
    console.error(`Error calculating hash for ${filePath}:`, error);
    throw error;
  }
}

// 获取所有单词表文件的哈希值
export const getVocabularyHashes = async (req: Request, res: Response) => {
  try {
    // 使用相对于后端目录的路径访问前端public/data目录
    const dataDir = path.join(process.cwd(), '..', 'app', 'public', 'data');
    
    const hashes: Record<string, string> = {};
    const timestamps: Record<string, string> = {};
    
    for (const filename of VOCABULARY_FILES) {
      const filePath = path.join(dataDir, filename);
      
      try {
        // 检查文件是否存在
        await fs.access(filePath);
        
        // 计算哈希
        const hash = await calculateFileHash(filePath);
        hashes[filename] = hash;
        
        // 获取文件修改时间
        const stats = await fs.stat(filePath);
        timestamps[filename] = stats.mtime.toISOString();
        
      } catch (error) {
        console.warn(`File not found or inaccessible: ${filename}`);
        hashes[filename] = 'not_found';
        timestamps[filename] = 'not_found';
      }
    }
    
    res.json({
      success: true,
      data: {
        hashes,
        timestamps,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error getting vocabulary hashes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate vocabulary file hashes'
    });
  }
};