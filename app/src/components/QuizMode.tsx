import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { WordWithStatus } from '../types/vocabulary';
import { QuizQuestion, QuizSession, QuizResult, QuizConfig, QuizMode as QuizModeType, QuizType, WordMemory } from '../types/quiz';
import { QuizQuestionCard } from './QuizQuestionCard';
import { SentenceQuestionCard } from './SentenceQuestionCard';
import { QuizResultScreen } from './QuizResultScreen';
import { QuizSetup } from './QuizSetup';
import { AIThinkingAnimation } from './AIThinkingAnimation';
import { apiService } from '../services/api';
import { LoadingSkeleton, ErrorState, EmptyState } from './LoadingStates';
import { quizService } from '../services/quizService';
import { aiService } from '../services/aiService';

interface QuizModeProps {
  words: WordWithStatus[];
  loading: boolean;
  error: string | null;
  onSync?: () => void;
  darkMode?: boolean;
}

export function QuizMode({ words, loading, error, onSync, darkMode = false }: QuizModeProps) {
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showSetup, setShowSetup] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [wordMemories, setWordMemories] = useState<WordMemory[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGenerationProgress, setAiGenerationProgress] = useState(0);

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

  // 生成测试问题
  const generateQuizQuestions = useCallback(async (
    config: QuizConfig,
    words: WordWithStatus[],
    onQuestionsUpdate?: (newQuestions: QuizQuestion[]) => void
  ): Promise<QuizQuestion[]> => {
    // 根据模式筛选单词
    const filteredWords = filterWordsByMode(config.mode, words, wordMemories);

    if (filteredWords.length === 0) {
      return [];
    }

    const questionCount = Math.min(config.questionCount, filteredWords.length * 2);
    const questionTypes = config.questionTypes;
    
    // 判断题型
    const hasAITypes = questionTypes.some(type => 
      type === 'sentence-completion' || type === 'sentence-reordering'
    );
    
    const nonAITypes = questionTypes.filter(type => 
      type !== 'sentence-completion' && type !== 'sentence-reordering'
    );

    console.log(`📊 开始生成 ${questionCount} 道题目，可用单词: ${filteredWords.length}`);
    console.log(`📝 题型配置: ${questionTypes.join(', ')}`);
    console.log(`🤖 包含AI题型: ${hasAITypes}`);

    const questions: QuizQuestion[] = [];
    const usedWordIds: string[] = [];

    // 计算每种题型应该分配的数量
    const totalTypes = questionTypes.length;  // 用户实际选择的题型总数
    
    // 为每种题型分配精确数量
    if (nonAITypes.length > 0) {
      // 每种非AI题型的基础数量（向上取整，确保每种题型都有题）
      const basePerType = Math.ceil(questionCount / totalTypes);
      
      // 计算非AI题型的目标总数
      let targetNonAITotal = basePerType * nonAITypes.length;
      
      // 如果有AI题型，确保至少留1题给AI题型
      if (hasAITypes && targetNonAITotal >= questionCount) {
        targetNonAITotal = questionCount - 1;
      } else if (targetNonAITotal > questionCount) {
        targetNonAITotal = questionCount;
      }
      
      console.log(`📝 非AI题型目标: ${targetNonAITotal} 题，共 ${nonAITypes.length} 种，每种基础: ${basePerType} 题`);

      // 为每种非AI题型生成题目
      for (const questionType of nonAITypes) {
        const countForThisType = Math.min(basePerType, targetNonAITotal - questions.length);
        for (let i = 0; i < countForThisType && questions.length < targetNonAITotal; i++) {
          const word = getRandomWord(filteredWords, usedWordIds);

          if (!word) continue;

          const question = await createQuestion(word, questionType, words);
          if (question) {
            questions.push(question);
            usedWordIds.push(question.wordId);
          }
        }
      }
      
      // 如果还有剩余空位，继续生成非AI题型题目（均匀分配）
      const remainingNonAI = Math.min(targetNonAITotal - questions.length, questionCount - questions.length);
      for (let i = 0; i < remainingNonAI; i++) {
        const questionType = getRandomQuestionType(nonAITypes);
        const word = getRandomWord(filteredWords, usedWordIds);

        if (!word) break;

        const question = await createQuestion(word, questionType, words);
        if (question) {
          questions.push(question);
          usedWordIds.push(question.wordId);
        }
      }

      console.log(`✅ 非AI题型生成完成: ${questions.length} 题`);
    }

    // 生成AI题型题目（智能句子）
    if (hasAITypes && questions.length < questionCount) {
      const aiTypes: ('sentence-completion' | 'sentence-reordering')[] = [];
      if (questionTypes.includes('sentence-completion')) aiTypes.push('sentence-completion');
      if (questionTypes.includes('sentence-reordering')) aiTypes.push('sentence-reordering');

      // 计算AI题型应该生成的总题数（剩余所有空位）
      const remainingSlots = questionCount - questions.length;
      const totalAIQuestions = remainingSlots;

      // 先生成初始的3题（或少于3题，如果剩余空间不足）
      const initialAIQuestions = Math.min(3, totalAIQuestions);
      console.log(`🚀 先生成 ${initialAIQuestions} 题AI题型，总AI题型: ${totalAIQuestions} 题，剩余将异步补充`);
      
      for (let i = 0; i < initialAIQuestions && questions.length < questionCount; i++) {
        const questionType = getRandomQuestionType(aiTypes);
        const word = getRandomWord(filteredWords, usedWordIds);

        if (!word) break;

        const question = await createQuestion(word, questionType, words);
        if (question) {
          questions.push(question);
          usedWordIds.push(question.wordId);
        }
      }

      console.log(`✅ 初始 ${questions.length} 道题目生成完成`);

      // 计算还需要异步生成多少题
      const remainingAIQuestions = totalAIQuestions - initialAIQuestions;
      if (remainingAIQuestions > 0 && onQuestionsUpdate) {
        console.log(`⏳ 后台继续生成 ${remainingAIQuestions} 题AI题型`);
        
        // 不阻塞，异步生成
        setTimeout(async () => {
          const additionalQuestions: QuizQuestion[] = [];
          
          // 确保异步补充不会超过剩余的总题数
          for (let i = 0; i < remainingAIQuestions; i++) {
            const questionType = getRandomQuestionType(aiTypes);
            const word = getRandomWord(filteredWords, [...usedWordIds, ...additionalQuestions.map(q => q.wordId)]);

            if (!word) break;

            const question = await createQuestion(word, questionType, words);
            if (question) {
              additionalQuestions.push(question);
            }
          }

          console.log(`✅ 后台补充 ${additionalQuestions.length} 题AI题型完成`);
          if (additionalQuestions.length > 0) {
            onQuestionsUpdate(additionalQuestions);
          }
        }, 100);
      }
    } else {
      console.log(`✅ 所有 ${questions.length} 道题目生成完成`);
    }

    return questions;
  }, [wordMemories]);

  // 开始测试
  const handleStartQuiz = useCallback(async (config: QuizConfig) => {
    try {
      // 检查是否需要AI生成（包含句子类型的问题）
      const hasAITypes = config.questionTypes.some(type =>
        type === 'sentence-completion' || type === 'sentence-reordering'
      );

      let progressInterval: NodeJS.Timeout | null = null;

      if (hasAITypes) {
        console.log('🚀 第一步：设置AI生成状态');

        // 使用React的flushSync确保立即渲染
        ReactDOM.flushSync(() => {
          setIsGeneratingAI(true);
          setAiGenerationProgress(0);
          setShowSetup(false);  // 重要：必须设置showSetup为false，否则动画无法显示
        });

        console.log('✅ 第二步：强制React更新完成');

        // 立即开始进度更新，确保动画有内容显示
        progressInterval = setInterval(() => {
          setAiGenerationProgress(prev => {
            const newProgress = prev + Math.random() * 15;
            return newProgress > 85 ? 85 : newProgress;
          });
        }, 300);

        // 确保动画至少显示1500ms - 给用户足够时间看到动画
        console.log('⏳ 第三步：等待动画显示...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('🔮 第四步：开始执行AI交互...');
      }

      // 定义回调函数：处理后台异步生成的新题目
      const handleQuestionsUpdate = (newQuestions: QuizQuestion[]) => {
        console.log(`📥 收到 ${newQuestions.length} 题新题目，更新到session`);
        setQuizSession(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            questions: [...prev.questions, ...newQuestions]
          };
        });
      };

      const questions = await generateQuizQuestions(config, words, handleQuestionsUpdate);

      // 清除进度定时器
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      if (hasAITypes) {
        setIsGeneratingAI(false);
        setAiGenerationProgress(100);
        setTimeout(() => setAiGenerationProgress(0), 500);
      }

      if (questions.length === 0) {
        // TODO: 显示无可用单词的提示
        console.log('无可用单词生成问题');
        if (hasAITypes) {
          setIsGeneratingAI(false);
          setAiGenerationProgress(0);
        }
        return;
      }

      const session: QuizSession = {
        id: Date.now().toString(),
        mode: config.mode,
        grade: config.mode === 'current-range' ? words[0]?.grade : undefined,
        questions,
        results: [],
        startTime: Date.now(),
        isCompleted: false
      };

      setQuizSession(session);
      setCurrentQuestionIndex(0);
      setShowSetup(false);
      setShowResults(false);
    } catch (error) {
      console.error('生成测试问题失败:', error);
      setIsGeneratingAI(false);
      setAiGenerationProgress(0);
      // TODO: 显示错误提示
    }
  }, [words, generateQuizQuestions]);

  // 处理问题回答
  const handleAnswerQuestion = useCallback(async (selectedAnswer: string, timeSpent: number) => {
    if (!quizSession) return;

    const currentQuestion = quizSession.questions[currentQuestionIndex];
    
    // 标准化比较函数：考虑法语特殊字符形态（与WordReorderingCard保持一致）
    const normalizeSentence = (sentence: string) => {
      return sentence
        .normalize('NFD')  // 将字符分解为基本字符和重音符号
        .replace(/[\u0300-\u036f]/g, '')  // 移除重音符号（é -> e, è -> e, ç -> c）
        .replace(/[.,!?;:]/g, '')          // 移除标点符号
        .replace(/\s+/g, ' ')              // 合并多个空格
        .trim()                           // 移除首尾空格
        .toLowerCase();                   // 统一小写比较
    };
    
    const normalizedUserAnswer = normalizeSentence(selectedAnswer);
    const normalizedCorrectAnswer = normalizeSentence(currentQuestion.correctAnswer);
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

    const result: QuizResult = {
      questionId: currentQuestion.id,
      wordId: currentQuestion.wordId,
      isCorrect,
      timeSpent,
      selectedAnswer,
      timestamp: Date.now()
    };

    const newResults = [...quizSession.results, result];
    const newSession = {
      ...quizSession,
      results: newResults
    };

    setQuizSession(newSession);

    // 检查是否完成测试
    if (currentQuestionIndex >= quizSession.questions.length - 1) {
      newSession.isCompleted = true;
      newSession.endTime = Date.now();
      setQuizSession(newSession);
      setShowResults(true);
      
      // 测试完成后保存整个会话数据到数据库
      await quizService.saveQuizData(newSession, newResults);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  }, [quizSession, currentQuestionIndex]);

  // 重新开始测试
  const handleRestartQuiz = useCallback(() => {
    setQuizSession(null);
    setCurrentQuestionIndex(0);
    setShowSetup(true);
    setShowResults(false);
  }, []);

  // 退出测试
  const handleExitQuiz = useCallback(() => {
    setQuizSession(null);
    setCurrentQuestionIndex(0);
    setShowSetup(true);
    setShowResults(false);
  }, []);

  // 加载状态
  if (loading) {
    return <LoadingSkeleton />;
  }

  // 错误状态
  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  // 空状态
  if (words.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="text-gray-500 dark:text-gray-400 mb-4">
          暂无可用单词进行测试
        </div>
        <button 
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          返回学习
        </button>
      </div>
    );
  }

  // AI生成中 - 优先级最高，必须在showSetup和showResults之前判断
  if (isGeneratingAI) {
    return (
      <AIThinkingAnimation
        darkMode={darkMode}
        message={`AI正在智能生成句子... ${Math.round(aiGenerationProgress)}%`}
      />
    );
  }

  // 设置界面
  if (showSetup) {
    return (
      <QuizSetup
        words={words}
        onStartQuiz={handleStartQuiz}
        onCancel={handleExitQuiz}
        darkMode={darkMode}
      />
    );
  }

  // 结果显示界面
  if (showResults && quizSession) {
    // 查找第一个 AI 生成的句子题目，用于确定 wordId 和 questionType
    const firstAISentenceQuestion = quizSession.questions.find(q => 
      q.aiGenerated && (q.type === 'sentence-completion' || q.type === 'sentence-reordering')
    );

    // 从题目ID中提取 questionId（格式为 sentence-{questionId}）
    let questionId: number | null = null;
    if (firstAISentenceQuestion?.id?.startsWith('sentence-')) {
      questionId = parseInt(firstAISentenceQuestion.id.replace('sentence-', ''));
    }

    return (
      <QuizResultScreen
        quizSession={quizSession}
        onRestart={handleRestartQuiz}
        onExit={handleExitQuiz}
        darkMode={darkMode}
        wordId={firstAISentenceQuestion?.wordId}
        questionType={firstAISentenceQuestion?.type === 'sentence-completion' ? 'sentence-completion' : 
                     firstAISentenceQuestion?.type === 'sentence-reordering' ? 'sentence-reordering' : undefined}
      />
    );
  }

  // 测试进行中
  if (quizSession && quizSession.questions[currentQuestionIndex]) {
    const currentQuestion = quizSession.questions[currentQuestionIndex];
    
    // 根据题目类型使用不同的组件
    if (currentQuestion.type === 'sentence-completion' || currentQuestion.type === 'sentence-reordering') {
      // 将QuizQuestion转换为SentenceQuestion格式
      // 从问题文本中提取原句（针对句子重组问题）
      let originalSentence = currentQuestion.question.replace('请重新排列单词组成正确的句子：', '').trim();
      
      // 如果是AI生成的问题，使用正确的原句（从correctAnswer获取）
      if (currentQuestion.aiGenerated && currentQuestion.correctAnswer) {
        originalSentence = currentQuestion.correctAnswer;
      }
      
      // 根据题型正确设置字段
      const sentenceQuestion = {
        id: currentQuestion.id,
        type: currentQuestion.type,
        wordId: currentQuestion.wordId,
        targetWord: currentQuestion.wordId,
        originalSentence: originalSentence,
        modifiedSentence: currentQuestion.type === 'sentence-completion' 
          ? currentQuestion.question.replace('请重新排列单词组成正确的句子：', '').trim()
          : undefined,
        correctAnswer: currentQuestion.correctAnswer,
        options: currentQuestion.type === 'sentence-completion' ? (currentQuestion.options || []) : undefined,
        explanation: currentQuestion.explanation,
        difficulty: 'medium' as const,
        aiGenerated: currentQuestion.aiGenerated || false,
        wordBlocks: currentQuestion.type === 'sentence-reordering' ? (currentQuestion.wordBlocks || []) : undefined,
        shuffledBlocks: currentQuestion.type === 'sentence-reordering' ? (currentQuestion.shuffledBlocks || []) : undefined
      };
      
      return (
        <SentenceQuestionCard
          question={sentenceQuestion}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={quizSession.questions.length}
          onAnswer={handleAnswerQuestion}
          onExit={handleExitQuiz}
          darkMode={darkMode}
        />
      );
    } else {
      return (
        <QuizQuestionCard
          question={currentQuestion}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={quizSession.questions.length}
          onAnswer={handleAnswerQuestion}
          onExit={handleExitQuiz}
          darkMode={darkMode}
        />
      );
    }
  }

  return <EmptyState message="测试初始化失败" />;
}

