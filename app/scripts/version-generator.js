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
  
  // 转换为北京时间 (UTC+8)
  const beijingOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
  const beijingTime = new Date(now.getTime() + beijingOffset);
  
  // 使用北京时间
  const beijingYear = beijingTime.getUTCFullYear();
  const beijingMonth = (beijingTime.getUTCMonth() + 1).toString().padStart(2, '0');
  const beijingDate = beijingTime.getUTCDate().toString().padStart(2, '0');
  const beijingHours = beijingTime.getUTCHours().toString().padStart(2, '0');
  const beijingMinutes = beijingTime.getUTCMinutes().toString().padStart(2, '0');
  const beijingSeconds = beijingTime.getUTCSeconds().toString().padStart(2, '0');
  
  // 北京时间格式: YYYYMMDD-HHMMSS (UTC+8)
  const timeVersion = `${beijingYear}${beijingMonth}${beijingDate}-${beijingHours}${beijingMinutes}${beijingSeconds}`;
  
  const versionInfo = {
    version: timeVersion,
    buildVersion: timeVersion,
    buildTime: now.toISOString(),
    timestamp: timestamp,
    environment: process.env.BUILD_MODE || 'development',
    description: "法语词汇学习应用 - 自动生成版本信息",
    timezone: "UTC+8 (北京时间)"
  };
  
  return versionInfo;
};

// 主函数
const main = () => {
  try {
    const projectRoot = path.resolve(__dirname, '..');
    const publicDir = path.join(projectRoot, 'public');
    const distDir = path.join(projectRoot, 'dist');
    const versionFile = path.join(publicDir, 'version.json');
    const distVersionFile = path.join(distDir, 'version.json');
    
    // 生成版本信息
    const versionInfo = generateVersion();
    
    // 确保public目录存在
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // 写入版本文件到public目录
    fs.writeFileSync(versionFile, JSON.stringify(versionInfo, null, 2));
    console.log('✅ 版本文件已生成:', versionFile);
    console.log('📦 版本号:', versionInfo.version);
    console.log('⏰ 构建时间:', versionInfo.buildTime);
    
    // 如果dist目录存在，也写入版本文件
    if (fs.existsSync(distDir)) {
      fs.writeFileSync(distVersionFile, JSON.stringify(versionInfo, null, 2));
      console.log('✅ 版本文件已复制到dist:', distVersionFile);
    } else {
      console.log('ℹ️  dist目录不存在，跳过复制版本文件（构建后会自动复制）');
    }
    
  } catch (error) {
    console.error('❌ 版本生成失败:', error.message);
    process.exit(1);
  }
};

// 直接运行
main();