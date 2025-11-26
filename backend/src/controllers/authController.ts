import { Request, Response } from 'express';
import { dbGet, dbRun } from '../database/schema';
import { hashPassword, verifyPassword, generateToken } from '../utils/auth';
import { LoginRequest, RegisterRequest, AuthResponse } from '../types';

export async function register(req: Request, res: Response) {
  try {
    const { username, email, password }: RegisterRequest = req.body;

    // 检查用户名是否已存在
    const existingUser = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // 检查邮箱是否已存在
    const existingEmail = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // 创建新用户
    const passwordHash = await hashPassword(password);
    const result = await dbRun(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    // 创建默认用户设置
    await dbRun(
      'INSERT INTO user_settings (user_id) VALUES (?)',
      [result.lastID]
    );

    // 获取创建的用户
    const user = await dbGet(
      'SELECT id, username, email FROM users WHERE id = ?',
      [result.lastID]
    );

    const token = generateToken(user!);

    const response: AuthResponse = {
      success: true,
      user: user!,
      token
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { username, password }: LoginRequest = req.body;

    // 查找用户
    const user = await dbGet(
      'SELECT id, username, email, password_hash FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 验证密码
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 生成JWT令牌
    const token = generateToken(user);

    const response: AuthResponse = {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUserProfile(req: any, res: Response) {
  try {
    const user = await dbGet(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}