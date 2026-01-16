import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

interface QuestionReviewProps {
  wordId: string;
  questionType: 'sentence-completion' | 'sentence-reordering';
  darkMode?: boolean;
}

interface Question {
  id: number;
  word_id: string;
  word: string;
  question_type: string;
  original_sentence: string;
  modified_sentence?: string;
  word_blocks?: string[];
  shuffled_blocks?: string[];
  options?: string[];
  correct_answer: string;
  explanation: string;
  created_at: string;
  ratings?: {
    positive: number;
    negative: number;
    userRating: 1 | -1 | null;
  };
}

export function QuestionReview({ wordId, questionType, darkMode = false }: QuestionReviewProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载题目列表
  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getAIQuestionsList(wordId, questionType);
      console.log('📋 题目列表API响应:', response);
      if (response.success && response.data) {
        console.log('📋 加载的题目数量:', response.data.length);
        console.log('📋 第一个题目示例:', response.data[0]);
        setQuestions(response.data);
      }
    } catch (error) {
      console.error('加载题目失败:', error);
    } finally {
      setLoading(false);
    }
  }, [wordId, questionType]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // 点赞/反赞
  const handleRate = async (questionId: number, rating: 1 | -1) => {
    try {
      const response = await apiService.rateAIQuestion(questionId, rating);
      if (response.success) {
        // 重新加载题目列表
        await loadQuestions();
      }
    } catch (error) {
      console.error('评估题目失败:', error);
      alert('操作失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className={`p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            加载中...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
      <h2 className="text-2xl font-bold mb-4">
        {questionType === 'sentence-completion' ? '句子填空题回顾' : '句子词卡重组题回顾'}
      </h2>

      {questions.length === 0 ? (
        <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          暂无题目
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <div
              key={question.id}
              className={`p-4 rounded-lg border ${
                darkMode
                  ? 'bg-gray-700 border-gray-600'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {/* 题目内容 */}
              <div className="mb-4">
                <p className="font-medium mb-2">
                  原句: {question.original_sentence}
                </p>
                {question.modified_sentence && (
                  <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    填空句: {question.modified_sentence}
                  </p>
                )}
                {question.explanation && (
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    解释: {question.explanation}
                  </p>
                )}
              </div>

              {/* 评价按钮 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    评价:
                  </span>
                  <button
                    onClick={() => handleRate(question.id, 1)}
                    disabled={question.ratings?.userRating === 1}
                    className={`px-3 py-1 rounded flex items-center gap-1 transition-colors ${
                      question.ratings?.userRating === 1
                        ? darkMode
                          ? 'bg-green-600 text-white cursor-not-allowed'
                          : 'bg-green-100 text-green-800 cursor-not-allowed'
                        : darkMode
                        ? 'bg-gray-600 hover:bg-green-600 text-white'
                        : 'bg-gray-100 hover:bg-green-100 text-gray-700'
                    }`}
                  >
                    <span>👍</span>
                    <span>{question.ratings?.positive || 0}</span>
                  </button>
                  <button
                    onClick={() => handleRate(question.id, -1)}
                    disabled={question.ratings?.userRating === -1}
                    className={`px-3 py-1 rounded flex items-center gap-1 transition-colors ${
                      question.ratings?.userRating === -1
                        ? darkMode
                          ? 'bg-red-600 text-white cursor-not-allowed'
                          : 'bg-red-100 text-red-800 cursor-not-allowed'
                        : darkMode
                        ? 'bg-gray-600 hover:bg-red-600 text-white'
                        : 'bg-gray-100 hover:bg-red-100 text-gray-700'
                    }`}
                  >
                    <span>👎</span>
                    <span>{question.ratings?.negative || 0}</span>
                  </button>
                </div>

                <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {new Date(question.created_at).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 使用说明 */}
      <div className={`mt-6 p-4 rounded-lg ${
        darkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'
      }`}>
        <h3 className="font-bold mb-2">使用说明</h3>
        <ul className={`list-disc list-inside space-y-1 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <li>点击👍表示题目质量好，会保留在题库中</li>
          <li>点击👎表示题目质量差，会从题库中删除</li>
          <li>当反赞数&gt;=3且赞数&lt;2时，题目会被自动删除</li>
          <li>删除后系统会自动生成新题目补齐到10题</li>
          <li>题库中的题目可以重复使用，不会在同一会话中避免重复</li>
        </ul>
      </div>
    </div>
  );
}