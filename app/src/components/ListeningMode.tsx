import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Grade } from '../types/vocabulary';

interface Subtitle {
  id: number;
  startTime: number; // 开始时间（秒）
  endTime: number;   // 结束时间（秒）
  text: string;      // 字幕文本
}

interface ListeningMaterial {
  id: string;
  grade: Grade;
  title: string;
  audioFile: string;
  subtitleFile?: string;
  duration?: number;
}

interface ListeningModeProps {
  grade: Grade;
  darkMode: boolean;
  courseSelection?: {
    selectedUnits: number[];
    selectedLessons: string[];
  };
}

export const ListeningMode: React.FC<ListeningModeProps> = ({ grade, darkMode, courseSelection }) => {
  const [materials, setMaterials] = useState<ListeningMaterial[]>([]);
  const [currentMaterial, setCurrentMaterial] = useState<ListeningMaterial | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // 加载听力材料列表
  useEffect(() => {
    console.log('🎯 ListeningMode组件加载，年级参数:', grade);
    
    const loadMaterials = async () => {
      setLoading(true);
      try {
        const url = `/api/listening/materials?grade=${grade}`;
        console.log('🔍 请求听力材料URL:', url);
        console.log('🌐 完整URL:', `http://localhost:3001${url}`);
        
        const response = await fetch(url);
        console.log('📡 响应状态:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('📊 获取到的材料数量:', data.length);
          console.log('📋 材料列表:', data);
          setMaterials(data);
        } else {
          console.error('❌ 响应错误:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('❌ 错误详情:', errorText);
        }
      } catch (error) {
        console.error('❌ 加载听力材料失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMaterials();
  }, [grade]);

  // 加载字幕
  const loadSubtitles = useCallback(async (material: ListeningMaterial) => {
    if (material.subtitleFile) {
      try {
        const response = await fetch(`/api/listening/subtitles/${material.id}?grade=${material.grade}`);
        if (response.ok) {
          const data = await response.json();
          setSubtitles(data);
        } else {
          console.error('字幕请求失败:', response.status, response.statusText);
          setSubtitles([]);
        }
      } catch (error) {
        console.error('加载字幕失败:', error);
        setSubtitles([]);
      }
    } else {
      setSubtitles([]);
    }
  }, []);

  // 选择听力材料
  const selectMaterial = useCallback(async (material: ListeningMaterial) => {
    setCurrentMaterial(material);
    setCurrentSubtitle(null);
    setCurrentTime(0);
    await loadSubtitles(material);
    
    // 重置音频播放器
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [loadSubtitles]);

  // 当材料加载完成时，自动选择第一个材料
  useEffect(() => {
    if (materials.length > 0 && !currentMaterial) {
      selectMaterial(materials[0]);
    }
  }, [materials, currentMaterial, selectMaterial]);

  // 处理音频时间更新
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      
      // 更新当前显示的字幕
      const subtitle = subtitles.find(s => time >= s.startTime && time <= s.endTime);
      setCurrentSubtitle(subtitle || null);
    }
  };

  // 播放/暂停
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // 跳转到指定时间
  const seekToTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 根据课程选择过滤材料
  const filteredMaterials = materials.filter(material => {
    if (!courseSelection?.selectedUnits || courseSelection.selectedUnits.length === 0) {
      return true; // 如果没有选择单元，显示所有材料
    }
    
    // 从标题中提取单元号
    const unitMatch = material.title.match(/Unité (\d+)/i);
    if (!unitMatch) return false;
    
    const unitNumber = parseInt(unitMatch[1]);
    
    // 处理下学期材料到上学期单元的映射
    // 初一上学期的U1就是初一上U1第一单元（正常映射）
    // 初一下学期的U5对应初一下学期的U1单元（U6→U1, U7→U2, U8→U3, U9→U4, U10→U5）
    // Unité 11 及以后归入 Unité 10
    let actualUnitNumber = unitNumber;
    if (unitNumber > 10) {
      actualUnitNumber = 10; // Unité 11 及以后归入 Unité 10
    } else if (unitNumber > 5) {
      actualUnitNumber = unitNumber - 5; // 下学期材料映射到上学期对应单元
    }
    
    return courseSelection.selectedUnits.includes(actualUnitNumber);
  });

  return (
    <div className={`p-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
      {/* 标题行 - 只显示当前播放标题 */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-primary-600 dark:text-primary-400">
          {currentMaterial ? currentMaterial.title : '请选择听力材料'}
        </h2>
      </div>
      
      {/* 字幕显示区域 - 固定显示，文字加大 */}
      <div className="bg-primary-50 dark:bg-primary-900/30 p-4 rounded-lg mb-4 text-center border border-primary-200 dark:border-primary-700 min-h-[100px] flex items-center justify-center">
        {currentSubtitle && (
          <div className="leading-relaxed text-primary-800 dark:text-primary-200 break-words whitespace-pre-line max-w-full px-2"
               style={{ fontSize: 'clamp(18px, 4vw, 24px)' }}>
            {currentSubtitle.text}
          </div>
        )}
      </div>
      
      {/* 音频播放器 - 默认显示，小巧精致 */}
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-lg mb-4 transition-all duration-300 ${
        currentMaterial ? 'opacity-100' : 'opacity-70'
      }`}>
        <div className="flex items-center space-x-3">
          {/* 播放按钮 */}
          <button
            onClick={togglePlay}
            disabled={!currentMaterial}
            className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          {/* 当前播放信息 */}
          <div className="flex-1 min-w-0">
            {/* 进度条 */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 w-8">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={audioRef.current?.duration || 100}
                value={currentTime}
                onChange={(e) => seekToTime(parseFloat(e.target.value))}
                disabled={!currentMaterial}
                className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500 w-8">{formatTime(audioRef.current?.duration || 0)}</span>
            </div>
          </div>
        </div>

        {/* 隐藏的音频元素 */}
        <audio
          ref={audioRef}
          src={currentMaterial ? `/audio/grade${currentMaterial.grade}/listening/${currentMaterial.audioFile}` : ''}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      </div>

      {/* 听力材料列表 - 放在播放器下面 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">选择听力材料</h3>
        
        {/* 显示当前筛选状态 */}
        {courseSelection?.selectedUnits && courseSelection.selectedUnits.length > 0 && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            当前筛选: 单元 {courseSelection.selectedUnits.sort().join(', ')}
          </div>
        )}
        
        {/* 材料列表 */}
        {loading ? (
          <div className="text-gray-500">加载中...</div>
        ) : filteredMaterials.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
            {filteredMaterials.map((material) => (
              <button
                key={material.id}
                onClick={() => selectMaterial(material)}
                className={`p-3 text-left rounded-lg border transition-all ${
                  currentMaterial?.id === material.id
                    ? 'bg-primary-100 border-primary-500 dark:bg-primary-900 dark:border-primary-400'
                    : darkMode
                    ? 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{material.title}</div>
                <div className="text-sm text-gray-500">
                  {material.duration ? formatTime(material.duration) : '未知时长'}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
            暂无听力材料，请检查文件是否存在或联系管理员
          </div>
        )}
      </div>
    </div>
  );
};