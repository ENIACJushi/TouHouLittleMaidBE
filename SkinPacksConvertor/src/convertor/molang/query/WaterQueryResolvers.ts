import {MolangLexer, Token, TokenKind} from '../engin';

/**
 * Java 可当布尔用、基岩需显式比较的水/雨 query。
 * 较长的 `is_in_water_or_rain` 与 `is_in_water` 均为完整标识符，词法上不会互相截断。
 */
const WATER_BOOLEAN_QUERIES: ReadonlySet<string> = new Set([
  'is_in_water',
  'is_in_water_or_rain',
]);

/** 比较运算符：已写成 `==` / `!=` / `>` 等时不再改写 */
const COMPARISON_KINDS: ReadonlySet<TokenKind> = new Set([
  TokenKind.EQEQ,
  TokenKind.BANGEQ,
  TokenKind.LT,
  TokenKind.LTE,
  TokenKind.GT,
  TokenKind.GTE,
]);

type WaterBooleanMatch = {
  /** 替换区间起点（含可选的前导 `!`） */
  replaceStart: number;
  /** 替换区间终点（query 名结束） */
  replaceEnd: number;
  /** query 名 token 下标，供外层循环跳过 */
  nameIndex: number;
  replacement: string;
};

/**
 * 将布尔用法的水/雨 query 转为基岩显式真值比较。
 *
 * - `query.is_in_water` → `query.is_in_water==1`
 * - `!query.is_in_water` → `query.is_in_water==0`
 * - `query.is_in_water_or_rain` / `!query.is_in_water_or_rain` 同理
 * - 已是比较运算一侧（如 `==1` / `!=0`）时原样保留
 */
export const convertJavaWaterBooleanQueries = (source: string): string => {
  if (!/is_in_water/i.test(source)) {
    return source;
  }

  const tokens = MolangLexer.tokenizeAll(source);
  let result = '';
  let cursor = 0;

  for (let i = 0; i < tokens.length; i++) {
    const match = matchWaterBooleanQuery(source, tokens, i);
    if (!match) {
      continue;
    }

    result += source.slice(cursor, match.replaceStart);
    result += match.replacement;
    cursor = match.replaceEnd;
    i = match.nameIndex;
  }

  if (cursor === 0) {
    return source;
  }
  return result + source.slice(cursor);
};

/**
 * 匹配 `q.is_in_water` / `query.is_in_water_or_rain`（及可选前导 `!`）
 */
const matchWaterBooleanQuery = (
  source: string,
  tokens: Token[],
  index: number,
): WaterBooleanMatch | null => {
  const root = tokens[index];
  const dot = tokens[index + 1];
  const name = tokens[index + 2];
  if (
    root?.kind !== TokenKind.IDENTIFIER
    || (root.value !== 'q' && root.value !== 'query')
    || dot?.kind !== TokenKind.DOT
    || name?.kind !== TokenKind.IDENTIFIER
    || !name.value
    || !WATER_BOOLEAN_QUERIES.has(name.value)
  ) {
    return null;
  }

  const left = index > 0 ? tokens[index - 1] : undefined;
  const right = tokens[index + 3];

  // 已是比较运算的一侧，不再改写
  if (right && COMPARISON_KINDS.has(right.kind)) {
    return null;
  }
  if (left && COMPARISON_KINDS.has(left.kind)) {
    return null;
  }

  const callee = source.slice(root.start, name.end);
  const hasBang = left?.kind === TokenKind.BANG;

  return {
    replaceStart: hasBang ? left!.start : root.start,
    replaceEnd: name.end,
    nameIndex: index + 2,
    replacement: hasBang ? `${callee}==0` : `${callee}==1`,
  };
};
