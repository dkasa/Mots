import React from 'react';
import { Grade } from '../types/vocabulary';

interface GradeSelectorProps {
  currentGrade: Grade;
  onGradeChange: (grade: Grade) => void;
}

export function GradeSelector({ currentGrade, onGradeChange }: GradeSelectorProps) {
  const grades = [
    { value: 7 as Grade, label: '初一' },
    { value: 8 as Grade, label: '初二' },
    { value: 9 as Grade, label: '初三' },
  ];

  return (
    <div className="bg-neutral-100 rounded-md p-1 mx-5 my-4">
      <div className="flex">
        {grades.map((grade) => {
          const isActive = currentGrade === grade.value;
          return (
            <button
              key={grade.value}
              onClick={() => onGradeChange(grade.value)}
              className={`
                flex-1 h-12 text-base font-medium rounded-md transition-all duration-250 ease-out relative
                ${isActive 
                  ? 'bg-bg-card text-primary-700 font-semibold shadow-sm' 
                  : 'text-neutral-600 hover:bg-neutral-50'
                }
              `}
            >
              {grade.label}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-primary-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
