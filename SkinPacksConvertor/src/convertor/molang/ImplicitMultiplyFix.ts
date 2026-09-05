import {MolangLexer, TokenKind} from './engin';

/**
 * 将作者/Blockbench 常见的「隐式乘法」补成基岩可解析的显式 `*`。
 *
 * 基岩 Molang 不允许数字与括号紧贴（如 `1(expr)`、`-62.5(math.cos(...))`、`(a)(b)`、`(...)50`），
 * 会报 `found multiple operations without a combining operation between them`。
 * Java/Gecko 侧有时更宽松，故 YSM 原包常带这种写法。
 *
 * 处理：
 * - `FLOAT` + `(` → 插入 `*`
 * - `)` + `FLOAT` → 插入 `*`
 * - `)` + `(` → 插入 `*`
 *
 * 不处理 `IDENTIFIER` + `(`（函数调用，如 `math.sin(` / `query.x(`）。
 */
export function insertExplicitMultiply(source: string): string {
  if (!source || (!source.includes('(') && !source.includes(')'))) {
    return source;
  }

  const tokens = MolangLexer.tokenizeAll(source);
  if (tokens.length < 2) {
    return source;
  }

  /** 在这些源码下标前插入 `*`（从后往前应用，避免偏移） */
  const insertBefore: number[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const left = tokens[i];
    const right = tokens[i + 1];
    if (needsExplicitMultiply(left.kind, right.kind)) {
      insertBefore.push(right.start);
    }
  }

  if (insertBefore.length === 0) {
    return source;
  }

  let result = source;
  for (let i = insertBefore.length - 1; i >= 0; i--) {
    const pos = insertBefore[i];
    result = `${result.slice(0, pos)}*${result.slice(pos)}`;
  }
  return result;
}

function needsExplicitMultiply(left: TokenKind, right: TokenKind): boolean {
  if (left === TokenKind.FLOAT && right === TokenKind.LPAREN) {
    return true;
  }
  if (left === TokenKind.RPAREN && right === TokenKind.FLOAT) {
    return true;
  }
  if (left === TokenKind.RPAREN && right === TokenKind.LPAREN) {
    return true;
  }
  return false;
}