// 辅助函数：根据模式筛选单词
function filterWordsByMode(mode: QuizModeType, words: WordWithStatus[], wordMemories: WordMemory[]): WordWithStatus[] {
  switch (mode) {
    case 'current-range':
      // 返回当前范围的单词（未掌握的）
      return words.filter(word => !word.isMastered);
    
    case 'previous-errors':
      // 返回上次错误的单词（不依赖掌握状态）
      return getPreviousErrorWords(words, wordMemories);
    
    default:
      // 默认返回所有单词
      return [...words];
  }
}

// 辅助函数：获取随机问题类型
function getRandomQuestionType(availableTypes: QuizType[]): QuizType {
  const randomIndex = Math.floor(Math.random() * availableTypes.length);
  return availableTypes[randomIndex];
}

// 辅助函数：获取随机单词（避免重复）
function getRandomWord(words: WordWithStatus[], usedWordIds: string[]): WordWithStatus | null {
  const availableWords = words.filter(word => !usedWordIds.includes(word.id));
  if (availableWords.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * availableWords.length);
  return availableWords[randomIndex];
}

// 辅助函数：创建问题
async function createQuestion(
  word: WordWithStatus,
  type: QuizType,
  allWords: WordWithStatus[]
): Promise<QuizQuestion | null> {
  const id = `${word.id}-${type}-${Date.now()}`;

  switch (type) {
    case 'chinese-to-french':
      return createChineseToFrenchQuestion(word, allWords, id);

    case 'french-to-chinese':
      return createFrenchToChineseQuestion(word, allWords, id);

    case 'audio-to-chinese':
      return createAudioToChineseQuestion(word, allWords, id);

    case 'audio-to-french':
      return createAudioToFrenchQuestion(word, allWords, id);

    case 'spelling':
      return createSpellingQuestion(word, id);

    case 'sentence-completion':
      return await createSentenceCompletionQuestion(word, id);

    case 'sentence-reordering':
      return await createSentenceReorderingQuestion(word, id);

    default:
      return null;
  }
}

