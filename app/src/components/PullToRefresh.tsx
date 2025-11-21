import React, { useState, useEffect, useRef } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({ 
  onRefresh, 
  children, 
  threshold = 80, 
  className = '' 
}: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(true);
  
  const startY = useRef(0);
  const currentY = useRef(0);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: TouchEvent) => {
    if (elementRef.current?.scrollTop === 0) {
      setCanPull(true);
      startY.current = e.touches[0].clientY;
    } else {
      setCanPull(false);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!canPull || isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;
    
    if (distance > 0 && elementRef.current?.scrollTop === 0) {
      e.preventDefault();
      const pullDistance = Math.min(distance * 0.5, threshold * 1.5);
      setPullDistance(pullDistance);
      setIsPulling(pullDistance > 20);
    }
  };

  const handleTouchEnd = async () => {
    if (!canPull || isRefreshing) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
    setCanPull(true);
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canPull, isRefreshing, pullDistance]);

  return (
    <div 
      ref={elementRef}
      className={`relative overflow-auto ${className}`}
      style={{
        transform: `translateY(${pullDistance * 0.3}px)`,
        transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'none'
      }}
    >
      {/* 刷新指示器 */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10"
        style={{
          height: Math.max(pullDistance, 0),
          transform: `translateY(${-Math.max(pullDistance - 60, 0)}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        <div className={`
          flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all duration-300
          ${pullDistance >= threshold ? 'bg-primary-500 text-white' : 'bg-white text-neutral-600'}
          ${isRefreshing ? 'opacity-100' : 'opacity-80'}
        `}>
          {isRefreshing ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg 
              className={`w-5 h-5 transition-transform duration-300 ${
                pullDistance >= threshold ? 'rotate-180' : 'rotate-0'
              }`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <span className="text-sm font-medium">
            {isRefreshing ? '刷新中...' : 
             pullDistance >= threshold ? '松开刷新' : 
             pullDistance > 20 ? '下拉刷新' : ''}
          </span>
        </div>
      </div>
      
      {/* 内容 */}
      <div style={{ paddingTop: Math.max(pullDistance - 60, 0) }}>
        {children}
      </div>
    </div>
  );
}

// Hook for using pull-to-refresh
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return { isRefreshing, refresh };
}
