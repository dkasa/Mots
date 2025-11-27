import { useState, useEffect, useCallback } from 'react';
import { Word, WordWithStatus, Grade, SelectionMode, UnitRange, CountSelection } from '../types/vocabulary';

export function useVocabularyData(
  grade: Grade, 
  learnedWords: Record<string, boolean>, 
  masteredWords: Record<string, boolean>,
  selectionMode: SelectionMode = 'grade-all',
  unitRange?: UnitRange,
  countSelection?: CountSelection
) {
  const [words, setWords] = useState<WordWithStatus[]>([]);
  const [rawWords, setRawWords] = useState<Word[]>([]); // 保存原始加载的单词
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]); // 保存随机选择的单词ID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载词汇数据（只负责加载原始数据）
  const loadWords = useCallback(async (targetGrade: Grade) => {
    console.log('=== loadWords 开始 ===', 'targetGrade:', targetGrade);
    
    // 临时清除缓存，强制重新加载
    if (targetGrade === 81) {
      console.log('清除 grade 81 的缓存');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/data/grade${targetGrade}_words.json`);
      if (!response.ok) {
        throw new Error(`Failed to load grade ${targetGrade} words`);
      }
      
      const rawWords: Word[] = await response.json();
      console.log('请求URL:', `/data/grade${targetGrade}_words.json`);
      console.log('从服务器加载的原始数据前3个:', rawWords.slice(0, 3).map(w => ({ french: w.french, unit: w.unit, allKeys: Object.keys(w) })));
      console.log('第一个单词的完整内容:', rawWords[0]);
      
      // 保存原始单词数据
      setRawWords(rawWords);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [learnedWords, masteredWords]);

  // 应用筛选逻辑
  const applyFiltering = useCallback(() => {
    console.log('=== applyFiltering 调用 ===');
    console.log('rawWords.length:', rawWords.length);
    console.log('selectionMode:', selectionMode);
    console.log('unitRange:', unitRange);
    
    if (rawWords.length === 0) return;

    // 首先将原始单词转换为带状态的单词
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

    let filteredWords = wordsWithStatus;
    
    if (selectionMode === 'grade-unit' && unitRange) {
      console.log('执行单元过滤...');
      console.log('前3个原始单词的unit:', wordsWithStatus.slice(0, 3).map(w => ({ id: w.id, unit: w.unit, french: w.french, hasUnit: 'unit' in w })));
      
      filteredWords = wordsWithStatus.filter(word => {
        const hasUnit = word.unit !== undefined && word.unit !== null;
        const inRange = hasUnit && word.unit >= unitRange.startUnit && word.unit <= unitRange.endUnit;
        if (!hasUnit && wordsWithStatus.indexOf(word) < 5) {
          console.log(`单词 ${word.id} 没有 unit 字段或为空:`, word);
        }
        return inRange;
      });
      
      console.log('过滤后单词数:', filteredWords.length);
      if (filteredWords.length > 0) {
        console.log('前3个过滤后单词的unit:', filteredWords.slice(0, 3).map(w => ({ id: w.id, unit: w.unit, french: w.french })));
      }
    } else if (selectionMode === 'grade-count' && countSelection) {
      // 对于随机选择，只在第一次或数量改变时重新选择
      if (selectedWordIds.length !== countSelection.count) {
        // 优先从未掌握的单词中随机选择
        const unmasteredWords = wordsWithStatus.filter(word => !word.isMastered);
        const masteredWords = wordsWithStatus.filter(word => word.isMastered);
        
        let selectedWords: WordWithStatus[] = [];
        
        if (unmasteredWords.length >= countSelection.count) {
          // 未掌握单词足够，全部从未掌握中选择
          const shuffledUnmastered = [...unmasteredWords].sort(() => Math.random() - 0.5);
          selectedWords = shuffledUnmastered.slice(0, countSelection.count);
        } else {
          // 未掌握单词不够，先选所有未掌握的，再从已掌握中补充
          selectedWords = [...unmasteredWords];
          const remainingCount = countSelection.count - unmasteredWords.length;
          const shuffledMastered = [...masteredWords].sort(() => Math.random() - 0.5);
          selectedWords = selectedWords.concat(shuffledMastered.slice(0, remainingCount));
        }
        
        filteredWords = selectedWords;
        setSelectedWordIds(selectedWords.map(w => w.id));
      } else {
        // 保持原有的单词ID列表，只更新状态
        filteredWords = wordsWithStatus.filter(word => selectedWordIds.includes(word.id));
      }
    }
    
    setWords(filteredWords);
  }, [rawWords, selectionMode, unitRange, countSelection, selectedWordIds, grade, learnedWords, masteredWords]);

  // 当年级改变时重新加载数据
  useEffect(() => {
    console.log('年级改变，重新加载数据，grade:', grade);
    loadWords(grade);
  }, [grade, loadWords]);

  // 当原始数据加载完成或筛选参数改变时应用筛选
  useEffect(() => {
    applyFiltering();
  }, [applyFiltering]);

  // 当learnedWords或masteredWords变化时，重新应用筛选
  useEffect(() => {
    if (rawWords.length > 0) {
      applyFiltering();
    }
  }, [learnedWords, masteredWords, rawWords.length, applyFiltering]);

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