// 创建具体类型问题的辅助函数（实现略）
function createChineseToFrenchQuestion(word: WordWithStatus, allWords: WordWithStatus[], id: string): QuizQuestion {
  // TODO: 实现看中文选外语问题
  return {
    id,
    type: 'chinese-to-french',
    wordId: word.id,
    question: word.chinese,
    correctAnswer: word.french,
    options: generateDistractors(word, allWords, 'french'),
    explanation: `${word.french} - ${word.phonetic}`
  };
}

function createFrenchToChineseQuestion(word: WordWithStatus, allWords: WordWithStatus[], id: string): QuizQuestion {
  // TODO: 实现看外语选中文问题
  return {
    id,
    type: 'french-to-chinese',
    wordId: word.id,
    question: word.french,
    correctAnswer: word.chinese,
    options: generateDistractors(word, allWords, 'chinese'),
    explanation: word.chinese
  };
}

function createAudioToChineseQuestion(word: WordWithStatus, allWords: WordWithStatus[], id: string): QuizQuestion {
  // 随机选择男声或女声
  const voiceType = Math.random() > 0.5 ? 'male' : 'female';
  
  return {
    id,
    type: 'audio-to-chinese',
    wordId: word.id,
    question: '',
    correctAnswer: word.chinese,
    options: generateDistractors(word, allWords, 'chinese'),
    audioUrl: `/audio/grade${word.grade}/${voiceType}/${word.french.replace(/[\s/]/g, '_')}.m4a`,
    explanation: `${word.french} - ${word.chinese}`,
    voiceType
  };
}

