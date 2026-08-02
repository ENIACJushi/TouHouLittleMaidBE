import {MolangLexer, Token, TokenKind} from './engin';

/**
 * 前缀字段链表达式的分段结构。
 *
 * - 普通段：`{ name: 'ysm' }` / `{ name: 'v' }`
 * - 函数段：`{ name: 'func', params: ['a', 'b'] }`
 */
export type ExpressionSegment = {
  /** 段名称，例如 `ysm` / `v` / `func1` / `var1` */
  name: string;
  /** 当该段是函数调用时的参数列表 */
  params?: string[];
};

/** @deprecated 请改用 {@link ExpressionSegment}；保留别名以兼容既有 ysm 解析器。 */
export type YsmSegment = ExpressionSegment;

/** 默认识别的根前缀集合。 */
export const DEFAULT_EXPRESSION_PREFIXES: readonly string[] = ['ysm', 'v', 'variable', 'tlm'];

/** 前缀表达式替换时的相邻运算符上下文。 */
export type PrefixedExpressionOperatorContext = {
  /** 匹配段左侧相邻 token 的种类；无则 `null`。 */
  leftOperator: TokenKind | null;
  /** 匹配段右侧相邻 token 的种类；无则 `null`。 */
  rightOperator: TokenKind | null;
};

/** engin 词法器会把标识符统一归一化到 `value`，这里集中处理空值兜底。 */
const getIdentifierName = (token: Token): string => token.value ?? '';

/** 将前缀列表转为小写 Set，与 lexer 归一化后的标识符对齐。 */
const toPrefixSet = (prefixes: readonly string[]): ReadonlySet<string> => {
  return new Set(prefixes.map((prefix) => prefix.toLowerCase()));
};

/** 判断当前位置是否是 `.identifier` 形式的字段访问。 */
const isFieldAccess = (tokens: Token[], dotIndex: number): boolean => {
  return tokens[dotIndex]?.kind === TokenKind.DOT && tokens[dotIndex + 1]?.kind === TokenKind.IDENTIFIER;
};

/**
 * 从一个左括号 token 开始，向后找到同层级的右括号 token。
 *
 * 表达式中函数参数本身也可能包含 Molang 表达式，例如
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
 * 定位从指定 token 开始的完整 `prefix.xxx(...)` 字段链。
 *
 * 该逻辑只负责基于 engin 词法 token 判断边界；遇到不平衡括号时，会退化为
 * 仅匹配到当前标识符。
 */
const findPrefixedExpressionEnd = (
  tokens: Token[],
  startIndex: number,
  prefixes: ReadonlySet<string>,
): {endIndex: number; prefix: string} | null => {
  const root = tokens[startIndex];
  const prefix = root?.value;
  if (root?.kind !== TokenKind.IDENTIFIER || !prefix || !prefixes.has(prefix)) {
    return null;
  }

  // 合法表达式必须以 `prefix.` 开头；单独的 `ysm` / `v` 不会被替换。
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
        // 括号不完整时保留已识别的字段名边界，避免把后续源码错误吞入表达式。
        break;
      }
      lastIndex = closeIndex;
      index = closeIndex + 1;
    }
  }

  return lastIndex > startIndex ? {endIndex: lastIndex, prefix} : null;
};

/**
 * 快速判断源码中是否可能包含指定前缀的字段链（`prefix.`）。
 *
 * 仅作廉价预检，与 {@link DEFAULT_EXPRESSION_PREFIXES} 共用同一前缀列表，
 * 避免调用方手工维护 `includes('ysm.') || includes('v.')` 这类分支。
 */
export function containsPrefixedExpression(
  source: string,
  prefixes: readonly string[] = DEFAULT_EXPRESSION_PREFIXES,
): boolean {
  const lower = source.toLowerCase();
  for (const prefix of prefixes) {
    if (lower.includes(`${prefix.toLowerCase()}.`)) {
      return true;
    }
  }
  return false;
}

/**
 * 在字符串中查找所有指定前缀风格的字段链表达式，并交给 `replacer` 决定替换值。
 *
 * 当前匹配形态包括（以 `ysm` / `v` / `variable` / `tlm` 为例）：
 * - `ysm.xxx` / `v.xxx` / `variable.xxx` / `tlm.xxx`
 * - `ysm.xxx(...)` / `v.xxx(...)` / `tlm.xxx(...)`
 * - `ysm.xxx(...).yyy` / `v.xxx(...).yyy` / `tlm.xxx(...).yyy`
 *
 * 该函数只负责“定位 + 截取 + 回调替换”，不关心业务替换规则。
 * 无候选前缀时会直接返回原串，调用方无需再写前缀预检。
 *
 * @param prefixes 根前缀列表，默认 `['ysm', 'v', 'variable', 'tlm']`；大小写不敏感。
 */
