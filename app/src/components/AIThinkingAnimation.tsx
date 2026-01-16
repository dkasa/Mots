import React, { useEffect, useState } from 'react';

interface AIThinkingAnimationProps {
  darkMode?: boolean;
  message?: string;
}

export function AIThinkingAnimation({ darkMode = false, message = "AI正在智能生成句子..." }: AIThinkingAnimationProps) {
  const [pulsePhase, setPulsePhase] = useState(0);

  // 从message中提取进度百分比
  const progressMatch = message.match(/(\d+)%/);
  const progress = progressMatch ? parseInt(progressMatch[1]) : 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(prev => (prev + 1) % 3);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center min-h-[500px] p-8 relative overflow-hidden ${
      darkMode ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' : 'bg-gradient-to-br from-white via-purple-50 to-blue-50'
    }`}>
      {/* 动态背景光晕 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute w-96 h-96 rounded-full blur-3xl animate-pulse ${
            darkMode ? 'bg-purple-600/20' : 'bg-purple-400/10'
          }`}
          style={{ animationDuration: '3s' }}
        />
        <div
          className={`absolute w-80 h-80 rounded-full blur-3xl animate-pulse ${
            darkMode ? 'bg-blue-600/15' : 'bg-blue-400/10'
          }`}
          style={{ animationDuration: '4s', animationDelay: '1s' }}
        />
      </div>

      {/* AI机器人图标 */}
      <div className="relative mb-8 z-10">
        {/* 外圈旋转环 */}
        <div className={`absolute inset-0 w-32 h-32 rounded-full border-2 border-dashed animate-spin ${
          darkMode ? 'border-purple-400/30' : 'border-purple-300/30'
        }`} style={{ animationDuration: '20s' }} />

        {/* 内圈发光环 */}
        <div className={`absolute inset-2 w-28 h-28 rounded-full animate-pulse ${
          darkMode ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20' : 'bg-gradient-to-r from-purple-200/50 to-blue-200/50'
        }`} style={{ animationDuration: '2s' }} />

        {/* 主图标容器 */}
        <div className={`relative w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl ${
          darkMode
            ? 'bg-gradient-to-br from-purple-600 to-blue-600'
            : 'bg-gradient-to-br from-purple-500 to-blue-500'
        }`}>
          <span className="text-5xl filter drop-shadow-lg">🤖</span>
        </div>

        {/* 思考气泡动画 */}
        <div className="absolute -top-3 -right-3 flex flex-col gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-500 ${
                darkMode ? 'bg-purple-400' : 'bg-purple-500'
              } ${i === pulsePhase ? 'scale-125 opacity-100' : 'scale-100 opacity-40'}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>

      {/* 加载文本 */}
      <div className="text-center z-10">
        <h3 className={`text-2xl font-bold mb-2 ${
          darkMode ? 'text-white drop-shadow-lg' : 'text-gray-800'
        }`}>
          {message}
        </h3>

        {/* 进度条容器 */}
        <div className="mb-6">
          <div className={`w-80 h-3 rounded-full overflow-hidden ${
            darkMode ? 'bg-slate-700/50' : 'bg-gray-200'
          }`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                darkMode
                  ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500'
                  : 'bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500'
              }`}
              style={{
                width: `${progress}%`,
                boxShadow: progress < 85
                  ? darkMode
                    ? '0 0 20px rgba(168, 85, 247, 0.5)'
                    : '0 0 20px rgba(168, 85, 247, 0.4)'
                  : 'none'
              }}
            />
          </div>
          <div className={`text-sm mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            {progress}%
          </div>
        </div>

        {/* 状态卡片 */}
        <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl backdrop-blur-sm ${
          darkMode
            ? 'bg-slate-800/50 border border-slate-700/50'
            : 'bg-white/50 border border-gray-200/50'
        }`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            darkMode ? 'bg-green-400' : 'bg-green-500'
          }`} />
          <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
            正在调用AI服务...
          </span>
        </div>

        {/* 打字机效果的文字 */}
        <div className={`text-sm mt-6 font-medium ${
          darkMode ? 'text-slate-400' : 'text-gray-500'
        }`}>
          <span className="inline-flex items-center gap-2">
            <span className="animate-pulse">✨</span>
            <span
              className="inline-block overflow-hidden whitespace-nowrap border-r-2 border-purple-500 pr-1"
              style={{
                animation: 'typing 3s steps(40, end) infinite'
              }}
            >
              生成高质量的法语句子
            </span>
          </span>
        </div>
      </div>

      {/* 浮动粒子效果 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className={`absolute w-2 h-2 rounded-full transition-all duration-1000 ${
              darkMode
                ? i % 2 === 0 ? 'bg-purple-400/30' : 'bg-blue-400/30'
                : i % 2 === 0 ? 'bg-purple-400/20' : 'bg-blue-400/20'
            }`}
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `float ${4 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
              width: `${6 + Math.random() * 8}px`,
              height: `${6 + Math.random() * 8}px`
            }}
          />
        ))}
      </div>

      {/* 底部装饰 */}
      <div className="absolute bottom-8 left-0 right-0 z-10">
        <div className={`flex justify-center gap-4 ${darkMode ? 'text-slate-500' : 'text-gray-400'} text-xs`}>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            智能生成
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            高质量
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
            个性化
          </span>
        </div>
      </div>

      {/* 全局CSS动画 */}
      <style>{`
        @keyframes typing {
          from { width: 0 !important; }
          to { width: 100% !important; }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px) rotate(0deg);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-30px) translateX(15px) rotate(180deg);
            opacity: 0.6;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}