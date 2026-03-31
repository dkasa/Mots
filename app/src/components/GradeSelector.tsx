import React, { useState, useRef, useEffect } from 'react';
import { Grade } from '../types/vocabulary';

interface GradeSelectorProps {
  currentGrade: Grade;
  onGradeChange: (grade: Grade) => void;
  darkMode?: boolean;
}

export function GradeSelector({ currentGrade, onGradeChange, darkMode = false }: GradeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const grades = [
    { value: 71 as any, label: '初一上', short: '七上' },
    { value: 72 as any, label: '初一下', short: '七下' },
    { value: 81 as any, label: '初二上', short: '八上' },
    { value: 82 as any, label: '初二下', short: '八下' },
    { value: 91 as any, label: '初三上', short: '九上' },
    { value: 92 as any, label: '初三下', short: '九下' },
    { value: 93 as any, label: 'DELF A2 单词', short: 'A2 单词' },
    { value: 94 as any, label: 'DELF A2 短语', short: 'A2 短语' },
  ];

  const currentGradeInfo = grades.find(g => g.value === currentGrade);

  // 计算抽屉内容高度
  useEffect(() => {
    if (contentRef.current && isOpen) {
      const contentHeight = contentRef.current.scrollHeight + 4;
      setDrawerHeight(contentHeight);
    } else {
      setDrawerHeight(0);
    }
  }, [isOpen]);

  // 切换抽屉状态
  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  // 处理年级选择
  const handleGradeSelect = (grade: Grade) => {
    onGradeChange(grade);
    setIsOpen(false);
  };

  return (
    <div className="mx-5 mt-8 mb-4">
      {/* 触发区域 */}
      <div
        onClick={toggleDrawer}
        className={`w-full rounded-lg border pt-5 pb-3 px-4 text-left transition-colors duration-200 shadow-sm cursor-pointer relative z-10 ${
          darkMode
            ? 'bg-neutral-dark-100 border-neutral-dark-300 hover:bg-neutral-dark-200'
            : 'bg-white border-neutral-200 hover:bg-neutral-50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
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
            <div className="flex flex-col justify-end py-2">
              <div className={`text-sm font-medium leading-normal ${
                darkMode ? 'text-neutral-dark-900' : 'text-neutral-900'
              }`}>年级选择</div>
              <div className={`text-xs leading-normal mt-0.5 ${
                darkMode ? 'text-neutral-dark-500' : 'text-neutral-500'
              }`}>{currentGradeInfo?.label || '未知年级'}</div>
            </div>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 ${
            darkMode
              ? 'text-primary-dark-400 bg-primary-dark-900/30'
              : 'text-primary-600 bg-primary-50'
          }`}>
            {currentGradeInfo?.short || '未知'}
          </span>
        </div>
      </div>

      {/* 抽屉内容 */}
      <div
        ref={drawerRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: `${drawerHeight}px` }}
      >
        <div ref={contentRef} className="mt-2 pb-2">
          {/* 年级网格 */}
          <div className={`rounded-lg border p-4 ${
            darkMode
              ? 'bg-neutral-dark-100 border-neutral-dark-300'
              : 'bg-white border-neutral-200'
          }`}>
            <div className="grid grid-cols-4 gap-2">
              {grades.map((grade) => {
                const isActive = currentGrade === grade.value;
                return (
                  <button
                    key={grade.value}
                    onClick={() => handleGradeSelect(grade.value as Grade)}
                    className={`
                      relative py-3 px-2 text-sm font-medium rounded-lg transition-all duration-200 border
                      ${isActive
                        ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                        : darkMode
                          ? 'bg-neutral-dark-200 text-neutral-dark-600 border-neutral-dark-300 hover:border-neutral-dark-400 hover:bg-neutral-dark-300'
                          : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{grade.short}</span>
                    </div>
                    {isActive && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
