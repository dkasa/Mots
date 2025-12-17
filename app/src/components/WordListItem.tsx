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
  const [currentWordVariant, setCurrentWordVariant] = useState(0);
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

  // 当单词改变时重置音频性别和变体
  useEffect(() => {
    setAudioGender('male');
    setCurrentWordVariant(0);
  }, [word.id]);

  // 根据法语单词生成文件名
  const getAudioFileName = (frenchWord: string, gender: 'male' | 'female') => {
    let filename = frenchWord.toLowerCase()
      .replace(/'/g, '')
      .replace(/,/g, '_')
      .replace(/ /g, '_');
    // 移除非字母数字字符，但保留法语特殊字符
    filename = filename.replace(/[^a-z0-9_àâäéèêëîïôöùûüç-]/g, '');
    return filename;
  };

  // 检查单词是否包含逗号，并获取所有扩展的单词
  const getExpandedWords = (frenchWord: string): string[] => {
    if (frenchWord.includes(',')) {
      const base = frenchWord.split(',')[0];
      const suffix = frenchWord.split(',')[1];
      return [base, base + suffix];
    }
    return [frenchWord];
  };
 
  // 获取颜色配置
  const getColorForCombination = (combinationIndex: number) => {
    const colors = [
      { 
        text: { light: 'text-info-500', dark: 'text-info-500' },    // 变体1 男声
        bg: { light: 'bg-info-500', dark: 'bg-info-500' },
        bgLight: { light: 'bg-info-100', dark: 'bg-info-900/20' }
      },    
      { 
        text: { light: 'text-purple-500', dark: 'text-purple-500' }, // 变体1 女声
        bg: { light: 'bg-purple-500', dark: 'bg-purple-500' },
        bgLight: { light: 'bg-purple-100', dark: 'bg-purple-900/20' }
      },
      { 
        text: { light: 'text-success-500', dark: 'text-success-500' },    // 变体2 男声
        bg: { light: 'bg-success-500', dark: 'bg-success-500' },
        bgLight: { light: 'bg-success-100', dark: 'bg-success-900/20' }
      },
      { 
        text: { light: 'text-warning-500', dark: 'text-warning-500' },     // 变体2 女声
        bg: { light: 'bg-warning-500', dark: 'bg-warning-500' },
        bgLight: { light: 'bg-warning-100', dark: 'bg-warning-900/20' }
      }
    ];
    return colors[combinationIndex] || colors[0];
  };

  const playAudio = () => {
    if (!word) return;
    
    const expandedWords = getExpandedWords(word.french);
    
    // 计算当前组合（变体 + 性别）
    const currentCombination = currentWordVariant * 2 + (audioGender === 'male' ? 0 : 1);
    
    // 更新状态
    const currentVariant = currentWordVariant;
    const currentGender = audioGender;
    
    // 设置播放状态
    setIsPlaying(true);

    // 获取当前要播放的单词变体
    const currentVariantWord = expandedWords[currentVariant];
    
    // 生成音频文件路径 - 指向public目录下的audio文件夹
    const filename = getAudioFileName(currentVariantWord, currentGender);
    const audioPath = `/audio/grade${word.grade}/${currentGender}/${filename}.m4a`;
    
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
      // 播放完成后停止播放状态
      setIsPlaying(false);
      
      // 播放完成后自动切换到下一个组合
      const nextCombination = (currentCombination + 1) % (expandedWords.length * 2);
      const nextVariant = Math.floor(nextCombination / 2);
      const nextGender = nextCombination % 2 === 0 ? 'male' : 'female';
      
      setCurrentWordVariant(nextVariant);
      setAudioGender(nextGender as 'male' | 'female');
    };
    
    audio.play().catch(error => {
      console.log(`Audio play failed for ${audioPath}:`, error);
      setIsPlaying(false);
      // 如果播放失败，回退到下一个组合
      setTimeout(() => {
        const fallbackCombination = (currentCombination + 1) % (expandedWords.length * 2);
        const fallbackVariant = Math.floor(fallbackCombination / 2);
        const fallbackGender = fallbackCombination % 2 === 0 ? 'male' : 'female';
        
        const fallbackFilename = getAudioFileName(expandedWords[fallbackVariant], fallbackGender);
        const fallbackAudioPath = `/audio/grade${word.grade}/${fallbackGender}/${fallbackFilename}.m4a`;
        const fallbackAudio = new Audio(fallbackAudioPath);
        audioRef.current = fallbackAudio;
        
        fallbackAudio.onended = () => {
          setIsPlaying(false);
          // 播放失败后也切换到下一个组合
          const nextCombination = (fallbackCombination + 1) % (expandedWords.length * 2);
          const nextVariant = Math.floor(nextCombination / 2);
          const nextGender = nextCombination % 2 === 0 ? 'male' : 'female';
          
          setCurrentWordVariant(nextVariant);
          setAudioGender(nextGender as 'male' | 'female');
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

  // 当单词改变时重置音频状态
  useEffect(() => {
    if (word) {
      setAudioGender('male');
      setCurrentWordVariant(0);
      setIsPlaying(false);
    }
  }, [word]);

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
  
  // 检查单词是否包含逗号
  const hasComma = word.french.includes(',');
  const expandedWords = getExpandedWords(word.french);

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
      {/* 播放特效层 - 按照copy.tsx的方式实现 */}
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
            {shouldHideFrench ? '点击显示' : (
              hasComma ? (
                <span>
                  {expandedWords.map((variant, index) => {
                    const combinationIndex = index * 2 + (audioGender === 'male' ? 0 : 1);
                    const color = getColorForCombination(combinationIndex);
                    const isCurrent = index === currentWordVariant;
                    
                    return (
                      <span 
                        key={index}
                        className={`transition-all duration-300 ${
                          isCurrent 
                            ? (darkMode ? color.text.dark : color.text.light)
                            : (darkMode ? 'text-neutral-dark-600' : 'text-neutral-600')
                        }`}
                      >
                        {variant}
                        {index < expandedWords.length - 1 && <span className="text-gray-400"> / </span>}
                      </span>
                    );
                  })}
                </span>
              ) : (
                word.french
              )
            )}
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