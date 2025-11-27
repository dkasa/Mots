import React, { useState, useRef, useEffect } from 'react';
import { SelectionMode, UnitRange, CountSelection } from '../types/vocabulary';

interface SelectionDrawerProps {
  currentMode: SelectionMode;
  unitRange?: UnitRange;
  countSelection?: CountSelection;
  onModeChange: (mode: SelectionMode) => void;
  onUnitRangeChange: (range: UnitRange) => void;
  onCountSelectionChange: (selection: CountSelection) => void;
}

export function SelectionDrawer({
  currentMode,
  unitRange = { startUnit: 1, endUnit: 6 },
  countSelection = { count: 20 },
  onModeChange,
  onUnitRangeChange,
  onCountSelectionChange,
}: SelectionDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const modes = [
    { value: 'grade-all' as SelectionMode, label: '全部', desc: '该年级所有单词' },
    { value: 'grade-unit' as SelectionMode, label: '单元', desc: '选择指定单元' },
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
      case 'grade-unit':
        return `单元 ${unitRange.startUnit}-${unitRange.endUnit}`;
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
  }, [isOpen, currentMode, unitRange, countSelection]);

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

  return (
    <div className="mx-5 mb-4">
      {/* 触发按钮 */}
      <button
        onClick={toggleDrawer}
        className="w-full bg-white rounded-lg border border-neutral-200 p-4 text-left hover:bg-neutral-50 transition-colors duration-200 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <svg 
                className={`w-5 h-5 text-primary-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-neutral-900">单词选择</div>
              <div className="text-xs text-neutral-500">{getCurrentModeText()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-1 rounded">
              {modes.find(m => m.value === currentMode)?.label}
            </span>
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
          <div className="bg-white rounded-lg border border-neutral-200 p-3">
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
                        : 'text-neutral-600 hover:bg-neutral-50'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{mode.label}</span>
                      <span className={`text-xs mt-0.5 ${isActive ? 'text-primary-100' : 'text-neutral-400'}`}>
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
            <div className="mt-2 bg-neutral-50 rounded-lg border border-neutral-200 p-4">
              {currentMode === 'grade-unit' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">单元范围</label>
                    <span className="text-xs text-neutral-500 bg-white px-2 py-1 rounded">
                      单元 {unitRange.startUnit} - {unitRange.endUnit}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={unitRange.startUnit}
                      onChange={(e) => {
                        const newStartUnit = parseInt(e.target.value);
                        console.log('选择起始单元:', newStartUnit);
                        onUnitRangeChange({ 
                          ...unitRange, 
                          startUnit: newStartUnit 
                        });
                      }}
                      className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(unit => (
                        <option key={unit} value={unit}>第 {unit} 单元</option>
                      ))}
                    </select>
                    
                    <div className="flex items-center px-2 text-neutral-400">
                      <span>至</span>
                    </div>
                    
                    <select
                      value={unitRange.endUnit}
                      onChange={(e) => {
                        const newEndUnit = parseInt(e.target.value);
                        console.log('选择结束单元:', newEndUnit);
                        onUnitRangeChange({ 
                          ...unitRange, 
                          endUnit: newEndUnit 
                        });
                      }}
                      className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(unit => (
                        <option key={unit} value={unit} disabled={unit < unitRange.startUnit}>
                          第 {unit} 单元
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {currentMode === 'grade-count' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">单词数量</label>
                    <span className="text-xs text-neutral-500 bg-white px-2 py-1 rounded">
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
                            : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                          }
                        `}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-neutral-500 text-center">
                    每次随机选择 {countSelection.count} 个单词
                  </div>
                </div>
              )}

              {/* 完成按钮 */}
              <div className="mt-4 pt-3 border-t border-neutral-200">
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
    </div>
  );
}