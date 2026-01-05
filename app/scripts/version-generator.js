#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 自动版本号生成器
 * 基于Git提交信息自动生成版本号
 */
class VersionGenerator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.publicDir = path.join(this.projectRoot, 'public');
    this.versionFile = path.join(this.publicDir, 'version.json');
  }

  /**
   * 获取Git提交信息
   */
  getGitInfo() {
    try {
      // 获取当前分支
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
        cwd: this.projectRoot,
        encoding: 'utf8' 
      }).trim();

      // 获取最新提交的短哈希
      const commitHash = execSync('git rev-parse --short HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      // 获取提交时间
      const commitTime = execSync('git log -1 --format=%cd --date=iso', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      // 获取提交信息
      const commitMessage = execSync('git log -1 --format=%s', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      // 检查是否有未提交的更改
      const hasUncommittedChanges = execSync('git status --porcelain', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim().length > 0;

      return {
        branch,
        commitHash,
        commitTime,
        commitMessage,
        hasUncommittedChanges
      };
    } catch (error) {
      console.warn('无法获取Git信息，使用默认版本号:', error.message);
      return {
        branch: 'unknown',
        commitHash: 'unknown',
        commitTime: new Date().toISOString(),
        commitMessage: 'Unknown commit',
        hasUncommittedChanges: false
      };
    }
  }

  /**
   * 生成语义化版本号
   */
  generateSemanticVersion(gitInfo) {
    const now = new Date();
    
    // 基于时间的版本号格式: YYYY.MM.DD.HHMM
    const timeVersion = `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}.${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 如果有未提交的更改，添加dirty标记
    const dirtySuffix = gitInfo.hasUncommittedChanges ? '-dirty' : '';
    
    return `${timeVersion}-${gitInfo.commitHash}${dirtySuffix}`;
  }

  /**
   * 读取现有的版本文件
   */
  readCurrentVersion() {
    try {
      if (fs.existsSync(this.versionFile)) {
        return JSON.parse(fs.readFileSync(this.versionFile, 'utf8'));
      }
    } catch (error) {
      console.warn('无法读取现有版本文件:', error.message);
    }
    
    return null;
  }

  /**
   * 生成版本信息
   */
  generateVersionInfo() {
    const gitInfo = this.getGitInfo();
    const semanticVersion = this.generateSemanticVersion(gitInfo);
    const currentVersion = this.readCurrentVersion();
    
    const versionInfo = {
      version: semanticVersion,
      buildVersion: semanticVersion,
      buildTime: new Date().toISOString(),
      git: {
        branch: gitInfo.branch,
        commitHash: gitInfo.commitHash,
        commitTime: gitInfo.commitTime,
        commitMessage: gitInfo.commitMessage,
        hasUncommittedChanges: gitInfo.hasUncommittedChanges
      },
      environment: process.env.BUILD_MODE || 'development',
      description: "法语词汇学习应用 - 自动生成版本信息",
      previousVersion: currentVersion?.version || null,
      buildNumber: this.generateBuildNumber(currentVersion)
    };

    return versionInfo;
  }

  /**
   * 生成构建编号（递增）
   */
  generateBuildNumber(currentVersion) {
    if (!currentVersion || !currentVersion.buildNumber) {
      return 1;
    }
    
    return currentVersion.buildNumber + 1;
  }

  /**
   * 写入版本文件
   */
  writeVersionFile(versionInfo) {
    try {
      // 确保public目录存在
      if (!fs.existsSync(this.publicDir)) {
        fs.mkdirSync(this.publicDir, { recursive: true });
      }
      
      fs.writeFileSync(
        this.versionFile, 
        JSON.stringify(versionInfo, null, 2),
        'utf8'
      );
      
      console.log('✅ 版本文件已生成:', this.versionFile);
      console.log('📦 版本信息:', JSON.stringify(versionInfo, null, 2));
      
      return true;
    } catch (error) {
      console.error('❌ 写入版本文件失败:', error.message);
      return false;
    }
  }

  /**
   * 主函数
   */
  run() {
    console.log('🚀 开始生成版本信息...');
    
    const versionInfo = this.generateVersionInfo();
    const success = this.writeVersionFile(versionInfo);
    
    if (success) {
      console.log('🎉 版本信息生成完成!');
      process.exit(0);
    } else {
      console.error('💥 版本信息生成失败!');
      process.exit(1);
    }
  }
}

// 运行版本生成器
if (require.main === module) {
  const generator = new VersionGenerator();
  generator.run();
}

module.exports = VersionGenerator;