import React from 'react';
import { Grade } from '../types/vocabulary';

interface GradeSelectorProps {
  currentGrade: Grade;
  onGradeChange: (grade: Grade) => void;
  darkMode?: boolean;
}

export function GradeSelector({ currentGrade, onGradeChange, darkMode = false }: GradeSelectorProps) {
  const grades = [
    { value: 71 as Grade, label: '初一上' },
    { value: 72 as Grade, label: '初一下' },
    { value: 81 as Grade, label: '初二上' },
    { value: 82 as Grade, label: '初二下' },
    { value: 91 as Grade, label: '初三上' },
    { value: 92 as Grade, label: '初三下' },
  ];

  return (
    <div className={`rounded-md p-2 mx-5 mt-8 mb-4 transition-colors duration-300 ${
      darkMode ? 'bg-neutral-dark-200' : 'bg-neutral-100'
    }`}>
      <div className="flex">
        {grades.map((grade) => {
          const isActive = currentGrade === grade.value;
          return (
            <button
              key={grade.value}
              onClick={() => onGradeChange(grade.value)}
              className={`
                flex-1 h-16 text-base font-medium rounded-md transition-all duration-250 ease-out relative
                ${isActive 
                  ? (darkMode 
                    ? 'bg-bg-dark-card text-primary-700 font-semibold shadow-dark-sm' 
                    : 'bg-bg-card text-primary-700 font-semibold shadow-sm') 
                  : (darkMode 
                    ? 'text-neutral-dark-600 hover:bg-neutral-dark-300' 
                    : 'text-neutral-600 hover:bg-neutral-50')
                }
              `}
            >
              {grade.label}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-10 h-1.5 bg-primary-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
