import React, { useState, useEffect, useRef } from 'react';
import { SentenceQuestion } from '../types/ai';
import { QuizQuestion } from '../types/quiz';
import { WordReorderingCard } from './WordReorderingCard';

interface SentenceQuestionCardProps {
  question: SentenceQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (selectedAnswer: string, timeSpent: number) => void;
  onExit?: () => void;
  darkMode?: boolean;
}

export function SentenceQuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onExit,
  darkMode = false
}: SentenceQuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout>();

  // 重置状态和启动计时器
  useEffect(() => {
    // 如果是词卡重组类型，不执行计时逻辑
    if (question.type === 'sentence-reordering') {
      return;
    }

    // 重置所有状态
    setSelectedOption(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setTimeSpent(0);

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
  }, [question.id, question.type]);

  // 如果是词卡重组类型，使用拖拽组件
  if (question.type === 'sentence-reordering') {
    return (
      <WordReorderingCard
        question={question}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
        onAnswer={onAnswer}
        onExit={onExit}
        darkMode={darkMode}
      />
    );
  }

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

  // 处理选项选择
  const handleOptionSelect = (option: string) => {
    if (showFeedback) return; // 防止重复选择
    
    setSelectedOption(option);
    
    // 检查答案是否正确
    const correct = option === question.correctAnswer;
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

  // 格式化时间显示
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${milliseconds.toString().padStart(2, '0')}秒`;
  };

  // 渲染句子内容
  const renderSentenceContent = () => {
    const sentenceToUse = question.modifiedSentence || question.originalSentence;
    const sentenceParts = sentenceToUse.split('______');

    return (
      <div className="text-center">
        <div className={`text-xl font-bold mb-4 ${
          darkMode ? 'text-white' : 'text-neutral-800'
        }`}>
          {sentenceParts[0]}
          <span className="inline-block mx-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded">
            ______
          </span>
          {sentenceParts[1] || ''}
        </div>

        {/* 句子的中文翻译 */}
        {sentenceTranslation && (
          <div className={`text-base font-medium mb-4 p-3 rounded-lg ${
            darkMode
              ? 'bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 text-purple-100'
              : 'bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 text-purple-900'
          }`}>
            <span className="opacity-70 text-sm mr-2">中文含义：</span>
            {sentenceTranslation}
          </div>
        )}

        <div className={`text-sm ${
          darkMode ? 'text-neutral-dark-400' : 'text-neutral-600'
        }`}>
          目标单词: <span className="font-medium">{question.targetWord}</span>
          {question.aiGenerated && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
              🤖 AI生成
            </span>
          )}
        </div>
      </div>
    );
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

      {/* 问题内容 */}
      <div className="mb-6">
        {renderSentenceContent()}
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
            {question.explanation}
          </div>
        </div>
      )}

      {/* 选项列表 - 仅对填空题型显示选项 */}
      {question.type === 'sentence-completion' && question.options && question.options.length > 0 && (
        <div className="space-y-3">
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