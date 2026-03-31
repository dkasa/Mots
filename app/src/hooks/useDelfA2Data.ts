import { useState, useEffect, useCallback } from 'react';
import { Word, WordWithStatus } from '../types/vocabulary';

export type DelfWordType = 'words' | 'phrases';

export function useDelfA2Data(
  wordType: DelfWordType = 'words',
  initialLearnedWords: Record<string, boolean> = {},
  initialMasteredWords: Record<string, boolean> = {}
) {
  const [words, setWords] = useState<WordWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载 DELF A2 词汇数据
  const loadWords = useCallback(async (type: DelfWordType) => {
    setLoading(true);
    setError(null);

    try {
      const fileName = type === 'words' ? 'delf_a2_words.json' : 'delf_a2_phrases.json';
      const response = await fetch(`/data/${fileName}`);

      if (!response.ok) {
        throw new Error(`Failed to load ${fileName}`);
      }

      const rawWords: Word[] = await response.json();

      // 转换为带状态的单词
      const wordsWithStatus: WordWithStatus[] = rawWords.map((word, index) => {
        const wordId = `delf-${type}-${index}`;
        return {
          ...word,
          id: wordId,
          grade: (type === 'words' ? 93 : 94) as any,
          isLearned: initialLearnedWords[wordId] || false,
          isMastered: initialMasteredWords[wordId] || false,
        };
      });

      setWords(wordsWithStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [initialLearnedWords, initialMasteredWords]);

  // 初始加载
  useEffect(() => {
    loadWords(wordType);
  }, [wordType, loadWords]);

  // 当学习状态变化时更新单词状态
  useEffect(() => {
    setWords(prevWords => {
      const updatedWords = prevWords.map(word => {
        const wordId = word.id;
        const newIsLearned = initialLearnedWords[wordId] || false;
        const newIsMastered = initialMasteredWords[wordId] || false;

        if (word.isLearned !== newIsLearned || word.isMastered !== newIsMastered) {
          return {
            ...word,
            isLearned: newIsLearned,
            isMastered: newIsMastered,
          };
        }
        return word;
      });

      return updatedWords;
    });
  }, [initialLearnedWords, initialMasteredWords]);

  // 获取进度数据
  const getProgressData = useCallback(() => {
    const total = words.length;
    const learned = words.filter(word => word.isLearned).length;
    const mastered = words.filter(word => word.isMastered).length;
    const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0;

    return { total, learned, mastered, percentage };
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

  // 按分类获取单词
  const getWordsByCategory = useCallback((category: string) => {
    return words.filter(word => word.category === category);
  }, [words]);

  // 获取所有分类
  const getCategories = useCallback(() => {
    const categories = new Set(words.map(word => word.category).filter(Boolean) as string[]);
    return Array.from(categories);
  }, [words]);

  // 更新单词状态
  const updateWordStatus = useCallback((wordId: string, isLearned: boolean, isMastered: boolean) => {
    setWords(prevWords => {
      const wordIndex = prevWords.findIndex(word => word.id === wordId);
      if (wordIndex === -1) return prevWords;

      const newWords = [...prevWords];
      newWords[wordIndex] = { ...newWords[wordIndex], isLearned, isMastered };

      return newWords;
    });
  }, []);

  return {
    words,
    loading,
    error,
    getProgressData,
    getMasteredWords,
    getUnmasteredWords,
    getFilteredWords,
    getWordsByCategory,
    getCategories,
    updateWordStatus,
    reloadWords: () => loadWords(wordType),
  };
}
