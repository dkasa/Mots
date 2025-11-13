import React from 'react';
import { Check, X } from 'lucide-react';

interface ActionButtonsProps {
  onMarkAsMastered: () => void;
  onMarkAsUnmastered: () => void;
  disabled?: boolean;
}

export function ActionButtons({ onMarkAsMastered, onMarkAsUnmastered, disabled }: ActionButtonsProps) {
  return (
    <div className="px-5 pb-6 pt-4 safe-area-inset-bottom">
      <div className="flex gap-4">
        {/* 未掌握按钮 */}
        <button
          onClick={onMarkAsUnmastered}
          disabled={disabled}
          className="
            flex-1 h-14 px-8 bg-secondary-500 hover:bg-secondary-700 
            text-white text-lg font-semibold rounded-md 
            flex items-center justify-center gap-2
            transition-all duration-150 ease-out
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-96
            shadow-md hover:shadow-lg
          "
        >
          <X className="w-5 h-5" />
          未掌握
        </button>
        
        {/* 已掌握按钮 */}
        <button
          onClick={onMarkAsMastered}
          disabled={disabled}
          className="
            flex-1 h-14 px-8 bg-success-500 hover:bg-success-700
            text-white text-lg font-semibold rounded-md
            flex items-center justify-center gap-2
            transition-all duration-150 ease-out
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-96
            shadow-md hover:shadow-lg
          "
        >
          <Check className="w-5 h-5" />
          已掌握
        </button>
      </div>
    </div>
  );
}
