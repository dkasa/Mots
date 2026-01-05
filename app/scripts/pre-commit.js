#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Git pre-commit钩子
 * 在提交前自动更新版本信息
 */
class PreCommitHook {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.versionGeneratorPath = path.join(__dirname, 'version-generator.js');
  }

  /**
   * 检查是否有版本文件更改
   */
  hasVersionChanges() {
    try {
      const gitStatus = execSync('git status --porcelain', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      
      return gitStatus.includes('public/version.json');
    } catch (error) {
      console.warn('无法检查Git状态:', error.message);
      return false;
    }
  }

  /**
   * 运行版本生成器
   */
  runVersionGenerator() {
    try {
      console.log('🔄 正在更新版本信息...');
      execSync(`node "${this.versionGeneratorPath}"`, {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
      return true;
    } catch (error) {
      console.error('❌ 版本生成器执行失败:', error.message);
      return false;
    }
  }

  /**
   * 添加版本文件到暂存区
   */
  stageVersionFile() {
    try {
      execSync('git add public/version.json', {
        cwd: this.projectRoot,
        stdio: 'ignore'
      });
      console.log('✅ 版本文件已添加到暂存区');
      return true;
    } catch (error) {
      console.error('❌ 无法添加版本文件到暂存区:', error.message);
      return false;
    }
  }

  /**
   * 主函数
   */
  run() {
    console.log('🔍 检查是否需要更新版本信息...');
    
    // 如果版本文件已经更改，不需要再次生成
    if (this.hasVersionChanges()) {
      console.log('📝 版本文件已更改，跳过自动生成');
      process.exit(0);
    }
    
    // 生成版本信息
    const success = this.runVersionGenerator();
    
    if (success) {
      // 添加到暂存区
      this.stageVersionFile();
      console.log('🎉 pre-commit钩子执行完成');
    } else {
      console.error('💥 pre-commit钩子执行失败');
    }
    
    process.exit(success ? 0 : 1);
  }
}

// 运行pre-commit钩子
if (require.main === module) {
  const hook = new PreCommitHook();
  hook.run();
}

module.exports = PreCommitHook;