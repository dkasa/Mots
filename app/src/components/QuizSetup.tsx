import React, { useState, useEffect, useCallback } from 'react';
import { WordWithStatus } from '../types/vocabulary';
import { QuizConfig, QuizMode, QuizType, WordMemory } from '../types/quiz';
import { quizService } from '../services/quizService';

interface QuizSetupProps {
  words: WordWithStatus[];
  onStartQuiz: (config: QuizConfig) => void;
  onCancel: () => void;
  darkMode?: boolean;
}

export function QuizSetup({ words, onStartQuiz, onCancel, darkMode = false }: QuizSetupProps) {
  const [selectedMode, setSelectedMode] = useState<QuizMode>('current-unit');
  const [questionCount, setQuestionCount] = useState(10);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeSpelling, setIncludeSpelling] = useState(false);
  const [wordMemories, setWordMemories] = useState<WordMemory[]>([]);

  // 加载单词记忆数据
  const loadWordMemories = useCallback(async () => {
    try {
      const wordIds = words.map(word => word.id);
      const memories = await quizService.getWordMemories(wordIds);
      setWordMemories(memories);
    } catch (error) {
      console.error('加载单词记忆数据失败:', error);
    }
  }, [words]);

  // 加载单词记忆数据
  useEffect(() => {
    if (words.length > 0) {
      loadWordMemories();
    }
  }, [words, loadWordMemories]);

  // 可用的测试模式配置
  const quizModes = [
    {
      id: 'daily-5min' as QuizMode,
      name: '5分钟小测',
      description: '快速测试今日需要复习的单词',
      icon: '⏱️',
      available: getDailyReviewCount(words, wordMemories) > 0
    },
    {
      id: 'current-unit' as QuizMode,
      name: '当前单元小测',
      description: '测试当前选择单元/课程的单词',
      icon: '📚',
      available: true
    },
    {
      id: 'previous-errors' as QuizMode,
      name: '错词复测',
      description: '重新测试上次答错的单词',
      icon: '🔄',
      available: getPreviousErrorCount(words, wordMemories) > 0
    },
    {
      id: 'forgotten-words' as QuizMode,
      name: '遗忘词小测',
      description: '重点复习容易忘记的单词',
      icon: '🧠',
      available: getForgottenWordCount(words, wordMemories) > 0
    },
    {
      id: 'random-mixed' as QuizMode,
      name: '随机混合小测',
      description: '随机抽取单词进行综合测试',
      icon: '🎲',
      available: true
    }
  ];

  // 根据模式自动设置问题类型
  const getQuestionTypes = (mode: QuizMode): QuizType[] => {
    const baseTypes: QuizType[] = ['chinese-to-french', 'french-to-chinese'];
    
    if (includeAudio) {
      baseTypes.push('audio-to-chinese', 'audio-to-french');
    }
    
    if (includeSpelling) {
      baseTypes.push('spelling');
    }
    
    return baseTypes;
  };

  // 获取可用单词数量
  const getAvailableWordCount = (mode: QuizMode): number => {
    switch (mode) {
      case 'current-unit':
        return words.filter(word => !word.isMastered).length;
      case 'forgotten-words':
        return getForgottenWordCount(words, wordMemories);
      case 'previous-errors':
        return getPreviousErrorCount(words, wordMemories);
      case 'daily-5min':
        return getDailyReviewCount(words, wordMemories);
      default:
        return words.length;
    }
  };

  const handleStartQuiz = () => {
    const config: QuizConfig = {
      mode: selectedMode,
      questionCount: Math.min(questionCount, getAvailableWordCount(selectedMode)),
      questionTypes: getQuestionTypes(selectedMode),
      includeAudio,
      includeSpelling
    };
    
    onStartQuiz(config);
  };

  const maxQuestions = getAvailableWordCount(selectedMode);
  const isStartDisabled = maxQuestions === 0;

  return (
    <div className={`mx-5 my-8 transition-colors duration-300 ${darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'}`}>
      {/* 测试模式选择 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">选择测试模式</h2>
        <div className="grid gap-3">
          {quizModes.map(mode => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              disabled={!mode.available}
              className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedMode === mode.id
                  ? darkMode
                    ? 'border-primary-500 bg-primary-900/20'
                    : 'border-primary-500 bg-primary-50'
                  : darkMode
                  ? 'border-neutral-dark-300 hover:border-neutral-dark-400'
                  : 'border-neutral-200 hover:border-neutral-300'
              } ${
                !mode.available
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{mode.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{mode.name}</div>
                  <div className={`text-xs ${darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}`}>
                    {mode.description}
                  </div>
                </div>
                {!mode.available && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    darkMode ? 'bg-neutral-dark-700 text-neutral-dark-300' : 'bg-neutral-100 text-neutral-500'
                  }`}>
                    暂无单词
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 问题数量设置 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">
          题目数量 
          <span className={`text-sm font-normal ml-2 ${
            darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
          }`}>
            ({maxQuestions} 个单词可用)
          </span>
        </h2>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="5"
            max={Math.min(50, maxQuestions)}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="flex-1"
            disabled={maxQuestions === 0}
          />
          <span className="font-mono text-lg w-12 text-center">{questionCount}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span>5题</span>
          <span>快速</span>
          <span>适中</span>
          <span>深度</span>
          <span>{Math.min(50, maxQuestions)}题</span>
        </div>
      </div>

      {/* 题型设置 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">题型设置</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAudio}
              onChange={(e) => setIncludeAudio(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="flex-1">
              <span className="font-medium">听力题型</span>
              <span className={`block text-xs ${darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}`}>
                包含听音频选中文/法语题目
              </span>
            </span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSpelling}
              onChange={(e) => setIncludeSpelling(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="flex-1">
              <span className="font-medium">拼写题型</span>
              <span className={`block text-xs ${darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'}`}>
                包含填空和拼写题目（较难）
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-8">
        <button
          onClick={handleStartQuiz}
          disabled={isStartDisabled}
          className={`w-full py-3 font-semibold rounded-md transition-colors duration-200 ${
            isStartDisabled
              ? 'bg-neutral-400 text-neutral-600 cursor-not-allowed'
              : 'bg-primary-500 hover:bg-primary-600 text-white'
          }`}
        >
          {isStartDisabled ? '无可用单词' : '开始测试'}
        </button>
      </div>

      {/* 统计信息 */}
      <div className={`mt-6 p-4 rounded-lg text-sm ${
        darkMode ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-800'
      }`}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className={darkMode ? 'text-neutral-300' : 'text-neutral-600'}>总单词数:</span>
            <span className="ml-2 font-medium">{words.length}</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-300' : 'text-neutral-600'}>已掌握:</span>
            <span className="ml-2 font-medium">{words.filter(w => w.isMastered).length}</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-300' : 'text-neutral-600'}>需复习:</span>
            <span className="ml-2 font-medium">{getForgottenWordCount(words, wordMemories)}</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-300' : 'text-neutral-600'}>上次错误:</span>
            <span className="ml-2 font-medium">{getPreviousErrorCount(words, wordMemories)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 辅助函数：获取单词记忆数据
function getWordMemory(wordId: string, wordMemories: WordMemory[]): WordMemory | null {
  return wordMemories.find(memory => memory.wordId === wordId) || null;
}

// 辅助函数：获取遗忘单词数量
function getForgottenWordCount(words: WordWithStatus[], wordMemories: WordMemory[]): number {
  // 基于记忆等级筛选：只返回记忆等级为0-1级的单词
  return words.filter(word => {
    const memory = getWordMemory(word.id, wordMemories);
    // 记忆等级为0-1，或者没有记忆数据的新词
    return !word.isMastered && (!memory || memory.memoryLevel <= 1);
  }).length;
}

// 辅助函数：获取上次错误单词数量
function getPreviousErrorCount(words: WordWithStatus[], wordMemories: WordMemory[]): number {
  // 获取上次测试中答错的单词数量
  return words.filter(word => {
    const memory = getWordMemory(word.id, wordMemories);
    // 判断条件：有记忆数据，且最后一次测试答错了（lastAttempted存在但lastCorrect不存在或更早）
    return memory && memory.lastAttempted && 
           (!memory.lastCorrect || memory.lastAttempted > memory.lastCorrect);
  }).length;
}

// 辅助函数：获取每日复习单词数量
function getDailyReviewCount(words: WordWithStatus[], wordMemories: WordMemory[]): number {
  // 获取需要复习的单词（基于复习间隔）
  const now = Date.now();
  return words.filter(word => {
    const memory = getWordMemory(word.id, wordMemories);
    if (!memory) return true; // 新词需要复习
    
    // 确保 lastAttempted 存在
    if (!memory.lastAttempted) return true;
    
    const daysSinceLastReview = (now - memory.lastAttempted) / (1000 * 60 * 60 * 24);
    const reviewInterval = getReviewInterval(memory.memoryLevel);
    return daysSinceLastReview >= reviewInterval;
  }).length;
}

// 辅助函数：获取复习间隔
function getReviewInterval(memoryLevel: number): number {
  const intervals = [1, 1, 3, 7, 30];
  return intervals[memoryLevel] || 1;
}