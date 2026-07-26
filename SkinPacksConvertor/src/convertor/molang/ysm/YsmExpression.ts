import {MolangLexer, Token, TokenKind} from '../engin';

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

/** engin 词法器会把标识符统一归一化到 `value`，这里集中处理空值兜底。 */
const getIdentifierName = (token: Token): string => token.value ?? '';

/** 判断当前位置是否是 `.identifier` 形式的字段访问。 */
const isFieldAccess = (tokens: Token[], dotIndex: number): boolean => {
  return tokens[dotIndex]?.kind === TokenKind.DOT && tokens[dotIndex + 1]?.kind === TokenKind.IDENTIFIER;
};

/**
 * 从一个左括号 token 开始，向后找到同层级的右括号 token。
 *
 * ysm 表达式中函数参数本身也可能包含 Molang 表达式，例如
 * `ysm.func(math.clamp(a, 0, 1))`，因此不能只查找第一个 `)`，而需要按 token
 * 维护括号深度。
 */
const findBalancedClose = (tokens: Token[], openIndex: number): number | null => {
  if (tokens[openIndex]?.kind !== TokenKind.LPAREN) {
    return null;
  }

  let depth = 0;
  for (let index = openIndex; index < tokens.length; index++) {
    const kind = tokens[index].kind;
    if (kind === TokenKind.LPAREN) {
      depth++;
      continue;
    }
    if (kind === TokenKind.RPAREN) {
      depth--;
      if (depth === 0) {
        return index;
      }
    }
  }

  return null;
};

/**
 * 定位从指定 token 开始的完整 `ysm.xxx(...)` 字段链。
 *
 * 该逻辑只负责基于 engin 词法 token 判断边界；遇到不平衡括号时，会和旧实现一样退化为
 * 仅匹配到当前标识符。
 */
const findYsmExpressionEnd = (tokens: Token[], startIndex: number): number | null => {
  const root = tokens[startIndex];
  if (root?.kind !== TokenKind.IDENTIFIER || root.value !== 'ysm') {
    return null;
  }

  // 合法 ysm 表达式必须以 `ysm.` 开头；单独的 `ysm` 不会被替换。
  let index = startIndex + 1;
  if (!isFieldAccess(tokens, index)) {
    return null;
  }

  let lastIndex = startIndex;
  while (isFieldAccess(tokens, index)) {
    // 跳过 `.`，并把字段名 token 记为当前表达式的最后一段。
    index++;
    lastIndex = index;
    index++;

    // 如果字段后紧跟括号，则把它识别为函数调用段，并整体吞掉参数列表。
    if (tokens[index]?.kind === TokenKind.LPAREN) {
      const closeIndex = findBalancedClose(tokens, index);
      if (closeIndex === null) {
        // 括号不完整时保留已识别的字段名边界，避免把后续源码错误吞入 ysm 表达式。
        break;
      }
      lastIndex = closeIndex;
      index = closeIndex + 1;
    }
  }

  return lastIndex > startIndex ? lastIndex : null;
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
  // 第一步：整段 Molang 源码先交给通用 engin 词法器，后续只基于 token 边界判断，
  // 避免手写字符扫描时重复处理字符串、数字、小数点等词法细节。
  const tokens = MolangLexer.tokenizeAll(source);
  let result = '';
  let sourceIndex = 0;
  for (let tokenIndex = 0; tokenIndex < tokens.length;) {
    const token = tokens[tokenIndex];
    if (token.end <= sourceIndex) {
      tokenIndex++;
      continue;
    }

    // 第二步：尝试从当前 token 起识别一条完整 ysm 字段链。
    const endTokenIndex = findYsmExpressionEnd(tokens, tokenIndex);
    if (endTokenIndex === null) {
      tokenIndex++;
      continue;
    }

    // 第三步：把 ysm 表达式前面的普通源码原样写回，只替换 token 边界内的表达式片段。
    const start = token.start;
    const end = tokens[endTokenIndex].end;
    result += source.slice(sourceIndex, start);
    result += replacer(source.slice(start, end));

    // 第四步：推进源码游标和 token 游标，继续扫描后续可能存在的 ysm 表达式。
    sourceIndex = end;
    tokenIndex = endTokenIndex + 1;
  }

  return result + source.slice(sourceIndex);
}

/**
 * 仅按顶层逗号切分函数参数。
 *
 * 参数里可能继续出现函数调用、数组或执行作用域，所以只有在 `()` / `[]` / `{}`
 * 深度全部为 0 时，逗号才是真正的参数分隔符。
 */
const splitTopLevelArguments = (source: string, tokens: Token[], start: number, end: number): string[] => {
  if (source.slice(start, end).trim().length === 0) {
    return [];
  }

  const params: string[] = [];
  let currentStart = start;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (const token of tokens) {
    if (token.start < start || token.end > end) {
      continue;
    }

    // 在参数范围内用括号深度过滤嵌套结构，确保只切分当前函数的直接参数。
    switch (token.kind) {
      case TokenKind.LPAREN:
        parenDepth++;
        break;
      case TokenKind.RPAREN:
        parenDepth = Math.max(parenDepth - 1, 0);
        break;
      case TokenKind.LBRACKET:
        bracketDepth++;
        break;
      case TokenKind.RBRACKET:
        bracketDepth = Math.max(bracketDepth - 1, 0);
        break;
      case TokenKind.LBRACE:
        braceDepth++;
        break;
      case TokenKind.RBRACE:
        braceDepth = Math.max(braceDepth - 1, 0);
        break;
      case TokenKind.COMMA:
        if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
          params.push(source.slice(currentStart, token.start).trim());
          currentStart = token.end;
        }
        break;
    }
  }

  params.push(source.slice(currentStart, end).trim());
  return params.filter(Boolean);
};

/**
 * 读取一个 ysm 段。
 *
 * 输入位置必须指向段名标识符：
 * - 后面没有括号时，输出普通段 `{ name }`
 * - 后面紧跟括号时，输出函数段 `{ name, params }`，并把 `nextIndex` 推进到右括号之后
 */
const readSegment = (source: string, tokens: Token[], identifierIndex: number): {segment: YsmSegment; nextIndex: number} => {
  const nameToken = tokens[identifierIndex];
  const segment: YsmSegment = {name: getIdentifierName(nameToken)};
  let nextIndex = identifierIndex + 1;

  if (tokens[nextIndex]?.kind === TokenKind.LPAREN) {
    const closeIndex = findBalancedClose(tokens, nextIndex);
    if (closeIndex !== null) {
      // 参数保留原始源码片段，便于后续 resolver 直接拼回目标 Molang 表达式。
      segment.params = splitTopLevelArguments(source, tokens, tokens[nextIndex].end, tokens[closeIndex].start);
      nextIndex = closeIndex + 1;
    }
  }

  return {segment, nextIndex};
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
  // 解析入口只处理单个已经定位好的 ysm 表达式；先 trim，避免外围空白影响 token 坐标。
  const source = ysmExpression.trim();
  const tokens = MolangLexer.tokenizeAll(source);
  if (tokens[0]?.kind !== TokenKind.IDENTIFIER) {
    return [];
  }

  // 先读取根段 `ysm`，再按 `.identifier` 循环读取后续字段或函数段。
  const segments: YsmSegment[] = [];
  let {segment, nextIndex} = readSegment(source, tokens, 0);
  segments.push(segment);

  while (isFieldAccess(tokens, nextIndex)) {
    const identifierIndex = nextIndex + 1;
    ({segment, nextIndex} = readSegment(source, tokens, identifierIndex));
    segments.push(segment);
  }

  return segments;
};
