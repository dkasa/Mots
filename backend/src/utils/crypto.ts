import crypto from 'crypto';

// 加密密钥 - 应该从环境变量中获取
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars-long!';
const ALGORITHM = 'aes-256-cbc'; // 使用简单的CBC模式，避免GCM的复杂认证

// 确保密钥长度正确（32字节）
function getValidKey(): Buffer {
  // 如果密钥长度不足32字节，使用SHA256哈希扩展到32字节
  if (ENCRYPTION_KEY.length < 32) {
    return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  }
  // 如果超过32字节，截取前32字节
  return Buffer.from(ENCRYPTION_KEY.substring(0, 32));
}

/**
 * 加密API密钥
 */
export function encryptAPIKey(apiKey: string): string {
  try {
    const key = getValidKey();
    const iv = crypto.randomBytes(16); // 初始化向量
    
    // 使用统一的加密方法
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 返回格式: iv:encryptedData
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('加密API密钥失败:', error);
    throw new Error('加密失败');
  }
}

/**
 * 解密API密钥
 */
export function decryptAPIKey(encryptedData: string): string {
  try {
    const key = getValidKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 2) {
      throw new Error('无效的加密数据格式');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // 使用统一的解密方法
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('解密API密钥失败:', error);
    // 返回空字符串而不是抛出错误，让调用方处理
    return '';
  }
}

/**
 * 检查是否为加密格式
 */
export function isEncrypted(data: string): boolean {
  // 检查格式是否为 iv:encryptedData
  const parts = data.split(':');
  return parts.length === 2 && 
         parts[0].length === 32 && // iv 应该是16字节，hex编码后32字符
         parts[1].length > 0;      // 加密数据应该非空
}

/**
 * 安全地处理API密钥 - 用于日志记录等场景
 */
export function maskAPIKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '***';
  }
  return apiKey.substring(0, 4) + '***' + apiKey.substring(apiKey.length - 4);
}