function createAudioToFrenchQuestion(word: WordWithStatus, allWords: WordWithStatus[], id: string): QuizQuestion {
  // 随机选择男声或女声
  const voiceType = Math.random() > 0.5 ? 'male' : 'female';
  
  return {
    id,
    type: 'audio-to-french',
    wordId: word.id,
    question: '',
    correctAnswer: word.french,
    options: generateDistractors(word, allWords, 'french'),
    audioUrl: `/audio/grade${word.grade}/${voiceType}/${word.french.replace(/[\s/]/g, '_')}.m4a`,
    explanation: `${word.french} - ${word.chinese}`,
    voiceType
  };
}

function createSpellingQuestion(word: WordWithStatus, id: string): QuizQuestion {
  return {
    id,
    type: 'spelling',
    wordId: word.id,
    question: word.chinese,
    correctAnswer: word.french,
    options: [],
    explanation: `${word.french} - ${word.part_of_speech}`
  };
}

// 辅助函数：生成干扰项
function generateDistractors(correctWord: WordWithStatus, allWords: WordWithStatus[], field: 'french' | 'chinese'): string[] {
  const distractors: string[] = [];
  const correctValue = correctWord[field];
  
  // 相同首字母的单词
  const sameFirstLetter = allWords.filter(w => 
    w.id !== correctWord.id && 
    w[field][0] === correctValue[0]
  );
  
  // 相同词性的单词
  const samePartOfSpeech = allWords.filter(w => 
    w.id !== correctWord.id && 
    w.part_of_speech === correctWord.part_of_speech
  );
  
  // 相同单元的单词
  const sameUnit = allWords.filter(w => 
    w.id !== correctWord.id && 
    w.unit === correctWord.unit
  );
  
  // 合并所有可能的干扰源
  const candidateWords = [...sameFirstLetter, ...samePartOfSpeech, ...sameUnit];
  
  // 随机选择3个干扰项
  while (distractors.length < 3 && candidateWords.length > 0) {
    const randomIndex = Math.floor(Math.random() * candidateWords.length);
    const distractor = candidateWords[randomIndex][field];
    
    if (!distractors.includes(distractor) && distractor !== correctValue) {
      distractors.push(distractor);
    }
    
    candidateWords.splice(randomIndex, 1);
  }
  
  // 如果干扰项不足，随机补充
  while (distractors.length < 3) {
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
    const distractor = randomWord[field];
    
    if (!distractors.includes(distractor) && distractor !== correctValue) {
      distractors.push(distractor);
    }
  }
  
  // 添加正确答案并打乱顺序
  const allOptions = [...distractors, correctValue];
  return shuffleArray(allOptions);
}

