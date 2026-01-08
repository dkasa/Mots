import React, { useState, useEffect, useCallback } from 'react';
import { WordWithStatus } from '../types/vocabulary';
import { QuizQuestion, QuizSession, QuizResult, QuizConfig, QuizMode as QuizModeType, QuizType, WordMemory } from '../types/quiz';
import { QuizQuestionCard } from './QuizQuestionCard';
import { QuizResultScreen } from './QuizResultScreen';
import { QuizSetup } from './QuizSetup';
import { LoadingSkeleton, ErrorState, EmptyState } from './LoadingStates';
import { quizService } from '../services/quizService';

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
  const generateQuizQuestions = useCallback((config: QuizConfig, words: WordWithStatus[]): QuizQuestion[] => {
    // 根据模式筛选单词
    const filteredWords = filterWordsByMode(config.mode, words, wordMemories);
    
    if (filteredWords.length === 0) {
      return [];
    }

    const questions: QuizQuestion[] = [];
    const questionCount = Math.min(config.questionCount, filteredWords.length * 2);

    for (let i = 0; i < questionCount; i++) {
      const questionType = getRandomQuestionType(config.questionTypes);
      const word = getRandomWord(filteredWords, questions.map(q => q.wordId));
      
      if (!word) continue;

      const question = createQuestion(word, questionType, words);
      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }, [wordMemories]);

  // 开始测试
  const handleStartQuiz = useCallback((config: QuizConfig) => {
    const questions = generateQuizQuestions(config, words);
    
    if (questions.length === 0) {
      // TODO: 显示无可用单词的提示
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
  }, [words, generateQuizQuestions]);

  // 处理问题回答
  const handleAnswerQuestion = useCallback(async (selectedAnswer: string, timeSpent: number) => {
    if (!quizSession) return;

    const currentQuestion = quizSession.questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

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
    return (
      <QuizResultScreen
        quizSession={quizSession}
        onRestart={handleRestartQuiz}
        onExit={handleExitQuiz}
        darkMode={darkMode}
      />
    );
  }

  // 测试进行中
  if (quizSession && quizSession.questions[currentQuestionIndex]) {
    return (
      <QuizQuestionCard
        question={quizSession.questions[currentQuestionIndex]}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={quizSession.questions.length}
        onAnswer={handleAnswerQuestion}
        onExit={handleExitQuiz}
        darkMode={darkMode}
      />
    );
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
      // 返回上次错误的单词（且未掌握的）
      return getPreviousErrorWords(words, wordMemories).filter(word => !word.isMastered);
    
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
function createQuestion(word: WordWithStatus, type: QuizType, allWords: WordWithStatus[]): QuizQuestion | null {
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
  // TODO: 实现拼写问题
  return {
    id,
    type: 'spelling',
    wordId: word.id,
    question: word.chinese,
    correctAnswer: word.french,
    options: [],
    explanation: `${word.french} - ${word.phonetic}`
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