export function replacePrefixedExpressions(
  source: string,
  replacer: (expression: string, prefix: string, ctx: PrefixedExpressionOperatorContext) => string,
  prefixes: readonly string[] = DEFAULT_EXPRESSION_PREFIXES,
): string {
  // 无候选前缀时跳过词法扫描，前缀列表变更后此处无需同步修改调用方。
  if (!containsPrefixedExpression(source, prefixes)) {
    return source;
  }

  const prefixSet = toPrefixSet(prefixes);
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

    // 第二步：尝试从当前 token 起识别一条完整前缀字段链。
    const matched = findPrefixedExpressionEnd(tokens, tokenIndex, prefixSet);
    if (matched === null) {
      tokenIndex++;
      continue;
    }

    // 第三步：把表达式前面的普通源码原样写回，只替换 token 边界内的表达式片段。
    const start = token.start;
    const end = tokens[matched.endIndex].end;
    const leftToken = tokenIndex > 0 ? tokens[tokenIndex - 1] : undefined;
    const rightToken = tokens[matched.endIndex + 1];
    const ctx: PrefixedExpressionOperatorContext = {
      leftOperator: leftToken?.kind ?? null,
      rightOperator: rightToken?.kind ?? null,
    };
    result += source.slice(sourceIndex, start);
    result += replacer(source.slice(start, end), matched.prefix, ctx);

    // 第四步：推进源码游标和 token 游标，继续扫描后续可能存在的表达式。
    sourceIndex = end;
    tokenIndex = matched.endIndex + 1;
  }

  return result + source.slice(sourceIndex);
}

/**
 * 兼容旧接口：仅替换 `ysm.` 前缀表达式。
 *
 * 新代码请优先使用 {@link replacePrefixedExpressions}。
 */
export function replaceYsmExpressions(source: string, replacer: (ysmExpression: string) => string): string {
  return replacePrefixedExpressions(source, (expression) => replacer(expression), ['ysm']);
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
 * 读取一个字段链段。
 *
 * 输入位置必须指向段名标识符：
 * - 后面没有括号时，输出普通段 `{ name }`
 * - 后面紧跟括号时，输出函数段 `{ name, params }`，并把 `nextIndex` 推进到右括号之后
 */
const readSegment = (source: string, tokens: Token[], identifierIndex: number): {segment: ExpressionSegment; nextIndex: number} => {
  const nameToken = tokens[identifierIndex];
  const segment: ExpressionSegment = {name: getIdentifierName(nameToken)};
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
 * 将一个完整的前缀字段链表达式拆成结构化段数组。
 *
 * 示例：
 * `ysm.func1(param1, param2).var1` =>
 * [
 *   { name: 'ysm' },
 *   { name: 'func1', params: ['param1', 'param2'] },
 *   { name: 'var1' }
 * ]
 *
 * `v.xxx.yyy` =>
 * [
 *   { name: 'v' },
 *   { name: 'xxx' },
 *   { name: 'yyy' }
 * ]
 */
export const parsePrefixedExpression = (expression: string): ExpressionSegment[] => {
  // 解析入口只处理单个已经定位好的表达式；先 trim，避免外围空白影响 token 坐标。
  const source = expression.trim();
  const tokens = MolangLexer.tokenizeAll(source);
  if (tokens[0]?.kind !== TokenKind.IDENTIFIER) {
    return [];
  }

  // 先读取根段（如 `ysm` / `v`），再按 `.identifier` 循环读取后续字段或函数段。
  const segments: ExpressionSegment[] = [];
  let {segment, nextIndex} = readSegment(source, tokens, 0);
  segments.push(segment);

  while (isFieldAccess(tokens, nextIndex)) {
    const identifierIndex = nextIndex + 1;
    ({segment, nextIndex} = readSegment(source, tokens, identifierIndex));
    segments.push(segment);
  }

  return segments;
};

/**
 * 兼容旧接口：解析单个已定位好的表达式。
 *
 * 新代码请优先使用 {@link parsePrefixedExpression}。
 */
export const parseYsmExpression = parsePrefixedExpression;
