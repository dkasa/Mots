import React, { useState, useCallback } from 'react';
import { QuizSession, QuizQuestion } from '../types/quiz';
import { unescapeFrenchText } from '../lib/utils';
import { apiService } from '../services/api';

interface QuizResultScreenProps {
  quizSession: QuizSession;
  onRestart: () => void;
  onExit: () => void;
  darkMode?: boolean;
  wordId?: string;
  questionType?: 'sentence-completion' | 'sentence-reordering';
}

export function QuizResultScreen({ quizSession, onRestart, onExit, darkMode = false, wordId, questionType }: QuizResultScreenProps) {
  const { results, questions, startTime, endTime } = quizSession;
  
  // 题目评价状态
  const [ratings, setRatings] = useState<Record<number, { positive: number; negative: number; userRating: 1 | -1 | null }>>({});
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [ratingQuestionId, setRatingQuestionId] = useState<number | null>(null); // 当前正在评价的题目ID
  
  // 加载题目评价信息
  const loadRatings = useCallback(async () => {
    // 收集所有需要加载评价的题目 ID
    const questionIds: number[] = [];
    questions.forEach((question, index) => {
      if (question.aiGenerated) {
        const backendQuestionId = getBackendQuestionId(question);
        if (backendQuestionId) {
          questionIds.push(backendQuestionId);
        }
      }
    });

    if (questionIds.length === 0) return;

    console.log('📊 准备加载评价数据，题目ID列表:', questionIds);

    try {
      setLoadingRatings(true);
      const ratingsMap: Record<number, { positive: number; negative: number; userRating: 1 | -1 | null }> = {};

      // 为每个题目单独获取评价数据
      for (const questionId of questionIds) {
        try {
          const response = await apiService.getAIQuestionRatings(questionId);
          if (response.success && response.data) {
            ratingsMap[questionId] = {
              positive: response.data.positive || 0,
              negative: response.data.negative || 0,
              userRating: response.data.userRating || null
            };
            console.log('📊 加载评价数据:', questionId, ratingsMap[questionId]);
          }
        } catch (error) {
          console.warn(`获取题目 ${questionId} 的评价数据失败:`, error);
          // 即使失败，也初始化一个默认值，使按钮可用
          ratingsMap[questionId] = {
            positive: 0,
            negative: 0,
            userRating: null
          };
        }
      }

      console.log('📊 所有评价数据:', ratingsMap);
      setRatings(ratingsMap);
    } catch (error) {
      console.error('加载评价信息失败:', error);
    } finally {
      setLoadingRatings(false);
      setRatingQuestionId(null);
    }
  }, [questions]);

  // 从题目 ID 中提取后端纯数字 ID
  const getBackendQuestionId = (question: QuizQuestion): number | null => {
    // 优先使用 questionId 属性（如果有的话）
    if (question.questionId && typeof question.questionId === 'number') {
      console.log('🔑 使用 questionId:', question.questionId, '题目ID:', question.id);
      return question.questionId;
    }
    
    // 如果题目 ID 以 "sentence-" 开头，提取数字部分
    if (question.id && typeof question.id === 'string' && question.id.startsWith('sentence-')) {
      const idNumber = parseInt(question.id.replace('sentence-', ''));
      if (!isNaN(idNumber)) {
        console.log('🔑 从 sentence- 前缀提取ID:', idNumber, '题目ID:', question.id);
        return idNumber;
      }
    }
    
    // 如果是纯数字 ID，直接返回
    if (typeof question.id === 'number') {
      console.log('🔑 使用数字ID:', question.id);
      return question.id;
    }
    
    // 尝试从字符串ID中提取数字
    if (question.id && typeof question.id === 'string') {
      const idMatch = question.id.match(/\d+/);
      if (idMatch) {
        const idNumber = parseInt(idMatch[0]);
        if (!isNaN(idNumber)) {
          console.log('🔑 从字符串ID提取数字:', idNumber, '题目ID:', question.id);
          return idNumber;
        }
      }
    }
    
    console.warn('⚠️ 无法提取后端题目ID:', question.id, question.questionId);
    return null;
  };

  React.useEffect(() => {
    loadRatings();
  }, [loadRatings]);
  
  // 评价处理函数
  const handleRate = async (questionId: number, rating: 1 | -1) => {
    try {
      setRatingQuestionId(questionId);
      const response = await apiService.rateAIQuestion(questionId, rating);
      if (response.success) {
        // 重新加载评价信息，按钮状态会自动更新
        await loadRatings();
      }
    } catch (error) {
      console.error('评价题目失败:', error);
      // 不显示弹窗，只是恢复按钮状态
      setRatingQuestionId(null);
    }
  };
  
  // 计算统计信息
  const correctCount = results.filter(r => r.isCorrect).length;
  const totalQuestions = questions.length;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const totalTime = endTime ? endTime - startTime : 0;
  const averageTime = totalQuestions > 0 ? Math.round(totalTime / totalQuestions) : 0;
  
  // 计算最佳连对
  let bestStreak = 0;
  let currentStreak = 0;
  results.forEach(result => {
    if (result.isCorrect) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  // 获取成绩评级
  const getGrade = (accuracy: number): { grade: string; color: string; message: string } => {
    if (accuracy >= 90) return { grade: 'A', color: 'text-success-500', message: '优秀！继续保持！' };
    if (accuracy >= 80) return { grade: 'B', color: 'text-primary-500', message: '很好！再接再厉！' };
    if (accuracy >= 70) return { grade: 'C', color: 'text-warning-500', message: '不错！继续努力！' };
    if (accuracy >= 60) return { grade: 'D', color: 'text-orange-500', message: '及格，需要多练习' };
    return { grade: 'F', color: 'text-error-500', message: '加油！多复习一下' };
  };

  const { grade, color, message } = getGrade(accuracy);

  // 格式化时间
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  };

  // 格式化平均时间
  const formatAverageTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${milliseconds.toString().padStart(2, '0')}秒`;
  };

  return (
    <div className={`mx-5 my-8 transition-colors duration-300 ${
      darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
    }`}>
      {/* 成绩卡片 */}
      <div className="text-center mb-8">
        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 ${
          darkMode ? 'bg-neutral-dark-800' : 'bg-white shadow-lg'
        }`}>
          <span className={`text-4xl font-bold ${color}`}>{grade}</span>
        </div>
        
        <h1 className="text-2xl font-bold mb-2">测试完成！</h1>
        <p className={`text-lg mb-1 ${darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'}`}>
          正确率: <span className="font-bold">{accuracy}%</span>
        </p>
        <p className={`text-sm ${darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}`}>
          {message}
        </p>
      </div>

      {/* 详细统计 */}
      <div className={`p-4 rounded-lg mb-6 ${
        darkMode ? 'bg-neutral-dark-900 border border-neutral-dark-700' : 'bg-neutral-50'
      }`}>
        <h2 className="text-lg font-semibold mb-3">详细统计</h2>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>总题数:</span>
            <span className="ml-2 font-medium">{totalQuestions}</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>答对:</span>
            <span className="ml-2 font-medium text-success-600">{correctCount}</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>答错:</span>
            <span className="ml-2 font-medium text-error-600">{totalQuestions - correctCount}</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>正确率:</span>
            <span className="ml-2 font-medium">{accuracy}%</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>总用时:</span>
            <span className="ml-2 font-medium">{formatTime(totalTime)}</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>平均用时:</span>
            <span className="ml-2 font-medium">{formatAverageTime(averageTime)}</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>最佳连对:</span>
            <span className="ml-2 font-medium">{bestStreak}</span>
          </div>
        </div>
      </div>

      {/* 题目回顾 */}
      <div className={`p-4 rounded-lg mb-6 ${
        darkMode ? 'bg-neutral-dark-900 border border-neutral-dark-700' : 'bg-neutral-50'
      }`}>
        <h2 className="text-lg font-semibold mb-3">题目回顾</h2>
        
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {questions.map((question, index) => {
            const result = results[index];
            const isCorrect = result?.isCorrect;
            
            return (
              <div 
                key={question.id}
                className={`p-3 rounded-lg border ${
                  isCorrect
                    ? darkMode ? 'border-success-500/30 bg-success-900/10' : 'border-success-200 bg-success-50'
                    : darkMode ? 'border-error-500/30 bg-error-900/10' : 'border-error-200 bg-error-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    isCorrect
                      ? 'bg-success-500 text-white'
                      : 'bg-error-500 text-white'
                  }`}>
                    {index + 1}
                  </span>
                  <span className={`text-sm font-medium ${
                    isCorrect ? 'text-success-600' : 'text-error-600'
                  }`}>
                    {isCorrect ? '✓ 正确' : '✗ 错误'}
                  </span>
                  {result && (
                    <span className={`text-xs ml-auto ${
                      darkMode ? 'text-neutral-dark-400' : 'text-neutral-500'
                    }`}>
                      {formatAverageTime(result.timeSpent)}
                    </span>
                  )}
                </div>
                
                <div className="text-sm space-y-1">
                  <div>
                    <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>
                      问题: 
                    </span>
                    <span>{getQuestionText(question)}</span>
                  </div>
                  <div>
                    <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>
                      正确答案: 
                    </span>
                    <span className="font-medium">{unescapeFrenchText(question.correctAnswer)}</span>
                  </div>
                  {result && !isCorrect && (
                    <div>
                      <span className={darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}>
                        你的答案: 
                      </span>
                      <span className="font-medium text-error-600">{unescapeFrenchText(result.selectedAnswer)}</span>
                    </div>
                  )}
                </div>

                {/* 点赞/反赞按钮 - 仅对 AI 生成的题目显示 */}
                {question.aiGenerated && (() => {
                  const backendQuestionId = getBackendQuestionId(question);
                  if (!backendQuestionId) return null;

                  const ratingData = ratings[backendQuestionId];
                  const isRatedUp = ratingData?.userRating === 1;
                  const isRatedDown = ratingData?.userRating === -1;
                  const isRating = ratingQuestionId === backendQuestionId; // 当前正在评价此题

                  console.log(`🔍 题目${index + 1}状态:`, {
                    questionId: question.id,
                    backendQuestionId,
                    ratingData,
                    isRatedUp,
                    isRatedDown,
                    isRating,
                    disabled: isRatedUp || isRatedDown || isRating
                  });

                  return (
                    <div className="mt-3 pt-3 border-t" style={{
                      borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                    }}>
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => handleRate(backendQuestionId, 1)}
                          disabled={isRatedUp || isRating}
                          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 ${
                            isRatedUp
                              ? darkMode
                                ? 'bg-primary-600 text-white cursor-not-allowed'
                                : 'bg-primary-500 text-white cursor-not-allowed'
                              : isRating
                                ? 'opacity-50 cursor-not-allowed'
                                : darkMode
                                  ? 'bg-neutral-dark-800 text-neutral-dark-300 hover:bg-neutral-dark-700 hover:text-primary-400'
                                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-primary-600'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">{ratingData?.positive || 0}</span>
                        </button>
                        <button
                          onClick={() => handleRate(backendQuestionId, -1)}
                          disabled={isRatedDown || isRating}
                          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 ${
                            isRatedDown
                              ? darkMode
                                ? 'bg-neutral-dark-600 text-neutral-dark-400 cursor-not-allowed'
                                : 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                              : isRating
                                ? 'opacity-50 cursor-not-allowed'
                                : darkMode
                                  ? 'bg-neutral-dark-800 text-neutral-dark-300 hover:bg-neutral-dark-700 hover:text-neutral-dark-200'
                                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">{ratingData?.negative || 0}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={onExit}
          className={`flex-1 py-3 font-semibold rounded-md transition-colors duration-200 ${
            darkMode
              ? 'bg-neutral-dark-300 hover:bg-neutral-dark-400 text-neutral-dark-800'
              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
          }`}
        >
          返回
        </button>
        <button
          onClick={onRestart}
          className={`flex-1 py-3 font-semibold rounded-md transition-colors duration-200 ${
            darkMode
              ? 'bg-primary-600 hover:bg-primary-700 text-white'
              : 'bg-primary-500 hover:bg-primary-600 text-white'
          }`}
        >
          重新测试
        </button>
      </div>

      {/* 学习建议 */}
      {accuracy < 80 && (
        <div className={`mt-6 p-4 rounded-lg text-sm ${
          darkMode ? 'bg-warning-900/20 border-warning-500/30' : 'bg-warning-50 border-warning-200'
        } border`}>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-warning-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-warning-600">学习建议</span>
          </div>
          <p className={darkMode ? 'text-warning-400' : 'text-warning-600'}>
            {accuracy >= 60 
              ? '建议多复习错误题目，加强对单词的记忆。'
              : '建议重新学习相关单元，打好基础后再进行测试。'
            }
          </p>
        </div>
      )}
    </div>
  );
}

// 辅助函数：获取问题文本
function getQuestionText(question: QuizQuestion): string {
  switch (question.type) {
    case 'chinese-to-french':
      return `"${question.question}" 的法语翻译是？`;
    case 'french-to-chinese':
      return `"${question.question}" 的中文意思是？`;
    case 'audio-to-chinese':
      return '听音频选择正确的中文意思';
    case 'audio-to-french':
      return '听音频选择正确的法语拼写';
    case 'spelling':
      return `"${question.question}" 的法语拼写是？`;
    default:
      return question.question;
  }
}