import React, { useState, useEffect, useRef } from 'react';
import { WordWithStatus } from '../types/vocabulary';

type RecallMode = 'none' | 'hide-french' | 'hide-chinese';

interface WordListItemProps {
  word: WordWithStatus;
  onToggle?: (word: WordWithStatus, newIsMastered: boolean) => void;
  darkMode?: boolean;
  recallMode?: RecallMode;
}

export const WordListItem = React.memo(function WordListItem({
  word,
  onToggle,
  darkMode = false,
  recallMode = 'none',
}: WordListItemProps) {
  const [isNotMastered, setIsNotMastered] = useState(!word.isMastered);
  const [isRevealed, setIsRevealed] = useState(false);
  const [audioGender, setAudioGender] = useState<'male' | 'female'>('male');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 是否处于「用户主动操作」中
  const userInteractedRef = useRef(false);

  /** ✅ 只在“新单词 / 首次渲染”时从 props 同步 */
  useEffect(() => {
    if (!userInteractedRef.current) {
      setIsNotMastered(!word.isMastered);
    }
  }, [word.id, word.isMastered]);

  // 回忆模式变化时重置显示
  useEffect(() => {
    setIsRevealed(false);
  }, [recallMode, word.id]);

  // 当单词改变时重置音频性别
  useEffect(() => {
    setAudioGender('male');
  }, [word.id]);

  // 根据法语单词生成文件名
  const getAudioFileName = (frenchWord: string, gender: 'male' | 'female') => {
    let filename = frenchWord.toLowerCase()
      .replace(/'/g, '')
      .replace(/,/g, '_')
      .replace(/ /g, '_');
    // 移除非字母数字字符
    filename = filename.replace(/[^a-z0-9_]/g, '');
    return filename;
  };

  const playAudio = () => {
    const gender = audioGender;
    const nextGender = audioGender === 'male' ? 'female' : 'male';
    
    // 切换性别状态
    setAudioGender(nextGender as 'male' | 'female');
    
    // 设置播放状态
    setIsPlaying(true);

    // 生成音频文件路径 - 指向public目录下的audio文件夹
    const filename = getAudioFileName(word.french, gender);
    const audioPath = `/audio/grade${word.grade}/${gender}/${filename}.mp3`;
    
    // 如果已有音频元素，停止当前播放
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // 创建新的音频元素并播放
    const audio = new Audio(audioPath);
    audioRef.current = audio;
    
    // 音频播放结束时的处理
    audio.onended = () => {
      setIsPlaying(false);
    };
    
    audio.play().catch(error => {
      console.log(`Audio play failed for ${audioPath}:`, error);
      setIsPlaying(false);
      // 如果播放失败，回退到下一个性别
      setTimeout(() => {
        const fallbackFilename = getAudioFileName(word.french, nextGender);
        const fallbackAudioPath = `/audio/grade${word.grade}/${nextGender}/${fallbackFilename}.mp3`;
        const fallbackAudio = new Audio(fallbackAudioPath);
        audioRef.current = fallbackAudio;
        
        fallbackAudio.onended = () => {
          setIsPlaying(false);
        };
        
        fallbackAudio.play().catch(e => {
          console.log(`Fallback audio also failed for ${fallbackAudioPath}:`, e);
          setIsPlaying(false);
        });
      }, 100);
    });
  };

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();

    userInteractedRef.current = true;

    const nextIsNotMastered = !isNotMastered;
    setIsNotMastered(nextIsNotMastered);

    onToggle?.(word, !nextIsNotMastered);
  };

  const handleToggleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e);
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    if (recallMode !== 'none' && !isRevealed) {
      e.stopPropagation();
      setIsRevealed(true);
    } else {
      // 在非回忆模式下，点击单词卡片播放语音
      playAudio();
    }
  };

  const shouldHideFrench = recallMode === 'hide-french' && !isRevealed;
  const shouldHideChinese = recallMode === 'hide-chinese' && !isRevealed;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleContentClick}
      className={`w-full px-5 py-4 text-left transition-all duration-300 cursor-pointer relative overflow-hidden ${
        isPlaying 
          ? (audioGender === 'male' 
              ? (darkMode ? 'bg-info-900/20' : 'bg-info-100') 
              : (darkMode ? 'bg-secondary-900/20' : 'bg-secondary-100'))
          : (darkMode
              ? 'bg-dark-card hover:bg-dark-elevated'
              : 'bg-bg-card hover:bg-neutral-50 border-b')
      }`}
    >
      {/* 播放特效层 */}
      {isPlaying && (
        <div className={`absolute inset-0 transition-all duration-1000 ${
          audioGender === 'male' 
            ? (darkMode ? 'bg-info-500/10' : 'bg-info-500/20') 
            : (darkMode ? 'bg-secondary-500/10' : 'bg-secondary-500/20')
        }`} style={{
          animation: 'pulse 2s infinite'
        }} />
      )}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* 法语 */}
          <h3 className={`text-lg font-semibold ${
            isNotMastered ? '' : 'opacity-50'
          }`}>
            {shouldHideFrench ? '点击显示' : word.french}
          </h3>

          {/* 中文 */}
          <p className={`text-sm ${
            isNotMastered ? '' : 'opacity-50'
          }`}>
            {shouldHideChinese ? '点击显示' : word.chinese}
          </p>
        </div>

        {/* Toggle */}
        <div
          role="switch"
          aria-checked={isNotMastered}
          tabIndex={0}
          onClick={handleToggle}
          onKeyDown={handleToggleKeyDown}
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition ${
            isNotMastered ? 'bg-yellow-400' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`block w-4 h-4 bg-white rounded-full transition-transform ${
              isNotMastered ? 'translate-x-6' : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
});