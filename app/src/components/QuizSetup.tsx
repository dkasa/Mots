import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [selectedMode, setSelectedMode] = useState<QuizMode>('current-range');
  const [questionCount, setQuestionCount] = useState(10);
  const [includeChoice, setIncludeChoice] = useState(true);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [includeSpelling, setIncludeSpelling] = useState(false);
  const [includeSentence, setIncludeSentence] = useState(false);
  const [wordMemories, setWordMemories] = useState<WordMemory[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // 计算抽屉内容高度
  useEffect(() => {
    if (contentRef.current && isOpen) {
      const contentHeight = contentRef.current.scrollHeight;
      setDrawerHeight(contentHeight);
    } else {
      setDrawerHeight(0);
    }
  }, [isOpen, selectedMode, questionCount, includeChoice, includeAudio, includeSpelling, includeSentence]);

  // 可用的测试模式配置
  const quizModes = [
    {
      id: 'current-range' as QuizMode,
      name: '当前范围小测',
      description: '测试当前选择范围单词',
      icon: '📚',
      available: true
    },
    {
      id: 'previous-errors' as QuizMode,
      name: '错词复测',
      description: '重新测试上次打错单词',
      icon: '🔄',
      available: getPreviousErrorCount(words, wordMemories) > 0
    }
  ];

  // 根据模式自动设置问题类型
  const getQuestionTypes = (mode: QuizMode): QuizType[] => {
    const baseTypes: QuizType[] = [];
    
    if (includeChoice) {
      baseTypes.push('chinese-to-french', 'french-to-chinese');
    }
    
    if (includeAudio) {
      baseTypes.push('audio-to-chinese', 'audio-to-french');
    }
    
    if (includeSpelling) {
      baseTypes.push('spelling');
    }
    
    if (includeSentence) {
      baseTypes.push('sentence-completion', 'sentence-reordering');
    }
    
    // 如果没有选择任何题型，默认包含选择题型
    if (baseTypes.length === 0) {
      baseTypes.push('chinese-to-french', 'french-to-chinese');
    }
    
    return baseTypes;
  };

  // 获取可用单词数量
  const getAvailableWordCount = (mode: QuizMode): number => {
    switch (mode) {
      case 'current-range':
        return words.filter(word => !word.isMastered).length;
      case 'previous-errors':
        return getPreviousErrorCount(words, wordMemories);
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
      includeSpelling,
      includeSentence
    };
    
    onStartQuiz(config);
  };

  const maxQuestions = getAvailableWordCount(selectedMode);
  const isStartDisabled = maxQuestions === 0;

  // 题型选项
  const questionTypeOptions = [
    {
      id: 'choice',
      name: '选择题',
      description: '看中文选法语/看法语选中文',
      icon: '📝',
      isSelected: includeChoice
    },
    {
      id: 'audio',
      name: '听力题',
      description: '听音频选中文/法语',
      icon: '🎵',
      isSelected: includeAudio
    },
    {
      id: 'spelling',
      name: '拼写题',
      description: '填空和拼写题目',
      icon: '✏️',
      isSelected: includeSpelling
    },
    {
      id: 'sentence',
      name: '智能句子',
      description: 'AI生成句子填空',
      icon: '🧠',
      isSelected: includeSentence
    }
  ];

  // 获取当前设置的摘要文本
  const getCurrentSettingsText = () => {
    const parts: string[] = [];
    if (includeChoice) parts.push('选择');
    if (includeAudio) parts.push('听力');
    if (includeSpelling) parts.push('拼写');
    if (includeSentence) parts.push('句子');
    const typeText = parts.length > 0 ? parts.join('+') : '基础';
    return `${questionCount}题 | ${typeText}`;
  };

  return (
    <div className={`mx-5 my-8 transition-colors duration-300 ${darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'}`}>
      {/* 题型选择 - 可折叠区域 */}
      <div className="mb-6">
        {/* 触发区域 */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full rounded-lg border p-4 text-left transition-colors duration-200 shadow-sm cursor-pointer ${
            darkMode 
              ? 'bg-neutral-dark-100 border-neutral-dark-300 hover:bg-neutral-dark-200' 
              : 'bg-white border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                darkMode ? 'bg-primary-dark-100' : 'bg-primary-100'
              }`}>
                <svg 
                  className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} ${
                    darkMode ? 'text-primary-dark-600' : 'text-primary-600'
                  }`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${
                  darkMode ? 'text-neutral-dark-900' : 'text-neutral-900'
                }`}>题型选择</div>
                <div className={`text-xs ${
                  darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
                }`}>{getCurrentSettingsText()}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${
                darkMode 
                  ? 'text-neutral-dark-400 bg-neutral-dark-200' 
                  : 'text-neutral-400 bg-neutral-100'
              }`}>
                {quizModes.find(m => m.id === selectedMode)?.name}
              </span>
            </div>
          </div>
        </div>

        {/* 抽屉内容 */}
        <div
          ref={drawerRef}
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ height: `${drawerHeight}px` }}
        >
          <div ref={contentRef} className="mt-2">
            <div className={`rounded-lg border p-4 ${
              darkMode 
                ? 'bg-neutral-dark-100 border-neutral-dark-300' 
                : 'bg-white border-neutral-200'
            }`}>
              {/* 测试模式选择 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className={`text-sm font-medium ${
                    darkMode ? 'text-neutral-dark-700' : 'text-neutral-700'
                  }`}>测试模式</label>
                  <span className={`text-xs px-2 py-1 rounded ${
                    darkMode 
                      ? 'text-neutral-dark-500 bg-neutral-dark-200' 
                      : 'text-neutral-500 bg-neutral-100'
                  }`}>
                    {quizModes.find(m => m.id === selectedMode)?.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quizModes.map(mode => {
                    const isActive = selectedMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setSelectedMode(mode.id)}
                        disabled={!mode.available}
                        className={`
                          relative py-3 px-2 text-sm font-medium rounded-lg transition-all duration-200 border
                          ${isActive 
                            ? 'bg-primary-500 text-white border-primary-500 shadow-sm' 
                            : darkMode 
                              ? 'bg-neutral-dark-100 text-neutral-dark-600 border-neutral-dark-300 hover:border-neutral-dark-400 hover:bg-neutral-dark-200'
                              : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                          }
                          ${!mode.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-medium">{mode.name}</span>
                          <span className={`text-xs mt-0.5 ${
                            isActive ? 'text-primary-100' : 
                            darkMode ? 'text-neutral-dark-400' : 'text-neutral-400'
                          }`}>
                            {mode.description}
                          </span>
                        </div>
                        {isActive && (
                          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 题型设置 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className={`text-sm font-medium ${
                    darkMode ? 'text-neutral-dark-700' : 'text-neutral-700'
                  }`}>题型设置</label>
                  <span className={`text-xs px-2 py-1 rounded ${
                    darkMode 
                      ? 'text-neutral-dark-500 bg-neutral-dark-200' 
                      : 'text-neutral-500 bg-neutral-100'
                  }`}>
                    {includeChoice && includeAudio && includeSpelling && includeSentence ? '全部' : 
                     includeChoice && includeAudio && includeSpelling ? '选择+听力+拼写' : 
                     includeChoice && includeAudio && includeSentence ? '选择+听力+句子' : 
                     includeChoice && includeSpelling && includeSentence ? '选择+拼写+句子' : 
                     includeAudio && includeSpelling && includeSentence ? '听力+拼写+句子' : 
                     includeChoice && includeAudio ? '选择+听力' : 
                     includeChoice && includeSpelling ? '选择+拼写' : 
                     includeChoice && includeSentence ? '选择+句子' : 
                     includeAudio && includeSpelling ? '听力+拼写' : 
                     includeAudio && includeSentence ? '听力+句子' : 
                     includeSpelling && includeSentence ? '拼写+句子' : 
                     includeChoice ? '选择' : 
                     includeAudio ? '听力' : 
                     includeSpelling ? '拼写' : 
                     includeSentence ? '句子' : '基础'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {questionTypeOptions.map(option => {
                    const isActive = option.isSelected;
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          if (option.id === 'choice') {
                            setIncludeChoice(!includeChoice);
                          } else if (option.id === 'audio') {
                            setIncludeAudio(!includeAudio);
                          } else if (option.id === 'spelling') {
                            setIncludeSpelling(!includeSpelling);
                          } else if (option.id === 'sentence') {
                            setIncludeSentence(!includeSentence);
                          }
                        }}
                        className={`
                          flex-1 h-16 text-base font-medium rounded-md transition-all duration-250 ease-out relative
                          ${isActive 
                            ? (darkMode 
                              ? 'bg-primary-500 text-white font-semibold shadow-dark-sm' 
                              : 'bg-primary-500 text-white font-semibold shadow-sm') 
                            : (darkMode 
                              ? 'text-neutral-dark-600 hover:bg-neutral-dark-300' 
                              : 'text-neutral-600 hover:bg-neutral-50')
                          }
                        `}
                      >
                        {option.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 问题数量设置 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className={`text-sm font-medium ${
                    darkMode ? 'text-neutral-dark-700' : 'text-neutral-700'
                  }`}>题目数量</label>
                  <span className={`text-xs px-2 py-1 rounded ${
                    darkMode 
                      ? 'text-neutral-dark-500 bg-neutral-dark-200' 
                      : 'text-neutral-500 bg-neutral-100'
                  }`}>
                    {maxQuestions} 个可用
                  </span>
                </div>
                <div className="space-y-3">
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
                  <div className="flex justify-between text-xs">
                    <span>5题</span>
                    <span>快速</span>
                    <span>适中</span>
                    <span>深度</span>
                    <span>{Math.min(50, maxQuestions)}题</span>
                  </div>
                </div>
              </div>

              {/* 完成按钮 */}
              <div className={`mt-4 pt-3 border-t ${
                darkMode ? 'border-neutral-dark-300' : 'border-neutral-200'
              }`}>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2.5 px-4 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors duration-200 shadow-sm"
                >
                  完成设置
                </button>
              </div>
            </div>
          </div>
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
            <span className={darkMode ? 'text-neutral-300' : 'text-neutral-600'}>未掌握:</span>
            <span className="ml-2 font-medium">{words.filter(w => !w.isMastered).length}</span>
          </div>
          <div>
            <span className={darkMode ? 'text-neutral-300' : 'text-neutral-600'}>错词复测:</span>
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

// 辅助函数：获取上次错误单词数量
function getPreviousErrorCount(words: WordWithStatus[], wordMemories: WordMemory[]): number {
  // 获取上次测试中答错的单词数量（仅限当前过滤范围内的单词）
  return words.filter(word => {
    const memory = getWordMemory(word.id, wordMemories);
    // 判断条件：有记忆数据，且最后一次测试答错了（lastCorrect不存在或lastAttempted比lastCorrect晚）
    if (!memory || !memory.lastAttempted) {
      return false;
    }
    
    // 如果lastCorrect不存在，说明从未答对过，肯定是错词
    if (!memory.lastCorrect) {
      return true;
    }
    
    // 如果lastAttempted比lastCorrect晚，说明最后一次测试答错了
    return memory.lastAttempted > memory.lastCorrect;
  }).length;
}