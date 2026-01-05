#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 最简单的版本生成器 - 基于时间戳生成唯一版本号
const generateVersion = () => {
  const now = new Date();
  const timestamp = now.getTime(); // 毫秒时间戳确保唯一性
  
  // 简单的时间格式: YYYYMMDD-HHMMSS
  const timeVersion = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  
  const versionInfo = {
    version: timeVersion,
    buildVersion: timeVersion,
    buildTime: now.toISOString(),
    timestamp: timestamp,
    environment: process.env.BUILD_MODE || 'development',
    description: "法语词汇学习应用 - 自动生成版本信息"
  };
  
  return versionInfo;
};

// 主函数
const main = () => {
  try {
    const projectRoot = path.resolve(__dirname, '..');
    const publicDir = path.join(projectRoot, 'public');
    const versionFile = path.join(publicDir, 'version.json');
    
    // 生成版本信息
    const versionInfo = generateVersion();
    
    // 确保public目录存在
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // 写入版本文件
    fs.writeFileSync(versionFile, JSON.stringify(versionInfo, null, 2));
    
    console.log('✅ 版本文件已生成:', versionFile);
    console.log('📦 版本号:', versionInfo.version);
    console.log('⏰ 构建时间:', versionInfo.buildTime);
    
  } catch (error) {
    console.error('❌ 版本生成失败:', error.message);
    process.exit(1);
  }
};

// 直接运行
main();