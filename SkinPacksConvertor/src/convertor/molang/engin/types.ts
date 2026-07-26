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
 * 单个词法单元。
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

export class Cursor {
  constructor(
    public index = 0,
    public line = 0,
    public column = 0,
  ) {}

  push(character: string | null): void {
    this.index++;
    if (character === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
  }

  clone(): Cursor {
    return new Cursor(this.index, this.line, this.column);
  }

  toString(): string {
    return `line ${this.line}, column ${this.column}`;
  }
}

export class ParseException extends Error {
  constructor(message: string, public readonly cursor: Cursor | null = null) {
    super(cursor ? `${message}\n  at ${cursor.toString()}` : message);
    this.name = 'ParseException';
  }
}

export const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;
