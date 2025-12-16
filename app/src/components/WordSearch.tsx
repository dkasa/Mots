import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Word, WordWithStatus, Grade } from '../types/vocabulary';

interface WordSearchProps {
  allWords: WordWithStatus[];
  darkMode?: boolean;
  onSync?: () => void;
  onToggle?: (word: WordWithStatus, newIsMastered: boolean) => void;
}

interface SearchResult {
  word: WordWithStatus;
  grade: string;
}

export function WordSearch({ allWords, darkMode = false, onSync, onToggle }: WordSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedWord, setSelectedWord] = useState<SearchResult | null>(null);
  const [isNotMastered, setIsNotMastered] = useState(true);
  const [audioGender, setAudioGender] = useState<'male' | 'female'>('male');
  const audioRef = useRef<HTMLAudioElement | null>(null);



  // 获取年级信息的函数，使用useCallback避免不必要的重新创建
  const getGradeFromWord = useCallback((word: WordWithStatus): string => {
    const gradeMap: Record<Grade, string> = {
      71: '初一上',
      72: '初一下', 
      81: '初二上',
      82: '初二下',
      91: '初三上',
      92: '初三下'
    };
    return gradeMap[word.grade] || '未知年级';
  }, []);

  // 搜索函数，正确包含所有依赖
  const performSearch = useCallback((term: string) => {
    setIsSearching(true);
    
    const lowerTerm = term.toLowerCase().trim();
    const results: SearchResult[] = [];

    // 优化：单次遍历同时搜索法语和中文
    allWords.forEach(word => {
      let matched = false;
      
      // 搜索法语单词（不区分大小写）
      if (word.french.toLowerCase().includes(lowerTerm)) {
        matched = true;
      }
      // 如果法语没匹配，搜索中文释义（区分大小写）
      else if (word.chinese.includes(term)) {
        matched = true;
      }

      if (matched) {
        results.push({
          word,
          grade: getGradeFromWord(word)
        });
      }
    });

    // 按相关性排序：法语完全匹配优先，然后是开头匹配，最后是包含匹配
    results.sort((a, b) => {
      const aFrench = a.word.french.toLowerCase();
      const bFrench = b.word.french.toLowerCase();
      
      // 完全匹配优先
      if (aFrench === lowerTerm && bFrench !== lowerTerm) return -1;
      if (bFrench === lowerTerm && aFrench !== lowerTerm) return 1;
      
      // 开头匹配优先
      const aStartsWith = aFrench.startsWith(lowerTerm);
      const bStartsWith = bFrench.startsWith(lowerTerm);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      // 长度优先（短词通常更相关）
      return aFrench.length - bFrench.length;
    });

    setSearchResults(results.slice(0, 20)); // 限制结果数量
    setIsSearching(false);
  }, [allWords, getGradeFromWord]);

  // 优化的防抖搜索
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSelectedWord(null);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, performSearch]); // 正确包含 performSearch 依赖

  // 根据法语单词生成文件名
  const getAudioFileName = (frenchWord: string, gender: 'male' | 'female') => {
    let filename = frenchWord.toLowerCase()
      .replace(/'/g, '')
      .replace(/,/g, '_')
      .replace(/ /g, '_');
    // 移除非字母数字字符
    filename = filename.replace(/[^a-z0-9_]/g, '');
    return filename;
  };

  const playAudio = () => {
    if (!selectedWord) return;
    
    const gender = audioGender;
    const nextGender = audioGender === 'male' ? 'female' : 'male';
    
    // 切换性别状态
    setAudioGender(nextGender as 'male' | 'female');

    // 生成音频文件路径 - 指向public目录下的audio文件夹
    const filename = getAudioFileName(selectedWord.word.french, gender);
    const audioPath = `/audio/grade${selectedWord.word.grade}/${gender}/${filename}.mp3`;
    
    // 如果已有音频元素，停止当前播放
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // 创建新的音频元素并播放
    const audio = new Audio(audioPath);
    audioRef.current = audio;
    
    audio.play().catch(error => {
      console.log(`Audio play failed for ${audioPath}:`, error);
      // 如果播放失败，回退到下一个性别
      setTimeout(() => {
        const fallbackFilename = getAudioFileName(selectedWord.word.french, nextGender);
        const fallbackAudioPath = `/audio/grade${selectedWord.word.grade}/${nextGender}/${fallbackFilename}.mp3`;
        const fallbackAudio = new Audio(fallbackAudioPath);
        audioRef.current = fallbackAudio;
        fallbackAudio.play().catch(e => {
          console.log(`Fallback audio also failed for ${fallbackAudioPath}:`, e);
        });
      }, 100);
    });
  };

  const handleWordSelect = (result: SearchResult) => {
    if (result && result.word) {
      setSelectedWord(result);
      setIsNotMastered(!result.word.isMastered);
      // 查看单词详情时触发同步
      if (onSync) {
        console.log('🔍 查单词页面：查看单词详情，触发同步');
        setTimeout(() => {
          onSync();
        }, 300);
      }
    }
  };

  const handleBack = () => {
    setSelectedWord(null);
    // 返回搜索结果时触发同步
    if (onSync) {
      console.log('🔍 查单词页面：返回搜索结果，触发同步');
      setTimeout(() => {
        onSync();
      }, 300);
    }
  };

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // 如果没有单词数据，显示加载状态
  if (allWords.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        darkMode ? 'bg-neutral-dark-100' : 'bg-neutral-50'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className={darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'}>正在加载单词数据...</p>
        </div>
      </div>
    );
  }

  // 如果选中了单词，显示详情
  if (selectedWord) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${
        darkMode ? 'bg-neutral-dark-100' : 'bg-neutral-50'
      }`}>
        {/* 顶部导航 */}
        <div className={`shadow-sm border-b transition-colors duration-300 ${
          darkMode ? 'bg-bg-dark-card border-neutral-dark-300' : 'bg-white border-neutral-200'
        }`}>
          <div className="px-4 py-3 flex items-center">
            <button
              onClick={handleBack}
              className={`p-2 -ml-2 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-neutral-dark-200' : 'hover:bg-neutral-100'
              }`}
            >
              <svg className={`w-5 h-5 transition-colors ${
                darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className={`ml-3 text-lg font-semibold transition-colors ${
              darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
            }`}>单词详情</h1>
          </div>
        </div>

        {/* 单词卡片 */}
        <div className="p-4">
          <div className={`rounded-xl shadow-sm border p-6 transition-colors duration-300 relative ${
            darkMode 
              ? 'bg-bg-dark-card border-neutral-dark-300' 
              : 'bg-white border-neutral-200'
          }`}>
            {/* 右上角语音按钮 */}
            <div className="absolute top-6 right-6 z-10">
              <button
                onClick={playAudio}
                className={`p-2 rounded-full transition-all duration-200 shadow-md ${
                  audioGender === 'male' 
                    ? (darkMode 
                        ? 'bg-info-500 text-white hover:bg-info-600' 
                        : 'bg-info-500 text-white hover:bg-info-600')
                    : (darkMode 
                        ? 'bg-secondary-500 text-white hover:bg-secondary-600' 
                        : 'bg-secondary-500 text-white hover:bg-secondary-600')
                }`}
                title={`播放语音（当前：${audioGender === 'male' ? '男声' : '女声'}，点击切换）`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 a1 1 0 010-1.415z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {/* 词性标签 */}
            <div className="mb-4">
              <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full transition-colors duration-300 ${
                darkMode 
                  ? 'bg-primary-900 text-primary-200' 
                  : 'bg-primary-100 text-primary-700'
              }`}>
                {selectedWord.word.part_of_speech}
              </span>
              <span className={`ml-2 inline-block px-3 py-1 text-sm font-medium rounded-full transition-colors duration-300 ${
                darkMode 
                  ? 'bg-neutral-dark-300 text-neutral-dark-700' 
                  : 'bg-neutral-100 text-neutral-600'
              }`}>
                {selectedWord.grade}
              </span>
              {selectedWord.word.unit && (
                <span className={`ml-2 inline-block px-3 py-1 text-sm font-medium rounded-full transition-colors duration-300 ${
                  darkMode 
                    ? 'bg-neutral-dark-300 text-neutral-dark-700' 
                    : 'bg-neutral-100 text-neutral-600'
                }`}>
                  第{selectedWord.word.unit}单元
                </span>
              )}
            </div>
            
            {/* 法语单词 */}
            <div className="text-center mb-4">
              <h2 className={`text-4xl font-bold leading-tight font-french mb-2 transition-colors duration-300 ${
                darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
              }`}>
                {selectedWord.word.french}
              </h2>
            </div>
            
            {/* 音标 */}
            <div className="text-center mb-6">
              <p className={`text-lg font-phonetic italic transition-colors duration-300 ${
                darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
              }`}>
                {selectedWord.word.phonetic}
              </p>
            </div>
            
            {/* 中文释义 */}
            <div className="text-center mb-6">
              <p className={`text-xl font-chinese transition-colors duration-300 ${
                darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
              }`}>
                {selectedWord.word.chinese}
              </p>
            </div>

            {/* 掌握状态切换 */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
                }`}>
                  掌握状态
                </span>
                <div className={`text-sm transition-colors duration-300 ${
                  isNotMastered 
                    ? 'text-yellow-600' 
                    : 'text-green-600'
                }`}>
                  {isNotMastered ? '未掌握' : '已掌握'}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsNotMastered(true);
                    if (onToggle && selectedWord) {
                      onToggle(selectedWord.word, false);
                    }
                  }}
                  className={`flex-1 py-3 px-4 font-medium rounded-lg transition-all duration-200 ${
                    isNotMastered
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      : darkMode
                        ? 'bg-neutral-dark-300 hover:bg-neutral-dark-400 text-neutral-dark-800'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                  }`}
                >
                  未掌握
                </button>
                <button
                  onClick={() => {
                    setIsNotMastered(false);
                    if (onToggle && selectedWord) {
                      onToggle(selectedWord.word, true);
                    }
                  }}
                  className={`flex-1 py-3 px-4 font-medium rounded-lg transition-all duration-200 ${
                    !isNotMastered
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : darkMode
                        ? 'bg-neutral-dark-300 hover:bg-neutral-dark-400 text-neutral-dark-800'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                  }`}
                >
                  已掌握
                </button>
              </div>
            </div>
          </div>

          {/* 相关单词推荐 */}
          <div className="mt-6">
            <h3 className={`text-lg font-semibold mb-3 transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
            }`}>相关单词</h3>
            <div className="space-y-2">
              {searchResults
                .filter(result => result.word.french !== selectedWord.word.french)
                .slice(0, 5)
                .map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleWordSelect(result)}
                    className={`w-full p-3 rounded-lg border transition-all duration-200 text-left ${
                      darkMode 
                        ? 'bg-bg-dark-card border-neutral-dark-300 hover:border-primary-700 hover:bg-primary-900' 
                        : 'bg-white border-neutral-200 hover:border-primary-300 hover:bg-primary-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`font-medium font-french transition-colors duration-300 ${
                          darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
                        }`}>
                          {result.word.french}
                        </span>
                        <span className={`ml-2 text-sm transition-colors duration-300 ${
                          darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
                        }`}>
                          {result.word.chinese}
                        </span>
                      </div>
                      <span className={`text-xs transition-colors duration-300 ${
                        darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
                      }`}>
                        {result.grade}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? 'bg-neutral-dark-100' : 'bg-neutral-50'
    }`}>
      {/* 搜索头部 */}
      <div className={`shadow-sm border-b transition-colors duration-300 ${
        darkMode ? 'bg-bg-dark-card border-neutral-dark-300' : 'bg-white border-neutral-200'
      }`}>
        <div className="p-4">
          <h1 className={`text-xl font-bold mb-4 transition-colors duration-300 ${
            darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
          }`}>查单词</h1>
          
          {/* 搜索框 */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className={`w-5 h-5 transition-colors duration-300 ${
                darkMode ? 'text-neutral-dark-400' : 'text-neutral-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.slice(0, 50))} // 限制输入长度
              placeholder="输入法语单词或中文释义..."
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-300 ${
                darkMode 
                  ? 'bg-neutral-dark-200 border-neutral-dark-400 text-neutral-dark-800 placeholder-neutral-dark-500' 
                  : 'bg-neutral-50 border-neutral-300'
              }`}
              autoFocus
              maxLength={50}
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSearchResults([]);
                  setSelectedWord(null);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                aria-label="清除搜索"
              >
                <svg className={`w-5 h-5 transition-colors duration-300 ${
                  darkMode ? 'text-neutral-dark-400 hover:text-neutral-dark-600' : 'text-neutral-400 hover:text-neutral-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 搜索结果 */}
      <div className="p-4">
        {isSearching ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : searchTerm && searchResults.length === 0 ? (
          <div className="text-center py-8">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors duration-300 ${
              darkMode ? 'bg-neutral-dark-300' : 'bg-neutral-100'
            }`}>
              <svg className={`w-8 h-8 transition-colors duration-300 ${
                darkMode ? 'text-neutral-dark-400' : 'text-neutral-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className={`text-lg font-medium mb-2 transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
            }`}>未找到相关单词</h3>
            <p className={darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'}>请检查拼写或尝试其他关键词</p>
          </div>
        ) : searchResults.length > 0 ? (
          <div>
            <div className={`mb-3 text-sm transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
            }`}>
              找到 {searchResults.length} 个结果
            </div>
            <div className="space-y-2">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleWordSelect(result)}
                  className={`w-full p-4 rounded-lg border transition-all duration-200 text-left ${
                    darkMode 
                      ? 'bg-bg-dark-card border-neutral-dark-300 hover:border-primary-700 hover:bg-primary-900' 
                      : 'bg-white border-neutral-200 hover:border-primary-300 hover:bg-primary-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-lg font-semibold font-french transition-colors duration-300 ${
                          darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
                        }`}>
                          {result.word.french}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full transition-colors duration-300 ${
                          darkMode 
                            ? 'bg-primary-900 text-primary-200' 
                            : 'bg-primary-100 text-primary-700'
                        }`}>
                          {result.word.part_of_speech}
                        </span>
                      </div>
                      <div className={`text-sm font-phonetic italic mb-2 transition-colors duration-300 ${
                        darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
                      }`}>
                        {result.word.phonetic}
                      </div>
                      <div className={`text-base font-chinese transition-colors duration-300 ${
                        darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
                      }`}>
                        {result.word.chinese}
                      </div>
                    </div>
                    <div className="ml-3 text-right">
                      <div className={`text-xs mb-1 transition-colors duration-300 ${
                        darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
                      }`}>
                        {result.grade}
                      </div>
                      {result.word.unit && (
                        <div className={`text-xs transition-colors duration-300 ${
                          darkMode ? 'text-neutral-dark-400' : 'text-neutral-400'
                        }`}>
                          第{result.word.unit}单元
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* 默认状态 */
          <div className="text-center py-12">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center transition-colors duration-300 ${
              darkMode ? 'bg-primary-900' : 'bg-primary-100'
            }`}>
              <svg className={`w-10 h-10 transition-colors duration-300 ${
                darkMode ? 'text-primary-400' : 'text-primary-600'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className={`text-xl font-semibold mb-2 transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-800' : 'text-neutral-800'
            }`}>查单词</h3>
            <p className={`mb-6 transition-colors duration-300 ${
              darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
            }`}>搜索法语单词或中文释义</p>
            
            {/* 快速搜索建议 */}
            <div className="max-w-md mx-auto">
              <p className={`text-sm mb-3 transition-colors duration-300 ${
                darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
              }`}>热门搜索：</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['bonjour', 'merci', 'au revoir', 'comment'].map((term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setSearchTerm(term);
                      // 使用热门搜索时触发同步
                      if (onSync) {
                        console.log('🔍 查单词页面：使用热门搜索，触发同步');
                        setTimeout(() => {
                          onSync();
                        }, 300);
                      }
                    }}
                    className={`px-3 py-1.5 text-sm border rounded-full transition-colors duration-200 ${
                      darkMode 
                        ? 'bg-bg-dark-card border-neutral-dark-300 hover:bg-primary-900 hover:border-primary-700 hover:text-primary-300' 
                        : 'bg-white border-neutral-300 hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700'
                    }`}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}