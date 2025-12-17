import React, { useState, useEffect, useRef } from 'react';
import { WordWithStatus } from '../types/vocabulary';

type RecallMode = 'none' | 'hide-french' | 'hide-chinese';

interface WordCardProps {
  word: WordWithStatus;
  darkMode?: boolean;
  recallMode?: RecallMode;
}

export function WordCard({ word, darkMode = false, recallMode = 'none' }: WordCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [audioGender, setAudioGender] = useState<'male' | 'female'>('male');
  const [currentWordVariant, setCurrentWordVariant] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 当回忆模式改变时重置显示状态
  useEffect(() => {
    setIsRevealed(false);
  }, [recallMode]);

  // 当单词改变时重置显示状态
  useEffect(() => {
    setIsRevealed(false);
    setAudioGender('male');
    setCurrentWordVariant(0);
    setIsPlaying(false);
  }, [word.id]);

  const handleCardClick = () => {
    if (recallMode !== 'none') {
      setIsRevealed(true);
    }
  };

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

  // 获取当前播放的组合索引（变体 + 性别）
  const getCurrentCombinationIndex = () => {
    const expandedWords = getExpandedWords(word.french);
    const variantIndex = currentWordVariant;
    const genderIndex = audioGender === 'male' ? 0 : 1;
    return variantIndex * 2 + genderIndex;
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
    const currentCombination = getCurrentCombinationIndex();
    
    // 更新状态
    const currentVariant = Math.floor(currentCombination / 2);
    const currentGender = currentCombination % 2 === 0 ? 'male' : 'female';
    
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

  const shouldHideFrench = recallMode === 'hide-french' && !isRevealed;
  const shouldHideChinese = recallMode === 'hide-chinese' && !isRevealed;
  
  // 检查单词是否包含逗号
  const hasComma = word.french.includes(',');
  const expandedWords = getExpandedWords(word.french);

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      className={`mx-4 my-4 p-4 rounded-lg transition-all duration-300 relative ${
        darkMode 
          ? 'bg-bg-dark-card shadow-dark-md hover:shadow-dark-lg' 
          : 'bg-bg-card shadow-md hover:shadow-lg'
      } transition-shadow duration-250 ${
        recallMode !== 'none' && !isRevealed ? 'cursor-pointer' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* 播放特效层 - 已移除，单词学习和详情页面不需要背景特效 */}
      
      {/* 右上角语音按钮 */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            playAudio();
          }}
          className={`p-2 rounded-full transition-all duration-200 shadow-md ${
            darkMode 
              ? getColorForCombination(getCurrentCombinationIndex()).bg.dark 
              : getColorForCombination(getCurrentCombinationIndex()).bg.light
          } text-white hover:opacity-90`}
          title={`播放语音（当前：${audioGender === 'male' ? '男声' : '女声'}，点击切换）`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 a1 1 0 010-1.415z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* 词性标签 */}
      <div className="mb-3">
        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full transition-colors duration-300 ${
          darkMode 
            ? 'bg-secondary-900 text-secondary-200' 
            : 'bg-secondary-100 text-secondary-900'
        }`}>
          {word.part_of_speech}
        </span>
      </div>
      
      {/* 法语单词 */}
      <div className="text-center mb-2">
        {shouldHideFrench ? (
          <div className={`h-12 flex items-center justify-center rounded-lg transition-colors duration-300 ${
            darkMode ? 'bg-neutral-dark-200' : 'bg-neutral-200'
          }`}>
            <span className={`text-sm font-medium transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
            }`}>
              点击显示答案
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <h2 className={`text-3xl font-bold leading-tight font-french transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
            }`}>
              {hasComma ? (
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
              )}
            </h2>
          </div>
        )}
      </div>
      
      {/* 音标 */}
      <div className="text-center mb-3">
        <p className={`text-sm font-phonetic italic transition-colors duration-300 ${
          darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
        }`}>
          {word.phonetic}
        </p>
      </div>
      
      {/* 中文释义 */}
      <div className="text-center">
        {shouldHideChinese ? (
          <div className={`h-6 flex items-center justify-center rounded-lg transition-colors duration-300 ${
            darkMode ? 'bg-neutral-dark-200' : 'bg-neutral-200'
          }`}>
            <span className={`text-sm font-medium transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
            }`}>
              点击显示答案
            </span>
          </div>
        ) : (
          <p className={`text-base font-chinese transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
          }`}>
            {word.chinese}
          </p>
        )}
      </div>
      
      {/* 学习状态指示器（仅在学习模式下显示） */}
      {word.isMastered && isRevealed && (
        <div className="mt-4 flex justify-center">
          <div className={`flex items-center gap-2 px-2 py-1 rounded-full transition-colors duration-300 ${
            darkMode ? 'bg-success-900' : 'bg-success-50'
          }`}>
            <svg className={`w-4 h-4 transition-colors duration-300 ${
              darkMode ? 'text-success-400' : 'text-success-600'
            }`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className={`text-xs font-medium transition-colors duration-300 ${
              darkMode ? 'text-success-300' : 'text-success-700'
            }`}>已掌握</span>
          </div>
        </div>
      )}
    </div>
  );
}