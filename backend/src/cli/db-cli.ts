#!/usr/bin/env node

import { Command } from 'commander';
import { initDatabase, testConnection, getDatabaseType } from '../database';
import { migrateFromJsonToPostgres } from '../database/migrate';
import { resetDatabase } from '../database/reset';
import { seedDatabase } from '../database/seed';

const program = new Command();

program
  .name('mots-db')
  .description('Mots 数据库管理工具')
  .version('1.0.0');

// 初始化数据库
program
  .command('init')
  .description('初始化数据库')
  .action(async () => {
    try {
      console.log('🚀 初始化数据库...');
      await initDatabase();
      console.log('✅ 数据库初始化完成');
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      process.exit(1);
    }
  });

// 测试数据库连接
program
  .command('test')
  .description('测试数据库连接')
  .action(async () => {
    try {
      console.log('🔍 测试数据库连接...');
      const isConnected = await testConnection();
      const dbType = getDatabaseType();
      
      if (isConnected) {
        console.log(`✅ ${dbType} 连接成功`);
      } else {
        console.log(`❌ ${dbType} 连接失败`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 连接测试失败:', error);
      process.exit(1);
    }
  });

// 迁移数据
program
  .command('migrate')
  .description('从JSON文件迁移到PostgreSQL')
  .action(async () => {
    try {
      console.log('🔄 开始数据迁移...');
      await migrateFromJsonToPostgres();
      console.log('✅ 数据迁移完成');
    } catch (error) {
      console.error('❌ 迁移失败:', error);
      process.exit(1);
    }
  });

// 重置数据库
program
  .command('reset')
  .description('重置数据库（删除所有数据）')
  .option('-f, --force', '强制重置，不询问确认')
  .action(async (options) => {
    if (!options.force) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('⚠️  确定要重置数据库吗？这将删除所有数据！(y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ 操作已取消');
        return;
      }
    }
    
    try {
      await resetDatabase();
      console.log('✅ 数据库重置完成');
    } catch (error) {
      console.error('❌ 重置失败:', error);
      process.exit(1);
    }
  });

// 添加种子数据
program
  .command('seed')
  .description('添加种子数据（测试用户等）')
  .action(async () => {
    try {
      await seedDatabase();
      console.log('✅ 种子数据添加完成');
    } catch (error) {
      console.error('❌ 种子数据添加失败:', error);
      process.exit(1);
    }
  });

// 显示数据库状态
program
  .command('status')
  .description('显示数据库状态信息')
  .action(async () => {
    try {
      const dbType = getDatabaseType();
      const isConnected = await testConnection();
      
      console.log('📊 数据库状态:');
      console.log(`  类型: ${dbType}`);
      console.log(`  连接: ${isConnected ? '✅ 正常' : '❌ 失败'}`);
      
      if (isConnected && dbType === 'postgresql') {
        const { pool } = await import('../database/postgresql');
        
        // 获取表统计信息
        const tables = ['users', 'user_settings', 'user_progress'];
        
        for (const table of tables) {
          const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`  ${table}: ${result.rows[0].count} 条记录`);
        }
      }
      
    } catch (error) {
      console.error('❌ 获取状态失败:', error);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();

export {};