// 辅助函数：打乱数组
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// 辅助函数：获取单词记忆数据
function getWordMemory(wordId: string, wordMemories: WordMemory[]): WordMemory | null {
  return wordMemories.find(memory => memory.wordId === wordId) || null;
}

// 辅助函数：获取上次错误单词
function getPreviousErrorWords(words: WordWithStatus[], wordMemories: WordMemory[]): WordWithStatus[] {
  // 获取上次测试中答错的单词
  return words.filter(word => {
    const memory = getWordMemory(word.id, wordMemories);
    // 有记忆数据且最后一次答错
    return memory && memory.lastAttempted && 
           (!memory.lastCorrect || memory.lastAttempted > memory.lastCorrect);
  });
}

// 辅助函数：计算是否已掌握
function calculateIsMastered(memory: WordMemory & { isCorrect: boolean }): boolean {
  // 连续正确3次变成已掌握
  return memory.consecutiveCorrect >= 3;
}

// 辅助函数：创建句子填空问题
async function createSentenceCompletionQuestion(word: WordWithStatus, id: string): Promise<QuizQuestion | null> {
  try {
    // 使用AI服务生成填空补全式问题
    const sentenceQuestion = await aiService.generateSentenceCompletionQuestion(word);

    // 验证数据完整性：填空题必须有 options
    if (!sentenceQuestion.options || sentenceQuestion.options.length === 0) {
      console.error('❌ AI返回的填空题缺少options，生成失败');
      return null;
    }

    return {
      id: id,
      type: 'sentence-completion',
      wordId: word.id,
      question: sentenceQuestion.modifiedSentence || sentenceQuestion.originalSentence,
      correctAnswer: sentenceQuestion.correctAnswer,
      options: sentenceQuestion.options,
      explanation: sentenceQuestion.explanation,
      aiGenerated: true,
      questionId: sentenceQuestion.questionId
    };
  } catch (error) {
    console.error('❌ 生成句子填空问题失败:', error);
    return null;
  }
}



