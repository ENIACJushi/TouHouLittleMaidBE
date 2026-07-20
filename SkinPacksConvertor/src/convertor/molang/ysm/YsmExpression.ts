/**
 * ysm 表达式分段结构。
 *
 * - 普通段：`{ name: 'ysm' }`
 * - 函数段：`{ name: 'func', params: ['a', 'b'] }`
 */
export type YsmSegment = {
  /** 段名称，例如 `ysm` / `func1` / `var1` */
  name: string;
  /** 当该段是函数调用时的参数列表 */
  params?: string[];
};

/** 判断字符是否可作为标识符的一部分 */
const isIdentifierChar = (char: string): boolean => /[A-Za-z0-9_]/.test(char);

/**
 * 从 `startIndex` 开始向右消费一个标识符，返回结束位置（开区间）。
 *
 * 例如：`func1(` 中从 `f` 开始，会返回 `(` 的位置。
 */
const consumeIdentifier = (source: string, startIndex: number): number => {
  let index = startIndex;
  while (index < source.length && isIdentifierChar(source[index])) {
    index++;
  }
  return index;
};

/**
 * 从 `(` 开始消费完整的平衡括号片段，返回右括号后一位。
 *
 * 支持：
 * - 嵌套括号：`a(b(c))`
 * - 引号内容：`"a,b"` / `'x.y'`
 * - 转义字符：`"a\"b"`
 *
 * 若括号不平衡，则返回 `startIndex`，交给上层做降级处理。
 */
const consumeBalancedParentheses = (source: string, startIndex: number): number => {
  if (source[startIndex] !== '(') {
    return startIndex;
  }

  let index = startIndex;
  let depth = 0;
  let quote: '' | '"' | "'" = '';

  while (index < source.length) {
    const char = source[index];

    if (quote) {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = '';
      }
      index++;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      index++;
      continue;
    }

    if (char === '(') {
      depth++;
      index++;
      continue;
    }

    if (char === ')') {
      depth--;
      index++;
      if (depth === 0) {
        return index;
      }
      continue;
    }

    index++;
  }

  // 括号不平衡时，退回 startIndex，让上层逻辑仅匹配到 `ysm.xxx`
  return startIndex;
};

/**
 * 在字符串中查找所有 `ysm` 风格表达式，并交给 `replacer` 决定替换值。
 *
 * 当前匹配形态包括：
 * - `ysm.xxx`
 * - `ysm.xxx(...)`
 * - `ysm.xxx(...).yyy`
 *
 * 该函数只负责“定位 + 截取 + 回调替换”，不关心业务替换规则。
 */
export function replaceYsmExpressions(source: string, replacer: (ysmExpression: string) => string): string {
  let result = '';
  let index = 0;

  while (index < source.length) {
    const ysmIndex = source.indexOf('ysm.', index);
    if (ysmIndex < 0) {
      result += source.slice(index);
      break;
    }

    result += source.slice(index, ysmIndex);

    const identifierStart = ysmIndex + 4;
    let endIndex = consumeIdentifier(source, identifierStart);

    if (endIndex === identifierStart) {
      // 不是有效的 `ysm.xxx`，按普通文本处理
      result += 'ysm.';
      index = identifierStart;
      continue;
    }

    if (source[endIndex] === '(') {
      const callEndIndex = consumeBalancedParentheses(source, endIndex);
      if (callEndIndex > endIndex) {
        endIndex = callEndIndex;
      }
    }

    while (source[endIndex] === '.') {
      const propertyStart = endIndex + 1;
      const propertyEnd = consumeIdentifier(source, propertyStart);
      if (propertyEnd === propertyStart) {
        break;
      }
      endIndex = propertyEnd;
    }

    const matched = source.slice(ysmIndex, endIndex);
    result += replacer(matched);
    index = endIndex;
  }

  return result;
}

/**
 * 仅按“顶层”分隔符切分字符串。
 *
 * 顶层的定义：不在引号内，且不在任何括号嵌套内。
 *
 * 用途：
 * - 按 `.` 拆分 `ysm.func(a,b).var`
 * - 按 `,` 拆分 `func(a, math.clamp(x,0,1), b)` 的参数
 */
const splitTopLevel = (source: string, separator: '.' | ','): string[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: '' | '"' | "'" = '';

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (quote) {
      current += char;
      if (char === '\\' && i + 1 < source.length) {
        current += source[i + 1];
        i++;
        continue;
      }
      if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === '(') {
      depth++;
      current += char;
      continue;
    }

    if (char === ')') {
      depth = Math.max(depth - 1, 0);
      current += char;
      continue;
    }

    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
};

/**
 * 将一个完整的 ysm 表达式拆成结构化段数组。
 *
 * 示例：
 * `ysm.func1(param1, param2).var1` =>
 * [
 *   { name: 'ysm' },
 *   { name: 'func1', params: ['param1', 'param2'] },
 *   { name: 'var1' }
 * ]
 */
export const parseYsmExpression = (ysmExpression: string): YsmSegment[] => {
  const segments = splitTopLevel(ysmExpression.trim(), '.').filter(Boolean);

  return segments.map((segment): YsmSegment => {
    const leftParenIndex = segment.indexOf('(');
    if (leftParenIndex <= 0 || !segment.endsWith(')')) {
      return {name: segment};
    }

    const name = segment.slice(0, leftParenIndex).trim();
    const paramsRaw = segment.slice(leftParenIndex + 1, -1);
    const params = paramsRaw.trim().length === 0
      ? []
      : splitTopLevel(paramsRaw, ',').map((param) => param.trim()).filter(Boolean);
    return {name, params};
  });
};
