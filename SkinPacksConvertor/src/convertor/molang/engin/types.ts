/** Lexer token kinds supported by the Touhou Little Maid Molang parser. */
export enum TokenKind {
  EOF = 'EOF',
  ERROR = 'ERROR',
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  FLOAT = 'FLOAT',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  RETURN = 'RETURN',
  DOT = 'DOT',
  BANG = 'BANG',
  AMPAMP = 'AMPAMP',
  BARBAR = 'BARBAR',
  LT = 'LT',
  LTE = 'LTE',
  GT = 'GT',
  GTE = 'GTE',
  EQ = 'EQ',
  EQEQ = 'EQEQ',
  BANGEQ = 'BANGEQ',
  STAR = 'STAR',
  SLASH = 'SLASH',
  PLUS = 'PLUS',
  SUB = 'SUB',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  QUESQUES = 'QUESQUES',
  QUES = 'QUES',
  COLON = 'COLON',
  ARROW = 'ARROW',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  COMMA = 'COMMA',
  SEMICOLON = 'SEMICOLON',
}

const VALUE_TOKEN_KINDS = new Set<TokenKind>([
  TokenKind.ERROR,
  TokenKind.IDENTIFIER,
  TokenKind.STRING,
  TokenKind.FLOAT,
]);

export const tokenKindHasValue = (kind: TokenKind): boolean => VALUE_TOKEN_KINDS.has(kind);

/**
 * 单个词法单元
 *
 * `start` / `end` 使用源码字符索引，便于解析错误定位和调试 token 流。
 */
export class Token {
  constructor(
    /** Token 类型。 */
    public readonly kind: TokenKind,
    /** 字面量或标识符内容；仅 `VALUE_TOKEN_KINDS` 中的 token 必须存在。 */
    public readonly value: string | null,
    /** Token 在源码中的起始字符索引。 */
    public readonly start: number,
    /** Token 在源码中的结束字符索引。 */
    public readonly end: number,
  ) {
    if (tokenKindHasValue(kind) && value === null) {
      throw new Error(`A token with kind ${kind} must have a non-null value`);
    }
  }

  toString(): string {
    return tokenKindHasValue(this.kind) ? `${this.kind}(${this.value})` : this.kind;
  }
}


/**
 * 源码读取游标
 *
 * `Cursor` 由 `MolangLexer` 持有，每消费一个字符都会调用 `push` 更新位置。
 * 它不参与表达式解析或求值，只用于在 `ParseException` 中报告更友好的错误位置。
 */
export class Cursor {
  constructor(
    /** 当前读取位置在源码字符串中的字符索引。 */
    public index = 0,
    /** 当前行号；从 0 开始计数。 */
    public line = 0,
    /** 当前列号；从 0 开始计数，读到换行后重置。 */
    public column = 0,
  ) {}

  /**
   * 推进一个字符位置。
   *
   * 普通字符会让列号加一；换行符会让行号加一，并把列号重置到下一行开头。
   */
  push(character: string | null): void {
    this.index++;
    if (character === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
  }

  /** 复制当前游标状态，避免外部修改影响原游标。 */
  clone(): Cursor {
    return new Cursor(this.index, this.line, this.column);
  }

  /** 转成错误信息中使用的人类可读位置。 */
  toString(): string {
    return `line ${this.line}, column ${this.column}`;
  }
}

/**
 * Molang 解析阶段抛出的异常类型。
 *
 * 当词法分析或语法解析遇到非法字符、非预期 token 等错误时使用。
 * 可选的 `cursor` 会被拼接进错误信息，帮助调用方定位源码中的具体行列。
 */
export class ParseException extends Error {
  constructor(message: string, public readonly cursor: Cursor | null = null) {
    super(cursor ? `${message}\n  at ${cursor.toString()}` : message);
    this.name = 'ParseException';
  }
}

/**
 * 判断值是否为空值。
 *
 * 该类型守卫同时匹配 `null` 和 `undefined`，用于统一处理 Molang 运行时中缺失、未定义或显式为空的结果。
 */
export const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;
