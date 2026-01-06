import React, { useState, useEffect, useRef } from 'react';
import { QuizQuestion } from '../types/quiz';

interface QuizQuestionCardProps {
  question: QuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (selectedAnswer: string, timeSpent: number) => void;
  onExit?: () => void;
  darkMode?: boolean;
}

export function QuizQuestionCard({ 
  question, 
  questionNumber, 
  totalQuestions, 
  onAnswer, 
  onExit,
  darkMode = false 
}: QuizQuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentVoiceType, setCurrentVoiceType] = useState<'male' | 'female'>(question.voiceType || 'female');
  
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout>();

  // 重置状态和启动计时器
  useEffect(() => {
    // 重置所有状态
    setSelectedOption(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setTimeSpent(0);
    setAudioPlaying(false);
    
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
  }, [question.id]);

  // 播放音频 - 支持男声女声轮流播放
  const playAudio = () => {
    // 计算下一次播放的语音类型
    const nextVoiceType = currentVoiceType === 'male' ? 'female' : 'male';
    setCurrentVoiceType(nextVoiceType);
    
    // 获取法语单词（根据题型决定使用哪个字段）
    let frenchWord = '';
    if (question.type === 'audio-to-chinese') {
      // audio-to-chinese题型：correctAnswer是中文，需要从问题中获取法语单词
      frenchWord = question.explanation?.split(' - ')[0] || question.correctAnswer;
    } else {
      // audio-to-french题型：correctAnswer就是法语单词
      frenchWord = question.correctAnswer;
    }
    
    // 清理法语单词，生成正确的文件名
    const cleanFrenchWord = frenchWord
      .split(' - ')[0] // 去掉解释部分
      .trim()
      .toLowerCase()
      .replace(/[^a-zàâäéèêëîïôöùûüÿçœæ\s]/g, '') // 只保留法语字母和空格
      .replace(/\s+/g, '_'); // 空格替换为下划线
    
    const audioUrl = `/audio/grade${question.wordId.split('-')[0]}/${nextVoiceType}/${cleanFrenchWord}.m4a`;
    
    setAudioPlaying(true);
    const audio = new Audio(audioUrl);
    audio.onended = () => setAudioPlaying(false);
    audio.onerror = () => {
      console.log('音频加载失败:', audioUrl);
      setAudioPlaying(false);
    };
    audio.play().catch(error => {
      console.log('音频播放失败:', error, audioUrl);
      setAudioPlaying(false);
    });
  };

  // 处理选项选择
  const handleOptionSelect = (option: string) => {
    if (showFeedback) return; // 防止重复选择
    
    setSelectedOption(option);
    
    // 对于拼写题型，不区分大小写和音调
    let correct = false;
    if (question.type === 'spelling') {
      // 移除音调符号并转换为小写进行比较
      const normalizeText = (text: string) => {
        return text
          .normalize('NFD') // 将组合字符分解为基本字符和重音符号
          .replace(/[\u0300-\u036f]/g, '') // 移除重音符号
          .toLowerCase() // 转换为小写
          .trim(); // 移除首尾空格
      };
      
      const normalizedOption = normalizeText(option);
      const normalizedCorrect = normalizeText(question.correctAnswer);
      correct = normalizedOption === normalizedCorrect;
    } else {
      // 其他题型保持严格匹配
      correct = option === question.correctAnswer;
    }
    
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
      onAnswer(option, timeSpent);
    }, 1500);
  };

  // 播放反馈音效
  const playFeedbackSound = (correct: boolean) => {
    const audioUrl = correct ? '/audio/success.mp3' : '/audio/failure.mp3';
    const audio = new Audio(audioUrl);
    audio.volume = 0.3; // 降低音量
    audio.play().catch(error => {
      console.log('反馈音效播放失败:', error);
    });
  };

  // 渲染问题内容
  const renderQuestionContent = () => {
    switch (question.type) {
      case 'chinese-to-french':
        return (
          <div className="text-center">
            <div className={`text-2xl font-bold mb-4 ${
              darkMode ? 'text-white' : 'text-neutral-800'
            }`}>
              {question.question}
            </div>
            <div className={`text-sm ${darkMode ? 'text-neutral-dark-300' : 'text-neutral-500'}`}>
              请选择正确的法语翻译
            </div>
          </div>
        );

      case 'french-to-chinese':
        return (
          <div className="text-center">
            <div className={`text-2xl font-bold mb-4 ${
              darkMode ? 'text-white' : 'text-neutral-800'
            }`}>
              {question.question}
            </div>
            <div className={`text-sm ${darkMode ? 'text-neutral-dark-300' : 'text-neutral-500'}`}>
              请选择正确的中文意思
            </div>
          </div>
        );

      case 'audio-to-chinese':
      case 'audio-to-french':
        return (
          <div className="text-center">
            <button
              onClick={playAudio}
              disabled={audioPlaying}
              className={`mb-4 p-4 rounded-full transition-all duration-200 ${
                audioPlaying
                  ? 'bg-primary-500 text-white'
                  : darkMode
                  ? 'bg-neutral-dark-300 hover:bg-neutral-dark-400 text-neutral-dark-800'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                {audioPlaying ? (
                  <path d="M6 6h4v12H6zm8 0h4v12h-4z"/>
                ) : (
                  <path d="M8 5v14l11-7z"/>
                )}
              </svg>
            </button>
            <div className={`text-sm ${darkMode ? 'text-neutral-dark-300' : 'text-neutral-500'}`}>
              {question.type === 'audio-to-chinese' 
                ? '请选择正确的中文意思' 
                : '请选择正确的法语拼写'
              }
            </div>
          </div>
        );

      case 'spelling':
        return (
          <div className="text-center">
            <div className={`text-2xl font-bold mb-4 ${
              darkMode ? 'text-white' : 'text-neutral-800'
            }`}>
              {question.question}
            </div>
            <div className={`text-sm ${darkMode ? 'text-neutral-dark-300' : 'text-neutral-500'}`}>
              请输入正确的法语拼写
            </div>
            <input 
              type="text" 
              value={selectedOption || ''}
              onChange={(e) => setSelectedOption(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && selectedOption) {
                  handleOptionSelect(selectedOption);
                }
              }}
              className={`mt-4 p-3 border rounded-lg w-full max-w-sm transform-gpu transition-transform duration-200 focus:scale-105 ${
                darkMode 
                  ? 'bg-black border-neutral-dark-700 text-white placeholder-neutral-dark-500' 
                  : 'bg-white border-neutral-300 text-neutral-800 placeholder-neutral-500'
              }`}
              placeholder="输入法语单词..."
              onFocus={(e) => {
                // 移动端优化：输入法弹出时自动滚动
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              }}
            />
            <button
              onClick={() => selectedOption && handleOptionSelect(selectedOption)}
              disabled={!selectedOption}
              className="mt-4 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              确认答案
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // 格式化时间显示
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${milliseconds.toString().padStart(2, '0')}秒`;
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
                className={`text-xs px-3 py-1 rounded border transition-colors duration-200 ${
                  darkMode 
                    ? 'border-neutral-dark-500 text-neutral-dark-300 hover:border-neutral-dark-400 hover:text-white' 
                    : 'border-neutral-400 text-neutral-600 hover:border-neutral-500 hover:text-neutral-800'
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

      {/* 问题内容 */}
      <div className="mb-8">
        {renderQuestionContent()}
      </div>

      {/* 选项列表 */}
      {question.options.length > 0 && (
        <div className="space-y-3 mb-8">
          {question.options.map((option, index) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = option === question.correctAnswer;
            
            let optionStyle = '';
            if (showFeedback) {
              if (isCorrectOption) {
                optionStyle = 'bg-success-500 text-white border-success-500';
              } else if (isSelected && !isCorrect) {
                optionStyle = 'bg-error-500 text-white border-error-500';
              } else {
                optionStyle = darkMode 
                  ? 'bg-neutral-dark-700 text-neutral-dark-300 border-neutral-dark-500 opacity-50'
                  : 'bg-neutral-100 text-neutral-500 border-neutral-300 opacity-50';
              }
            } else {
              optionStyle = isSelected
                ? darkMode
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-primary-500 text-white border-primary-500'
                : darkMode
                ? 'bg-neutral-dark-300 hover:bg-neutral-dark-400 text-neutral-dark-800 border-neutral-dark-400'
                : 'bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-300';
            }

            return (
              <button
                key={index}
                onClick={() => handleOptionSelect(option)}
                disabled={showFeedback}
                className={`w-full p-4 text-left rounded-lg border-2 transition-all duration-200 font-medium ${
                  optionStyle
                } ${showFeedback ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    showFeedback 
                      ? isCorrectOption 
                        ? 'bg-white text-success-500' 
                        : isSelected 
                        ? 'bg-white text-error-500'
                        : darkMode
                        ? 'bg-neutral-dark-600 text-neutral-dark-400'
                        : 'bg-neutral-200 text-neutral-500'
                      : darkMode
                      ? 'bg-neutral-dark-600 text-white'
                      : 'bg-neutral-200 text-neutral-700'
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="flex-1">{option}</span>
                  {showFeedback && isCorrectOption && (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 反馈信息 */}
      {showFeedback && question.explanation && (
        <div className={`p-4 rounded-lg mb-4 animate-fade-in ${
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
            {question.explanation}
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
    </div>
  );
}