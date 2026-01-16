import React, { useState, useEffect, useRef } from 'react';
import { SentenceQuestion } from '../types/ai';
import { unescapeFrenchText, unescapeArray } from '../lib/utils';

interface WordReorderingCardProps {
  question: SentenceQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (selectedAnswer: string, timeSpent: number) => void;
  onExit?: () => void;
  darkMode?: boolean;
}

export function WordReorderingCard({ 
  question, 
  questionNumber, 
  totalQuestions, 
  onAnswer, 
  onExit,
  darkMode = false 
}: WordReorderingCardProps) {
  const [draggedWord, setDraggedWord] = useState<string | null>(null);
  const [droppedWords, setDroppedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout>();

  // 初始化单词块
  useEffect(() => {
    // 重置所有状态
    setDraggedWord(null);
    setDroppedWords([]);
    setShowFeedback(false);
    setIsCorrect(false);
    setTimeSpent(0);
    
    // 从问题中提取单词块
    if (question.type === 'sentence-reordering') {
      // 如果有AI生成的打乱单词块且有效，使用它们（先处理转义字符）
      if (question.shuffledBlocks && Array.isArray(question.shuffledBlocks) && question.shuffledBlocks.length > 0) {
        setAvailableWords(unescapeArray(question.shuffledBlocks));
      }
      // 如果有AI生成的单词块且有效，使用它们（先处理转义字符）
      else if (question.wordBlocks && Array.isArray(question.wordBlocks) && question.wordBlocks.length > 0) {
        const processedWordBlocks = unescapeArray(question.wordBlocks);
        const shuffledWords = shuffleArray([...processedWordBlocks]);
        setAvailableWords(shuffledWords);
      }
      // 如果有选项，从第一个选项中提取单词块（先处理转义字符）
      else if (question.options && Array.isArray(question.options) && question.options.length > 0) {
        const processedOption = unescapeFrenchText(question.options[0]);
        const words = processedOption.split(' ');
        setAvailableWords(words);
      } else {
        // 如果没有AI数据，从原句中提取单词（先处理转义字符）
        const processedSentence = question.originalSentence ? unescapeFrenchText(question.originalSentence) : '';
        const words = processedSentence ? processedSentence.split(' ') : [];
        setAvailableWords(words.length > 0 ? words : ['数据加载中...']);
      }
    }
    
    // 启动计时器
    startTimeRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
      setTimeSpent(Date.now() - startTimeRef.current);
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [question.id, question.type, question.shuffledBlocks, question.wordBlocks, question.options, question.originalSentence]);

  // 打乱数组辅助函数
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // 处理拖拽开始
  const handleDragStart = (word: string) => {
    setDraggedWord(word);
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setDraggedWord(null);
  };

  // 处理放置
  const handleDrop = (position: number) => {
    if (!draggedWord) return;

    // 从可用单词中移除
    const newAvailableWords = availableWords.filter(word => word !== draggedWord);
    setAvailableWords(newAvailableWords);

    // 添加到已放置单词
    const newDroppedWords = [...droppedWords];
    newDroppedWords.splice(position, 0, draggedWord);
    setDroppedWords(newDroppedWords);

    setDraggedWord(null);
  };

  // 处理点击可用单词块（添加到放置区域）
  const handleWordClick = (word: string) => {
    // 从可用单词中移除
    const newAvailableWords = availableWords.filter(w => w !== word);
    setAvailableWords(newAvailableWords);

    // 添加到已放置单词末尾
    setDroppedWords([...droppedWords, word]);
  };

  // 处理从放置区域移除单词
  const handleRemoveWord = (word: string, position: number) => {
    const newDroppedWords = [...droppedWords];
    newDroppedWords.splice(position, 1);
    setDroppedWords(newDroppedWords);
    
    setAvailableWords([...availableWords, word]);
  };

  // 检查答案
  const handleCheckAnswer = () => {
    if (showFeedback) return;
    
    const userAnswer = droppedWords.join(' ');
    
    // 标准化比较函数：移除标点、统一大小写、规范空格
    const normalizeSentence = (sentence: string) => {
      return sentence
        .replace(/[.,!?;:]/g, '')  // 移除标点符号
        .replace(/\s+/g, ' ')     // 合并多个空格
        .trim()                   // 移除首尾空格
        .toLowerCase();           // 统一小写比较
    };
    
    const normalizedUserAnswer = normalizeSentence(userAnswer);
    const normalizedCorrectAnswer = normalizeSentence(question.originalSentence);
    
    console.log('🔍 答案检查调试信息:', {
      userAnswer,
      originalSentence: question.originalSentence,
      normalizedUserAnswer,
      normalizedCorrectAnswer,
      isEqual: normalizedUserAnswer === normalizedCorrectAnswer
    });
    
    const correct = normalizedUserAnswer === normalizedCorrectAnswer;
    setIsCorrect(correct);
    setShowFeedback(true);
    
    // 停止计时
    if (timerRef.current) {
      clearInterval(timerRef.current);
      setTimeSpent(Date.now() - startTimeRef.current);
    }

    // 播放反馈音效
    playFeedbackSound(correct);

    // 延迟后进入下一题
    setTimeout(() => {
      onAnswer(userAnswer, timeSpent);
    }, 1500);
  };

  // 播放反馈音效
  const playFeedbackSound = (correct: boolean) => {
    const audioUrl = correct ? '/audio/success.mp3' : '/audio/failure.mp3';
    const audio = new Audio(audioUrl);
    audio.volume = 0.3;
    audio.play().catch(error => {
      console.log('反馈音效播放失败:', error);
    });
  };

  // 格式化时间显示
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${milliseconds.toString().padStart(2, '0')}秒`;
  };

  // 从 explanation 中提取纯中文翻译
  const extractChineseTranslation = (explanation: string): string => {
    if (!explanation) return '';

    // 尝试匹配"意思是xxx"的模式
    const meaningMatch = explanation.match(/意思是(.+)$/);
    if (meaningMatch) {
      return meaningMatch[1].trim();
    }

    // 尝试匹配"xxx，意思是xxx"的模式
    const fullMatch = explanation.match(/，意思是(.+)$/);
    if (fullMatch) {
      return fullMatch[1].trim();
    }

    // 如果没有匹配到，尝试查找中文内容（不包含"正确的"、"语序"、"是"等说明性文字）
    const chinesePart = explanation
      .replace(/正确的(填空形式|语序)是[:：].*$/g, '')
      .replace(/这句(话的)?中文(意思)?是[:：]?/g, '')
      .replace(/La phrase(.*?)/g, '')
      .replace(/L'option(.*?)/g, '')
      .replace(/indique(.*?)/g, '')
      .replace(/其他选项(.*?)/g, '')
      .replace(/虽然语法上正确(.*?)/g, '')
      .replace(/使用.*?时态/g, '')
      .replace(/选项[^。]+。/g, '')
      .trim();

    return chinesePart || explanation;
  };

  // 获取中文翻译
  const sentenceTranslation = extractChineseTranslation(question.explanation);

  // 重置当前题目
  const handleReset = () => {
    const words = question.originalSentence.split(' ');
    setAvailableWords(words);
    setDroppedWords([]);
    setShowFeedback(false);
    setIsCorrect(false);
    
    // 重置计时器
    startTimeRef.current = Date.now();
    setTimeSpent(0);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeSpent(Date.now() - startTimeRef.current);
    }, 100);
  };

  return (
    <div className={`mx-5 my-8 transition-colors duration-300 ${
      darkMode ? 'text-white' : 'text-neutral-800'
    }`}>
      {/* 进度条和退出按钮 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              第 {questionNumber} 题 / 共 {totalQuestions} 题
            </span>
            {onExit && (
              <button
                onClick={onExit}
                className={`text-xs px-2 py-0.5 rounded-sm border transition-colors duration-200 bg-secondary-500 text-white hover:bg-secondary-600 ${
                  darkMode 
                    ? 'border-secondary-400' 
                    : 'border-secondary-300'
                }`}
              >
                退出测试
              </button>
            )}
          </div>
          <span className={`text-sm ${darkMode ? 'text-neutral-dark-300' : 'text-neutral-500'}`}>
            {formatTime(timeSpent)}
          </span>
        </div>
        <div className={`w-full h-2 rounded-full overflow-hidden ${
          darkMode ? 'bg-neutral-dark-300' : 'bg-neutral-200'
        }`}>
          <div 
            className={`h-full transition-all duration-300 ${
              darkMode ? 'bg-primary-500' : 'bg-primary-400'
            }`}
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* 题目说明 */}
      <div className="text-center mb-6">
        <div className={`text-xs mb-3 ${
          darkMode ? 'text-slate-400' : 'text-neutral-500'
        }`}>
          💡 提示：您可以点击或拖拽单词块来移动它们
        </div>

        {/* 句子的中文翻译 */}
        {sentenceTranslation && (
          <div className={`text-lg font-medium mb-4 p-4 rounded-lg ${
            darkMode
              ? 'bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 text-purple-100'
              : 'bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 text-purple-900'
          }`}>
            <span className="opacity-70 text-sm mr-2">中文含义：</span>
            {unescapeFrenchText(sentenceTranslation)}
          </div>
        )}

        <div className={`text-sm ${
          darkMode ? 'text-neutral-dark-400' : 'text-neutral-600'
        }`}>
          目标单词: <span className="font-medium">{unescapeFrenchText(question.targetWord)}</span>
          {question.aiGenerated && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
              🤖 AI生成
            </span>
          )}
        </div>
      </div>

      {/* 放置区域 */}
      <div className="mb-8">
        <div
          className={`p-4 rounded-lg border-2 border-dashed min-h-20 backdrop-blur-sm ${
            darkMode
              ? 'bg-slate-800/40 border-slate-700/50'
              : 'bg-neutral-100 border-neutral-300'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(droppedWords.length)}
        >
          <div className="flex flex-wrap gap-2 min-h-12">
            {droppedWords.map((word, index) => (
              <div
                key={`${word}-${index}`}
                className="flex items-center gap-1"
              >
                <div
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 shadow-md ${
                    darkMode
                      ? 'bg-gradient-to-br from-purple-600/80 to-blue-600/80 hover:from-purple-500/90 hover:to-blue-500/90 text-white border border-purple-400/30'
                      : 'bg-primary-500 hover:bg-primary-600 text-white'
                  }`}
                  onClick={() => handleRemoveWord(word, index)}
                >
                  {word}
                </div>
                {index < droppedWords.length - 1 && (
                  <span className={`text-neutral-500 ${darkMode ? 'text-slate-500' : ''}`}>→</span>
                )}
              </div>
            ))}
            {droppedWords.length === 0 && (
              <div className={`text-center w-full py-4 ${
                darkMode ? 'text-slate-400' : 'text-neutral-500'
              }`}>
                点击或拖拽单词块到这里
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 可用单词块区域 */}
      <div className="mb-6">
        <h4 className={`text-sm font-medium mb-3 ${
          darkMode ? 'text-slate-300' : 'text-neutral-600'
        }`}>
          可用的单词块：
        </h4>
        <div className="flex flex-wrap gap-2">
          {availableWords.map((word, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleDragStart(word)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(droppedWords.length)}
              onClick={() => handleWordClick(word)}
              className={`px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 shadow-sm select-none ${
                darkMode
                  ? 'bg-slate-700/60 hover:bg-slate-600/70 text-white border border-slate-600/50 active:scale-95'
                  : 'bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 active:scale-95'
              }`}
              title="点击或拖拽添加到上方"
            >
              {word}
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleReset}
          disabled={showFeedback}
          className={`flex-1 py-2 px-4 rounded-lg transition-colors duration-200 ${
            darkMode
              ? 'bg-neutral-dark-600 hover:bg-neutral-dark-500 text-white disabled:bg-neutral-dark-700'
              : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800 disabled:bg-neutral-100'
          }`}
        >
          重置
        </button>
        <button
          onClick={handleCheckAnswer}
          disabled={droppedWords.length === 0 || showFeedback}
          className={`flex-1 py-2 px-4 rounded-lg transition-colors duration-200 ${
            darkMode
              ? 'bg-primary-600 hover:bg-primary-700 text-white disabled:bg-primary-400'
              : 'bg-primary-500 hover:bg-primary-600 text-white disabled:bg-primary-300'
          }`}
        >
          检查答案
        </button>
      </div>

      {/* 反馈信息 */}
      {showFeedback && question.explanation && (
        <div className={`p-4 rounded-lg mb-6 animate-fade-in ${
          isCorrect
            ? darkMode ? 'bg-success-900/20 border-success-500' : 'bg-success-50 border-success-200'
            : darkMode ? 'bg-error-900/20 border-error-500' : 'bg-error-50 border-error-200'
        } border`}>
          <div className="flex items-center gap-2 mb-2">
            {isCorrect ? (
              <>
                <svg className="w-5 h-5 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className={`font-medium ${isCorrect ? 'text-success-600' : 'text-error-600'}`}>
                  回答正确！
                </span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-error-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className={`font-medium ${isCorrect ? 'text-success-600' : 'text-error-600'}`}>
                  回答错误
                </span>
              </>
            )}
          </div>
          <div className={`text-sm ${darkMode ? 'text-neutral-dark-400' : 'text-neutral-600'}`}>
            {unescapeFrenchText(question.explanation)}
          </div>
        </div>
      )}

      {/* 等待进入下一题的提示 */}
      {showFeedback && (
        <div className={`text-center text-sm ${
          darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
        }`}>
          {isCorrect ? '🎉 太棒了！' : '💪 继续加油！'} 即将进入下一题...
        </div>
      )}
      
      {/* AI生成标记 */}
      {question.aiGenerated && (
        <div className={`text-center text-xs mt-4 ${
          darkMode ? 'text-neutral-dark-400' : 'text-neutral-500'
        }`}>
          🤖 本题由AI智能生成
        </div>
      )}
    </div>
  );
}