import React from 'react';

export function LoadingSkeleton() {
  return (
    <div className="mx-5 my-8">
      {/* 词性标签骨架屏 */}
      <div className="mb-6 flex justify-center">
        <div className="w-16 h-6 bg-neutral-200 rounded-full animate-pulse" />
      </div>
      
      {/* 法语单词骨架屏 */}
      <div className="text-center mb-4">
        <div className="h-8 bg-neutral-200 rounded animate-pulse mx-auto w-32" />
      </div>
      
      {/* 音标骨架屏 */}
      <div className="text-center mb-6">
        <div className="h-4 bg-neutral-200 rounded animate-pulse mx-auto w-24" />
      </div>
      
      {/* 中文释义骨架屏 */}
      <div className="text-center">
        <div className="h-5 bg-neutral-200 rounded animate-pulse mx-auto w-20" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-5 my-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-error-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-neutral-800 mb-2">加载失败</h3>
      <p className="text-neutral-600 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-primary-500 hover:bg-primary-700 text-white font-semibold rounded-md transition-colors duration-200"
      >
        重新加载
      </button>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-5 my-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-neutral-600">{message}</p>
    </div>
  );
}
