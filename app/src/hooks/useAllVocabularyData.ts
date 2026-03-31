import { useState, useEffect, useCallback } from 'react';
import { Word, WordWithStatus, Grade } from '../types/vocabulary';

export function useAllVocabularyData(
  learnedWords: Record<string, boolean>, 
  masteredWords: Record<string, boolean>
) {
  const [allWords, setAllWords] = useState<WordWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载所有年级的词汇数据
  const loadAllWords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const grades: Grade[] = [71, 72, 81, 82, 91, 92];
      const allWordsWithStatus: WordWithStatus[] = [];

      for (const grade of grades) {
        try {
          const response = await fetch(`/data/grade${grade}_words.json`);
          if (!response.ok) {
            console.warn(`Failed to load grade ${grade} words: ${response.status} ${response.statusText}`);
            continue;
          }

          // Check if response is valid JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.warn(`Invalid content type for grade ${grade}: ${contentType}. Response starts with: ${text.substring(0, 100)}`);
            continue;
          }

          const rawWords: Word[] = await response.json();

          // 转换为带状态的单词
          const wordsWithStatus: WordWithStatus[] = rawWords.map((word, index) => {
            const wordId = `${grade}-${index}`;
            return {
              ...word,
              id: wordId,
              grade: grade,
              isLearned: learnedWords[wordId] || false,
              isMastered: masteredWords[wordId] || false,
            };
          });

          allWordsWithStatus.push(...wordsWithStatus);
        } catch (err) {
          console.warn(`Error loading grade ${grade}:`, err);
        }
      }

      // 加载 DELF A2 单词
      try {
        const wordsResponse = await fetch(`/data/delf_a2_words.json`);
        if (wordsResponse.ok) {
          const rawWords: Word[] = await wordsResponse.json();
          const wordsWithStatus: WordWithStatus[] = rawWords.map((word, index) => {
            const wordId = `${93}-${index}`;
            return {
              ...word,
              id: wordId,
              grade: 93,
              isLearned: learnedWords[wordId] || false,
              isMastered: masteredWords[wordId] || false,
            };
          });
          allWordsWithStatus.push(...wordsWithStatus);
        }
      } catch (err) {
        console.warn(`Error loading DELF A2 words:`, err);
      }

      // 加载 DELF A2 短语
      try {
        const phrasesResponse = await fetch(`/data/delf_a2_phrases.json`);
        if (phrasesResponse.ok) {
          const rawWords: Word[] = await phrasesResponse.json();
          const wordsWithStatus: WordWithStatus[] = rawWords.map((word, index) => {
            const wordId = `${94}-${index}`;
            return {
              ...word,
              id: wordId,
              grade: 94,
              isLearned: learnedWords[wordId] || false,
              isMastered: masteredWords[wordId] || false,
            };
          });
          allWordsWithStatus.push(...wordsWithStatus);
        }
      } catch (err) {
        console.warn(`Error loading DELF A2 phrases:`, err);
      }

      setAllWords(allWordsWithStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [learnedWords, masteredWords]);

  // 初始加载
  useEffect(() => {
    loadAllWords();
  }, [loadAllWords]);

  // 优化：当学习状态变化时更新单词状态，避免不必要的重新渲染
  useEffect(() => {
    setAllWords(prevWords => {
      // 检查是否有实际变化
      let hasChanges = false;
      const updatedWords = prevWords.map(word => {
        const wordId = word.id;
        const newIsLearned = learnedWords[wordId] || false;
        const newIsMastered = masteredWords[wordId] || false;
        
        if (word.isLearned !== newIsLearned || word.isMastered !== newIsMastered) {
          hasChanges = true;
          return {
            ...word,
            isLearned: newIsLearned,
            isMastered: newIsMastered,
          };
        }
        return word;
      });
      
      return hasChanges ? updatedWords : prevWords;
    });
  }, [learnedWords, masteredWords]);

  return {
    allWords,
    loading,
    error,
    reloadWords: loadAllWords,
  };
}