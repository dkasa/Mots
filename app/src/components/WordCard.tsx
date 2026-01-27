import React, { useState, useEffect, useRef } from 'react';
import { WordWithStatus } from '../types/vocabulary';
import { useAuth } from '../hooks/useAuth';
import { aiSentenceService, AISentence } from '../services/aiSentenceService';
import { AuthModal } from './AuthModal';

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
  
  // AI造句相关状态
  const [isGeneratingSentences, setIsGeneratingSentences] = useState(false);
  const [generatedSentences, setGeneratedSentences] = useState<AISentence | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  const [usedSentenceIndices, setUsedSentenceIndices] = useState<number[]>([]);
  
  const { isAuthenticated } = useAuth();

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
    // 重置AI造句状态
    setGeneratedSentences(null);
    setIsGeneratingSentences(false);
    setCurrentSentenceIndex(0);
    setUsedSentenceIndices([]);
    
      // 自动从数据库获取已有的句子
      const fetchExistingSentences = async () => {
        setIsAutoFetching(true);
        try {
          console.log('🔄 开始自动获取句子，单词ID:', word.id);
          const existing = await aiSentenceService.getExistingSentences(word.id);
          console.log('📥 自动获取句子结果:', existing);
          if (existing && existing.sentences.length > 0) {
            console.log('✅ 自动获取到句子，数量:', existing.sentences.length);
            setGeneratedSentences(existing);
            
            // 自动获取时也随机选择一条句子并标记为已使用
            const randomIndex = Math.floor(Math.random() * existing.sentences.length);
            setCurrentSentenceIndex(randomIndex);
            setUsedSentenceIndices([randomIndex]);
          } else {
            console.log('ℹ️ 数据库中没有找到该单词的句子');
          }
        } catch (error) {
          console.warn('❌ 获取已有句子失败:', error);
        } finally {
          setIsAutoFetching(false);
        }
      };
    
    fetchExistingSentences();
  }, [word.id]);

  // 获取下一个可用的随机句子索引
  const getNextRandomSentenceIndex = (sentencesLength: number) => {
    const availableIndices = Array.from({length: sentencesLength}, (_, i) => i)
      .filter(index => !usedSentenceIndices.includes(index));
    
    if (availableIndices.length === 0) {
      // 所有句子都已使用过，返回null表示需要检查是否需要生成
      return null;
    }
    
    // 随机选择一个可用的索引
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    return randomIndex;
  };

  // 处理卡片点击事件（随机显示一条句子，不重复）
  const handleCardGenerateSentences = async () => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsGeneratingSentences(true);

    try {
      console.log('🎯 WordCard: 开始处理句子，单词:', word.french, '中文:', word.chinese);
      
      // 如果已有句子数据，尝试获取下一个随机句子
      if (generatedSentences && generatedSentences.sentences.length > 0) {
        const nextIndex = getNextRandomSentenceIndex(generatedSentences.sentences.length);
        
        if (nextIndex !== null) {
          // 还有未使用的句子，显示随机一条
          console.log('🔄 WordCard: 切换到新句子，索引:', nextIndex);
          setCurrentSentenceIndex(nextIndex);
          setUsedSentenceIndices(prev => [...prev, nextIndex]);
        } else {
          // 所有句子都已使用过，检查是否需要生成新句子
          if (generatedSentences.sentences.length < 20) {
            // 句子数量不足20个，用AI生成补充
            console.log('🔄 WordCard: 句子数量不足20个，开始AI生成补充');
            await generateAISentences();
          } else {
            // 句子数量达到20个，清空已使用记录，重新开始循环
            console.log('🔄 WordCard: 句子数量达到20个，重新开始循环');
            setUsedSentenceIndices([]);
            const randomIndex = Math.floor(Math.random() * generatedSentences.sentences.length);
            setCurrentSentenceIndex(randomIndex);
            setUsedSentenceIndices([randomIndex]);
          }
        }
      } else {
        // 没有句子数据，从数据库获取所有句子
        console.log('🔄 WordCard: 没有句子数据，开始获取数据库句子');
        await fetchAllDatabaseSentences();
      }
    } catch (error) {
      console.error('❌ WordCard: 处理句子失败:', error);
    } finally {
      setIsGeneratingSentences(false);
    }
  };

  // 从数据库获取所有句子
  const fetchAllDatabaseSentences = async () => {
    const existing = await aiSentenceService.getExistingSentences(word.id);
    console.log('📥 WordCard: 数据库查询结果:', existing);
    
    if (existing && existing.sentences.length > 0) {
      console.log('✅ WordCard: 使用数据库中的句子，数量:', existing.sentences.length);
      setGeneratedSentences(existing);
      
      // 随机选择一条句子并标记为已使用
      const randomIndex = Math.floor(Math.random() * existing.sentences.length);
      setCurrentSentenceIndex(randomIndex);
      setUsedSentenceIndices([randomIndex]);
    } else {
      // 数据库没有句子，使用AI生成
      console.log('🔄 WordCard: 数据库没有句子，开始AI生成');
      await generateAISentences();
    }
  };

  // 用AI生成补充句子
  const generateAISentences = async () => {
    const aiSentences = await aiSentenceService.generateSentences(word);
    console.log('✅ WordCard: AI生成成功，句子数量:', aiSentences.sentences.length);
    
    if (generatedSentences) {
      // 合并现有句子和AI生成的新句子
      const mergedSentences = {
        ...generatedSentences,
        sentences: [...generatedSentences.sentences, ...aiSentences.sentences]
      };
      setGeneratedSentences(mergedSentences);
      
      // 显示第一条AI生成的句子
      const firstAIIndex = generatedSentences.sentences.length;
      setCurrentSentenceIndex(firstAIIndex);
      setUsedSentenceIndices(prev => [...prev, firstAIIndex]);
    } else {
      // 没有现有句子，直接使用AI生成的句子
      setGeneratedSentences(aiSentences);
      
      // 随机选择一条句子并标记为已使用
      const randomIndex = Math.floor(Math.random() * aiSentences.sentences.length);
      setCurrentSentenceIndex(randomIndex);
      setUsedSentenceIndices([randomIndex]);
    }
  };

  // 处理AI造句生成（仅用于手动触发）
  const handleGenerateSentences = async () => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsGeneratingSentences(true);

    try {
      console.log('🎯 WordCard: 开始生成句子，单词:', word.french, '中文:', word.chinese);
      const sentences = await aiSentenceService.generateSentences(word);
      console.log('✅ WordCard: 收到句子结果:', sentences);
      console.log('📝 WordCard: 句子内容:', JSON.stringify(sentences, null, 2));
      setGeneratedSentences(sentences);
      
      // 手动生成时也随机选择一条句子并标记为已使用
      const randomIndex = Math.floor(Math.random() * sentences.sentences.length);
      setCurrentSentenceIndex(randomIndex);
      setUsedSentenceIndices([randomIndex]);
    } catch (error) {
      console.error('❌ WordCard: 生成AI造句失败:', error);
      // 可以在这里添加错误处理，比如显示错误提示
    } finally {
      setIsGeneratingSentences(false);
    }
  };



  const handleCardClick = () => {
    if (recallMode !== 'none') {
      setIsRevealed(true);
    }
    // 点击卡片时播放语音
    playAudio();
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
    <div className="space-y-4">
      {/* AI造句卡片 - 单独显示在单词卡片上方 */}
      <div 
        className={`mx-4 p-4 rounded-lg transition-all duration-300 cursor-pointer ${
          darkMode 
            ? 'bg-bg-dark-card shadow-dark-md hover:shadow-dark-lg' 
            : 'bg-bg-card shadow-md hover:shadow-lg'
        }`}
        onClick={handleCardGenerateSentences}
      >
        <div className="mb-3">
          <h3 className={`text-sm font-medium transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
          }`}>
            AI造句
          </h3>
        </div>

        {isGeneratingSentences ? (
          <div className={`text-center py-4 transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
          }`}>
            <svg className="animate-spin w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm">正在生成句子...</p>
          </div>
        ) : isAutoFetching ? (
          <div className={`text-center py-4 transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
          }`}>
            <svg className="animate-spin w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm">正在自动获取句子...</p>
          </div>
        ) : generatedSentences ? (
          <div className="space-y-4">
            {/* 当前句子显示 - 显示当前选中的句子 */}
            {generatedSentences.sentences.length > 0 && (
              <div className="text-center space-y-3">
                <div className={`text-xl font-french font-bold leading-relaxed transition-colors duration-300 ${
                  darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
                }`}>
                  {generatedSentences.sentences[currentSentenceIndex].french}
                </div>
                <div className={`text-base font-chinese leading-relaxed transition-colors duration-300 ${
                  darkMode ? 'text-neutral-dark-500' : 'text-neutral-600'
                }`}>
                  {generatedSentences.sentences[currentSentenceIndex].chinese}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`text-center py-4 transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
          }`}>
            <svg className="w-6 h-6 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <p className="text-sm">点击生成AI造句示例</p>
          </div>
        )}
      </div>

      {/* 单词卡片 */}
      <div 
        className={`mx-4 my-4 p-4 rounded-lg transition-all duration-300 relative ${
          isPlaying 
            ? (audioGender === 'male' 
                ? (darkMode ? 'bg-info-900/20' : 'bg-info-100') 
                : (darkMode ? 'bg-secondary-900/20' : 'bg-secondary-100'))
            : (darkMode 
                ? 'bg-bg-dark-card shadow-dark-md hover:shadow-dark-lg' 
                : 'bg-bg-card shadow-md hover:shadow-lg')
        } transition-shadow duration-250 ${
          recallMode !== 'none' && !isRevealed ? 'cursor-pointer' : ''
        }`}
        onClick={handleCardClick}
      >
        {/* 播放特效层 */}
        {isPlaying && (
          <div className={`absolute inset-0 rounded-lg transition-all duration-1000 ${
            audioGender === 'male' 
              ? (darkMode ? 'bg-info-500/10' : 'bg-info-500/20') 
              : (darkMode ? 'bg-secondary-500/10' : 'bg-secondary-500/20')
          }`} style={{
            animation: 'pulse 2s infinite'
          }} />
        )}
        


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

      {/* 登录弹窗 */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        message="请先登录以使用AI造句功能"
      />
    </div>
  );
}