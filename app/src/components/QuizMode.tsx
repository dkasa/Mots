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
  const generateQuizQuestions = useCallback(async (config: QuizConfig, words: WordWithStatus[]): Promise<QuizQuestion[]> => {
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

      const question = await createQuestion(word, questionType, words);
      if (question) {
        questions.push(question);
      }
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

      const questions = await generateQuizQuestions(config, words);
      
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
    
    // 标准化比较函数：移除标点、统一大小写、规范空格（与WordReorderingCard保持一致）
    const normalizeSentence = (sentence: string) => {
      return sentence
        .replace(/[.,!?;:]/g, '')  // 移除标点符号
        .replace(/\s+/g, ' ')     // 合并多个空格
        .trim()                   // 移除首尾空格
        .toLowerCase();           // 统一小写比较
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
      
      const sentenceQuestion = {
        id: currentQuestion.id,
        type: currentQuestion.type,
        wordId: currentQuestion.wordId,
        targetWord: currentQuestion.wordId,
        originalSentence: originalSentence,
        modifiedSentence: currentQuestion.question.replace('请重新排列单词组成正确的句子：', '').trim(),
        correctAnswer: currentQuestion.correctAnswer,
        options: currentQuestion.options,
        explanation: currentQuestion.explanation,
        difficulty: 'medium' as const,
        aiGenerated: currentQuestion.aiGenerated || false,
        wordBlocks: currentQuestion.wordBlocks || [],
        shuffledBlocks: currentQuestion.shuffledBlocks || []
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
async function createQuestion(word: WordWithStatus, type: QuizType, allWords: WordWithStatus[]): Promise<QuizQuestion | null> {
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

// 辅助函数：创建句子填空问题（方案1）
async function createSentenceCompletionQuestion(word: WordWithStatus, id: string): Promise<QuizQuestion | null> {
  try {
    // 使用AI服务生成填空补全式问题
    const sentenceQuestion = await aiService.generateSentenceCompletionQuestion(word);

    return {
      id,
      type: 'sentence-completion',
      wordId: word.id,
      question: `选择正确的单词填入空白处："${sentenceQuestion.modifiedSentence}"`,
      correctAnswer: sentenceQuestion.correctAnswer,
      options: sentenceQuestion.options,
      explanation: sentenceQuestion.explanation
    };
  } catch (error) {
    console.error('生成句子填空问题失败:', error);
    // 备用方案：简单的填空问题
    const sentences = [
      `Je ______ ${word.french}.`,
      `Il/Elle ______ ${word.french}.`,
      `Nous ______ ${word.french}.`,
      `Vous ______ ${word.french}.`,
      `Ils/Elles ______ ${word.french}.`
    ];
    
    const randomSentence = sentences[Math.floor(Math.random() * sentences.length)];
    
    // 生成动词être的变位选项
    const etreConjugations = ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'];
    const shuffledOptions = shuffleArray(etreConjugations).slice(0, 4);
    
    // 根据人称确定正确答案
    let correctAnswer = 'suis';
    if (randomSentence.startsWith('Il/Elle') || randomSentence.startsWith('Il') || randomSentence.startsWith('Elle')) {
      correctAnswer = 'est';
    } else if (randomSentence.startsWith('Nous')) {
      correctAnswer = 'sommes';
    } else if (randomSentence.startsWith('Vous')) {
      correctAnswer = 'êtes';
    } else if (randomSentence.startsWith('Ils/Elles') || randomSentence.startsWith('Ils') || randomSentence.startsWith('Elles')) {
      correctAnswer = 'sont';
    }
    
    // 确保正确答案在选项中
    if (!shuffledOptions.includes(correctAnswer)) {
      shuffledOptions[0] = correctAnswer;
    }

    return {
      id,
      type: 'sentence-completion',
      wordId: word.id,
      question: `选择正确的单词填入空白处："${randomSentence}"`,
      correctAnswer: correctAnswer,
      options: shuffledOptions,
      explanation: `正确答案是 "${correctAnswer}"，这是动词"être"（是）的变位，句子意思是"${word.chinese}"`
    };
  }
}

// 辅助函数：创建句子重组问题
async function createSentenceReorderingQuestion(word: WordWithStatus, id: string): Promise<QuizQuestion | null> {
  try {
    // 使用AI服务生成词卡重组问题 - 与句子填空使用相同的服务
    console.log('🔮 使用AI生成词卡重组题目...');
    
    // 构建词卡重组请求
    const aiRequest = {
      word: word.id,
      meaning: word.chinese,
      frenchWord: word.french,
      grade: word.grade,
      difficulty: 'medium',
      questionType: 'reordering'
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
      return {
        id,
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
        shuffledBlocks: aiResponse.data.shuffled_blocks
      };
    } else {
      console.warn('❌ AI返回内容不完整，使用本地生成');
      throw new Error('AI返回内容不完整');
    }
  } catch (error) {
    console.warn('❌ AI生成失败，使用本地生成:', error);
    
    // 回退到本地生成
    const sentenceTemplates = [
      `Je mange une ${word.french}`,  // 我吃一个苹果
      `Il aime les ${word.french}`,  // 他喜欢苹果（去掉/Elle避免格式问题）
      `Nous avons des ${word.french}`,  // 我们有一些苹果
      `Vous voulez du ${word.french}`,  // 你们想要一些苹果
      `Ils préfèrent la ${word.french}`  // 他们喜欢苹果（去掉/Elles避免格式问题）
    ];
    
    const randomTemplate = sentenceTemplates[Math.floor(Math.random() * sentenceTemplates.length)];
    const words = randomTemplate.split(' ');
    const shuffledWords = shuffleArray([...words]);
    
    // 生成干扰选项
    const options = [
      randomTemplate,  // 正确选项
      shuffleArray([...words]).join(' '),  // 随机打乱
      shuffleArray([...words]).join(' '),  // 随机打乱
      shuffleArray([...words]).join(' ')   // 随机打乱
    ];
    
    // 确保选项唯一
    const uniqueOptions = [...new Set(options)];
    while (uniqueOptions.length < 4) {
      const newOption = shuffleArray([...words]).join(' ');
      if (!uniqueOptions.includes(newOption)) {
        uniqueOptions.push(newOption);
      }
    }
    
    return {
      id,
      type: 'sentence-reordering',
      wordId: word.id,
      question: `请重新排列单词组成正确的句子：${shuffledWords.join(' ')}`,
      correctAnswer: randomTemplate,
      options: shuffleArray(uniqueOptions),
      explanation: `正确答案是 "${randomTemplate}"，意思是"${getSentenceMeaning(randomTemplate, word.chinese)}"`,
      aiGenerated: false
    };
  }
}

// 辅助函数：获取句子意思
function getSentenceMeaning(sentence: string, wordMeaning: string): string {
  const sentenceMeanings: {[key: string]: string} = {
    'Je mange une': '我吃一个',
    'Il/Elle aime les': '他/她喜欢',
    'Nous avons des': '我们有一些',
    'Vous voulez du': '你们想要一些',
    'Ils/Elles préfèrent la': '他们/她们更喜欢'
  };
  
  const prefix = sentence.split(' ').slice(0, -1).join(' ');
  return sentenceMeanings[prefix] ? `${sentenceMeanings[prefix]}${wordMeaning}` : `包含${wordMeaning}的句子`;
}