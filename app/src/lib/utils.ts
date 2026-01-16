import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 处理转义字符，将JSON转义字符还原为正常字符
 * 主要用于处理法语中的单引号等特殊字符
 */
export function unescapeText(text: string): string {
  if (!text) return text;
  
  // 还原转义的单引号
  let result = text.replace(/\\'/g, "'");
  
  // 还原转义的双引号
  result = result.replace(/\\"/g, '"');
  
  // 还原转义的反斜杠
  result = result.replace(/\\\\/g, '\\');
  
  // 还原其他常见转义字符
  result = result.replace(/\\n/g, '\n');
  result = result.replace(/\\r/g, '\r');
  result = result.replace(/\\t/g, '\t');
  
  return result;
}

/**
 * 专门处理法语文本中的转义字符
 * 主要针对法语中的单引号问题
 */
export function unescapeFrenchText(text: string): string {
  if (!text) return text;
  
  // 法语中最常见的转义问题是单引号
  let result = text.replace(/\\'/g, "'");
  
  // 处理多余的反斜杠
  result = result.replace(/\\\\/g, '\\');
  
  return result;
}

/**
 * 处理数组中的转义字符
 * 适用于word_blocks、shuffled_blocks等数组
 */
export function unescapeArray(items: string[]): string[] {
  if (!items || !Array.isArray(items)) return items;
  
  return items.map(item => unescapeFrenchText(item));
}