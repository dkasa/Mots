import { users, userSettings, userProgress, getDatabaseType } from './index';
import { hashPassword } from '../utils/auth';

// 数据库种子数据脚本
async function seedDatabase(): Promise<void> {
  console.log('🌱 添加种子数据...');
  
  try {
    const dbType = getDatabaseType();
    
    // 创建测试用户
    const testUsers = [
      {
        username: 'demo',
        email: 'demo@mots.com',
        password: 'demo123'
      },
      {
        username: 'testuser',
        email: 'test@mots.com',
        password: 'test123'
      },
      {
        username: 'admin',
        email: 'admin@mots.com',
        password: 'admin123'
      }
    ];
    
    for (const userData of testUsers) {
      // 检查用户是否已存在
      const existingUser = await users.findByUsername(userData.username);
      if (!existingUser) {
        // 创建用户
        const passwordHash = await hashPassword(userData.password);
        const userId = await users.create(userData.username, userData.email, passwordHash);
        
        // 创建用户设置
        await userSettings.create(userId);
        
        // 添加一些示例进度数据
        const sampleProgress = [
          { wordId: '81_1', grade: 81, isLearned: true, isMastered: false },
          { wordId: '81_2', grade: 81, isLearned: true, isMastered: true },
          { wordId: '81_3', grade: 81, isLearned: false, isMastered: false },
          { wordId: '81_4', grade: 81, isLearned: true, isMastered: false },
          { wordId: '81_5', grade: 81, isLearned: false, isMastered: false },
        ];
        
        for (const progress of sampleProgress) {
          await userProgress.upsert(
            userId,
            progress.wordId,
            progress.grade,
            progress.isLearned,
            progress.isMastered
          );
        }
        
        console.log(`✅ 创建测试用户: ${userData.username}`);
      } else {
        console.log(`ℹ️ 用户已存在: ${userData.username}`);
      }
    }
    
    console.log('🎉 种子数据添加完成！');
    console.log('\n📋 测试账号:');
    console.log('用户名: demo,    密码: demo123');
    console.log('用户名: testuser, 密码: test123');
    console.log('用户名: admin,   密码: admin123');
    
  } catch (error) {
    console.error('❌ 种子数据添加失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ 种子数据添加完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 种子数据添加失败:', error);
      process.exit(1);
    });
}

export { seedDatabase };