// 辅助函数：创建句子重组问题
async function createSentenceReorderingQuestion(
  word: WordWithStatus,
  id: string,
  excludeIds: number[] = []
): Promise<QuizQuestion | null> {
  try {
    // 使用AI服务生成词卡重组问题
    console.log('🔮 使用AI生成词卡重组题目...');

    // 构建词卡重组请求
    const aiRequest = {
      word: word.id,
      meaning: word.chinese,
      frenchWord: word.french,
      grade: word.grade,
      difficulty: 'medium',
      questionType: 'sentence-reordering',
      excludeQuestionIds: excludeIds
    };

    console.log('📤 发送AI请求:', aiRequest);
    const aiResponse = await apiService.generateSentenceQuestion(aiRequest);

    console.log('📥 收到AI响应:', aiResponse);

    if (aiResponse.success && aiResponse.data && aiResponse.data.original_sentence && aiResponse.data.word_blocks && aiResponse.data.shuffled_blocks) {
      console.log('✅ AI生成词卡重组成功');
      console.log('📝 原句:', aiResponse.data.original_sentence);
      console.log('🧩 单词块:', aiResponse.data.word_blocks);
      console.log('🔀 打乱块:', aiResponse.data.shuffled_blocks);

      // 使用AI生成的内容
      const questionId = aiResponse.data.questionId;
      return {
        id: id,
        type: 'sentence-reordering',
        wordId: word.id,
        question: `请重新排列单词组成正确的句子：${aiResponse.data.shuffled_blocks.join(' ')}`,
        correctAnswer: aiResponse.data.original_sentence,
        options: [
          aiResponse.data.original_sentence,
          aiResponse.data.shuffled_blocks.join(' '),
          shuffleArray([...aiResponse.data.word_blocks]).join(' '),
          shuffleArray([...aiResponse.data.word_blocks]).join(' ')
        ],
        explanation: aiResponse.data.explanation || `正确答案是 "${aiResponse.data.original_sentence}"`,
        aiGenerated: true,
        wordBlocks: aiResponse.data.word_blocks,
        shuffledBlocks: aiResponse.data.shuffled_blocks,
        questionId: questionId // 保存题库ID
      };
    } else {
      console.error('❌ AI返回内容不完整，生成失败');
      return null;
    }
  } catch (error) {
    console.error('❌ AI生成句子重组问题失败:', error);
    return null;
  }
}

