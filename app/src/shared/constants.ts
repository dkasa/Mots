// 前端共享常量定义

// 年级类型定义
export type Grade = 71 | 72 | 81 | 82 | 91 | 92;

// 简写的年级映射（用于前端显示）
export const GRADE_SHORT_DESCRIPTION_MAP: Record<Grade, string> = {
  71: '初一上',
  72: '初一下', 
  81: '初二上',
  82: '初二下',
  91: '初三上',
  92: '初三下'
};

// 年级描述工具函数（前端专用）
export function getGradeShortDescription(grade: number): string {
  // 参数验证：确保grade是有效的数字
  if (typeof grade !== 'number' || isNaN(grade)) {
    console.warn(`⚠️ 无效的年级参数: ${grade}, 使用默认描述`);
    return '未知年级';
  }
  
  // 使用类型安全的映射，确保grade是有效的键
  return GRADE_SHORT_DESCRIPTION_MAP[grade as Grade] || `初中${grade}年级`;
}