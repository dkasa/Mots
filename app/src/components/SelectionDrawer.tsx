import React, { useState, useRef, useEffect } from 'react';
import { SelectionMode, CourseSelection, CountSelection } from '../types/vocabulary';


interface SelectionDrawerProps {
  currentMode: SelectionMode;
  courseSelection?: CourseSelection;
  countSelection?: CountSelection;
  onModeChange: (mode: SelectionMode) => void;
  onCourseSelectionChange: (selection: CourseSelection) => void;
  onCountSelectionChange: (selection: CountSelection) => void;
  onResetWords: () => void;
  darkMode: boolean;
}

export function SelectionDrawer({
  currentMode,
  courseSelection = { selectedUnits: [1], selectedLessons: ["1"] },
  countSelection = { count: 20 },
  onModeChange,
  onCourseSelectionChange,
  onCountSelectionChange,
  onResetWords,
  darkMode,
}: SelectionDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const modes = [
    { value: 'grade-all' as SelectionMode, label: '全部', desc: '学期所有单词' },
    { value: 'grade-course' as SelectionMode, label: '课程', desc: '选择课程范围' },
    { value: 'grade-count' as SelectionMode, label: '数量', desc: '随机选择' },
  ];

  const countOptions = [
    { value: 10 as CountSelection['count'], label: '10' },
    { value: 20 as CountSelection['count'], label: '20' },
    { value: 50 as CountSelection['count'], label: '50' },
    { value: 100 as CountSelection['count'], label: '100' },
  ];

  // 获取当前模式的描述文本
  const getCurrentModeText = () => {
    const mode = modes.find(m => m.value === currentMode);
    if (!mode) return '';
    
    switch (currentMode) {
      case 'grade-all':
        return mode.desc;
      case 'grade-course':
        return `单元 ${courseSelection.selectedUnits.join(',')} 课次 ${courseSelection.selectedLessons.join(',')}`;
      case 'grade-count':
        return `随机 ${countSelection.count} 个`;
      default:
        return mode.desc;
    }
  };

  // 计算抽屉内容高度
  useEffect(() => {
    if (contentRef.current && isOpen) {
      const contentHeight = contentRef.current.scrollHeight;
      setDrawerHeight(contentHeight);
    } else {
      setDrawerHeight(0);
    }
  }, [isOpen, currentMode, courseSelection, countSelection]);

  // 切换抽屉状态
  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  // 处理模式选择
  const handleModeSelect = (mode: SelectionMode) => {
    onModeChange(mode);
    // 如果选择的是"全部"，直接关闭抽屉
    if (mode === 'grade-all') {
      setIsOpen(false);
    }
  };

  // 处理重置按钮点击
  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡到父按钮
    setShowResetConfirm(true);
  };

  // 确认重置
  const handleResetConfirm = () => {
    onResetWords();
    setShowResetConfirm(false);
    setIsOpen(false);
  };

  // 取消重置
  const handleResetCancel = () => {
    setShowResetConfirm(false);
  };

  return (
    <div className="mx-5 mb-4">
      {/* 触发按钮 */}
      <button
        onClick={toggleDrawer}
        className={`w-full rounded-lg border p-4 text-left transition-colors duration-200 shadow-sm ${
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
              }`}>单词选择</div>
              <div className={`text-xs ${
                darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
              }`}>{getCurrentModeText()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${
              darkMode 
                ? 'text-neutral-dark-400 bg-neutral-dark-200' 
                : 'text-neutral-400 bg-neutral-100'
            }`}>
              {modes.find(m => m.value === currentMode)?.label}
            </span>
            {/* 重置按钮 */}
            <button
              onClick={handleResetClick}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                darkMode 
                  ? 'text-neutral-dark-400 hover:bg-neutral-dark-200 hover:text-neutral-dark-600' 
                  : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
              }`}
              title="重置当前范围内的单词状态"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </button>

      {/* 抽屉内容 */}
      <div
        ref={drawerRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: `${drawerHeight}px` }}
      >
        <div ref={contentRef} className="mt-2">
          {/* 模式选择 */}
          <div className={`rounded-lg border p-3 ${
            darkMode 
              ? 'bg-neutral-dark-100 border-neutral-dark-300' 
              : 'bg-white border-neutral-200'
          }`}>
            <div className="grid grid-cols-3 gap-2">
              {modes.map((mode) => {
                const isActive = currentMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    onClick={() => handleModeSelect(mode.value)}
                    className={`
                      relative py-3 px-2 text-sm font-medium rounded-md transition-all duration-200
                      ${isActive 
                        ? 'bg-primary-500 text-white shadow-sm' 
                        : darkMode 
                          ? 'text-neutral-dark-600 hover:bg-neutral-dark-200'
                          : 'text-neutral-600 hover:bg-neutral-50'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{mode.label}</span>
                      <span className={`text-xs mt-0.5 ${
                        isActive ? 'text-primary-100' : 
                        darkMode ? 'text-neutral-dark-400' : 'text-neutral-400'
                      }`}>
                        {mode.desc}
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

          {/* 选项面板 */}
          {currentMode !== 'grade-all' && (
            <div className={`mt-2 rounded-lg border p-4 ${
              darkMode 
                ? 'bg-neutral-dark-50 border-neutral-dark-300' 
                : 'bg-neutral-50 border-neutral-200'
            }`}>
              {currentMode === 'grade-course' && (
                <div className="space-y-4">
                  {/* 单元选择 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-neutral-dark-700' : 'text-neutral-700'
                      }`}>选择单元</label>
                      <span className={`text-xs px-2 py-1 rounded ${
                        darkMode 
                          ? 'text-neutral-dark-500 bg-neutral-dark-100' 
                          : 'text-neutral-500 bg-white'
                      }`}>
                        已选 {courseSelection.selectedUnits.length} 个
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map(unit => {
                        const isSelected = courseSelection.selectedUnits.includes(unit);
                        return (
                          <button
                            key={unit}
                            onClick={() => {
                              const newSelectedUnits = isSelected
                                ? courseSelection.selectedUnits.filter(u => u !== unit)
                                : [...courseSelection.selectedUnits, unit];
                              
                              // 确保至少选择一个单元
                              if (newSelectedUnits.length === 0) {
                                newSelectedUnits.push(unit);
                              }
                              
                              onCourseSelectionChange({
                                ...courseSelection,
                                selectedUnits: newSelectedUnits.sort((a, b) => a - b)
                              });
                            }}
                            className={`py-2.5 px-3 text-sm font-medium rounded-lg transition-all duration-200 border ${
                              isSelected
                                ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                                : darkMode
                                  ? 'bg-neutral-dark-100 text-neutral-dark-600 border-neutral-dark-300 hover:border-neutral-dark-400 hover:bg-neutral-dark-200'
                                  : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                            }`}
                          >
                            U {unit}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* 课次选择 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-neutral-dark-700' : 'text-neutral-700'
                      }`}>选择课次</label>
                      <span className={`text-xs px-2 py-1 rounded ${
                        darkMode 
                          ? 'text-neutral-dark-500 bg-neutral-dark-100' 
                          : 'text-neutral-500 bg-white'
                      }`}>
                        已选 {courseSelection.selectedLessons.length} 个
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {["1", "2", "Atelier"].map(lesson => {
                        const isSelected = courseSelection.selectedLessons.includes(lesson);
                        return (
                          <button
                            key={lesson}
                            onClick={() => {
                              const newSelectedLessons = isSelected
                                ? courseSelection.selectedLessons.filter(l => l !== lesson)
                                : [...courseSelection.selectedLessons, lesson];
                              
                              // 确保至少选择一个课次
                              if (newSelectedLessons.length === 0) {
                                newSelectedLessons.push(lesson);
                              }
                              
                              onCourseSelectionChange({
                                ...courseSelection,
                                selectedLessons: newSelectedLessons
                              });
                            }}
                            className={`py-2.5 px-3 text-sm font-medium rounded-lg transition-all duration-200 border ${
                              isSelected
                                ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                                : darkMode
                                  ? 'bg-neutral-dark-100 text-neutral-dark-600 border-neutral-dark-300 hover:border-neutral-dark-400 hover:bg-neutral-dark-200'
                                  : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                            }`}
                          >
                            {lesson === "Atelier" ? "Atelier" : `Leçon ${lesson}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {currentMode === 'grade-count' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={`text-sm font-medium ${
                      darkMode ? 'text-neutral-dark-700' : 'text-neutral-700'
                    }`}>单词数量</label>
                    <span className={`text-xs px-2 py-1 rounded ${
                      darkMode 
                        ? 'text-neutral-dark-500 bg-neutral-dark-100' 
                        : 'text-neutral-500 bg-white'
                    }`}>
                      随机选择
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {countOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => onCountSelectionChange({ count: option.value })}
                        className={`
                          py-2.5 px-3 text-sm font-medium rounded-lg transition-all duration-200 border
                          ${countSelection.count === option.value
                            ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                            : darkMode
                              ? 'bg-neutral-dark-100 text-neutral-dark-600 border-neutral-dark-300 hover:border-neutral-dark-400 hover:bg-neutral-dark-200'
                              : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                          }
                        `}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className={`text-xs text-center ${
                    darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
                  }`}>
                    每次随机选择 {countSelection.count} 个单词
                  </div>
                </div>
              )}

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

          )}
        </div>
      </div>

      {/* 重置确认对话框 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className={`mx-4 w-full max-w-sm rounded-lg p-6 shadow-lg ${
            darkMode 
              ? 'bg-neutral-dark-100 border-neutral-dark-300' 
              : 'bg-white border-neutral-200'
          } border`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                darkMode ? 'bg-warning-dark-100' : 'bg-warning-100'
              }`}>
                <svg 
                  className={`w-5 h-5 ${darkMode ? 'text-warning-dark-600' : 'text-warning-600'}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.354 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${
                  darkMode ? 'text-neutral-dark-900' : 'text-neutral-900'
                }`}>确认重置</h3>
                <p className={`text-sm ${
                  darkMode ? 'text-neutral-dark-600' : 'text-neutral-600'
                }`}>这将重置当前选择范围内的所有单词为未掌握状态，确定要继续吗？</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleResetCancel}
                className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-colors duration-200 border ${
                  darkMode 
                    ? 'bg-neutral-dark-100 text-neutral-dark-600 border-neutral-dark-300 hover:bg-neutral-dark-200' 
                    : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                取消
              </button>
              <button
                onClick={handleResetConfirm}
                className="flex-1 py-2.5 px-4 bg-warning-500 text-white text-sm font-medium rounded-lg hover:bg-warning-600 transition-colors duration-200 shadow-sm"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}