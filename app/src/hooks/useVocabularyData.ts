import { useState, useEffect, useCallback } from 'react';
import { Word, WordWithStatus, Grade } from '../types/vocabulary';

export function useVocabularyData(grade: Grade, learnedWords: Record<string, boolean>, masteredWords: Record<string, boolean>) {
  const [words, setWords] = useState<WordWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载词汇数据
  const loadWords = useCallback(async (targetGrade: Grade) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/data/grade${targetGrade}_words.json`);
      if (!response.ok) {
        throw new Error(`Failed to load grade ${targetGrade} words`);
      }
      
      const rawWords: Word[] = await response.json();
      
      // 转换为带状态的词汇
      const wordsWithStatus: WordWithStatus[] = rawWords.map((word, index) => {
        const wordId = `${targetGrade}-${index}`;
        return {
          ...word,
          id: wordId,
          grade: targetGrade,
          isLearned: learnedWords[wordId] || false,
          isMastered: masteredWords[wordId] || false,
        };
      });
      
      setWords(wordsWithStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [learnedWords, masteredWords]);

  // 当grade、learnedWords或masteredWords变化时重新加载
  useEffect(() => {
    loadWords(grade);
  }, [grade, loadWords]);

  // 获取进度数据
  const getProgressData = useCallback(() => {
    const total = words.length;
    const learned = words.filter(word => word.isLearned).length;
    const mastered = words.filter(word => word.isMastered).length;
    const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0;

    return { total, learned, mastered, percentage };
  }, [words]);

  // 获取下一个要学习的单词
  const getNextWord = useCallback(() => {
    // 优先显示未掌握的单词
    const unmasteredWords = words.filter(word => !word.isMastered);
    if (unmasteredWords.length > 0) {
      // 随机选择一个未掌握的单词
      const randomIndex = Math.floor(Math.random() * unmasteredWords.length);
      return unmasteredWords[randomIndex];
    }
    
    // 如果所有单词都已掌握，随机显示一个
    if (words.length > 0) {
      const randomIndex = Math.floor(Math.random() * words.length);
      return words[randomIndex];
    }
    
    return null;
  }, [words]);

  // 获取所有已掌握的单词
  const getMasteredWords = useCallback(() => {
    return words.filter(word => word.isMastered);
  }, [words]);

  // 获取所有未掌握的单词
  const getUnmasteredWords = useCallback(() => {
    return words.filter(word => !word.isMastered);
  }, [words]);

  // 根据筛选类型获取单词
  const getFilteredWords = useCallback((filter: 'all' | 'mastered' | 'not-mastered') => {
    switch (filter) {
      case 'mastered':
        return getMasteredWords();
      case 'not-mastered':
        return getUnmasteredWords();
      default:
        return words;
    }
  }, [words, getMasteredWords, getUnmasteredWords]);

  // 更新单词状态
  const updateWordStatus = useCallback((wordId: string, isLearned: boolean, isMastered: boolean) => {
    setWords(prevWords => 
      prevWords.map(word => 
        word.id === wordId 
          ? { ...word, isLearned, isMastered }
          : word
      )
    );
  }, []);

  return {
    words,
    loading,
    error,
    getProgressData,
    getNextWord,
    getMasteredWords,
    getUnmasteredWords,
    getFilteredWords,
    updateWordStatus,
    reloadWords: () => loadWords(grade),
  };
}
