import express, { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';

const router: Router = express.Router();

// 听力材料数据结构
interface ListeningMaterial {
  id: string;
  grade: string;
  title: string;
  audioFile: string;
  subtitleFile?: string;
  duration?: number;
}

// 字幕数据结构
interface Subtitle {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

// 获取听力材料列表
router.get('/materials', async (req, res) => {
  try {
    const { grade } = req.query;
    
    if (!grade) {
      return res.status(400).json({ error: 'Grade parameter is required' });
    }

    // 构建听力材料目录路径 - 处理不同环境下的路径
    let listeningDir: string;
    
    if (process.env.NODE_ENV === 'production') {
      // 生产环境：音频文件可能位于不同的位置
      listeningDir = path.join(
        process.cwd(),
        'app',
        'public',
        'audio',
        `grade${grade}`,
        'listening'
      );
    } else {
      // 开发环境
      listeningDir = path.join(
        process.cwd(),
        '..',
        'app',
        'public',
        'audio',
        `grade${grade}`,
        'listening'
      );
    }

    // 检查目录是否存在
    try {
      await fs.access(listeningDir);
    } catch {
      // 如果目录不存在，返回空数组
      return res.json([]);
    }

    // 读取目录中的音频文件
    const files = await fs.readdir(listeningDir);
    const audioFiles = files.filter(file => 
      file.endsWith('.mp3') || file.endsWith('.m4a') || file.endsWith('.wav')
    );

    // 构建听力材料列表
    const materials = await Promise.all(audioFiles.map(async (file, index) => {
      const baseName = path.parse(file).name;
      const subtitleFile = `${baseName}.srt`;
      
      // 检查是否存在对应的字幕文件
      let subtitlePath: string;
      
      if (process.env.NODE_ENV === 'production') {
        subtitlePath = path.join(
          process.cwd(),
          'app',
          'public',
          'audio',
          `grade${grade}`,
          'subtitles',
          subtitleFile
        );
      } else {
        subtitlePath = path.join(
          process.cwd(),
          '..',
          'app',
          'public',
          'audio',
          `grade${grade}`,
          'subtitles',
          subtitleFile
        );
      }

      // 检查字幕文件是否存在
      let subtitleFileExists: string | undefined;
      try {
        await fs.access(subtitlePath);
        subtitleFileExists = subtitleFile;
      } catch {
        subtitleFileExists = undefined;
      }

      return {
        id: `material_${grade}_${index + 1}`,
        grade: grade as string,
        title: baseName.replace(/[_-]/g, ' '),
        audioFile: file,
        subtitleFile: subtitleFileExists
      };
    }));

    res.json(materials);
  } catch (error) {
    console.error('Error fetching listening materials:', error);
    res.status(500).json({ error: 'Failed to fetch listening materials' });
  }
});

// 获取字幕内容
router.get('/subtitles/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { grade } = req.query;
    
    if (!grade) {
      return res.status(400).json({ error: 'Grade parameter is required' });
    }

    // 从materialId中提取文件名（假设materialId格式为 material_grade_index）
    const parts = materialId.split('_');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid material ID format' });
    }

    const materialGrade = parts[1];
    const index = parseInt(parts[2]) - 1;
    
    // 获取音频文件列表
    const listeningDir = path.join(
      process.cwd(),
      '..',
      'app',
      'public',
      'audio',
      `grade${grade}`,
      'listening'
    );

    const files = await fs.readdir(listeningDir);
    const audioFiles = files.filter(file => 
      file.endsWith('.mp3') || file.endsWith('.m4a') || file.endsWith('.wav')
    );

    if (index < 0 || index >= audioFiles.length) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const audioFile = audioFiles[index];
    const baseName = path.parse(audioFile).name;
    const subtitleFile = `${baseName}.srt`;
    
    // 构建字幕文件路径
    const subtitlePath = path.join(
      process.cwd(),
      '..',
      'app',
      'public',
      'audio',
      `grade${grade}`,
      'subtitles',
      subtitleFile
    );

    // 检查字幕文件是否存在
    try {
      await fs.access(subtitlePath);
    } catch {
      return res.status(404).json({ error: 'Subtitles not found' });
    }

    // 读取字幕文件
    const subtitleContent = await fs.readFile(subtitlePath, 'utf-8');
    
    // 解析SRT格式
    const subtitles = parseSRT(subtitleContent);
    
    res.json(subtitles);
  } catch (error) {
    console.error('Error fetching subtitles:', error);
    res.status(500).json({ error: 'Failed to fetch subtitles' });
  }
});

// SRT字幕解析函数
function parseSRT(content: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const blocks = content.trim().split('\n\n');

  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim());
    
    if (lines.length >= 3) {
      const id = parseInt(lines[0]);
      const timeRange = lines[1].split(' --> ');
      
      if (timeRange.length === 2) {
        const startTime = parseTime(timeRange[0]);
        const endTime = parseTime(timeRange[1]);
        const text = lines.slice(2).join('\n');

        subtitles.push({
          id,
          startTime,
          endTime,
          text
        });
      }
    }
  }

  return subtitles;
}

// 时间解析函数（从HH:MM:SS,mmm格式转换为秒）
function parseTime(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const secondsParts = parts[2].split(',');
  const seconds = parseInt(secondsParts[0]);
  const milliseconds = parseInt(secondsParts[1]);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

export default router;