import {Cursor, Token, TokenKind} from './types';

const isDigit = (char: string | null): boolean => !!char && /[0-9]/.test(char);
const isWordStart = (char: string | null): boolean => !!char && /[A-Za-z_]/.test(char);
const isWordContinuation = (char: string | null): boolean => isWordStart(char) || isDigit(char);
const displayChar = (char: string | null): string => char === null ? 'EOF' : char;

/**
 * Molang 词法分析器。
 *
 * 以“按需读取”的方式把源码字符串转换为 Token 流；解析器每调用一次
 * `next()` 才会继续消费后续字符。
 */
export class MolangLexer {
  /** 当前读取位置，用于报错时显示行列。 */
  private readonly cursorValue = new Cursor();
  /** 下一个待处理字符；为 null 时表示 EOF。 */
  private nextCharValue: string | null;
  /** `nextCharValue` 在源码中的索引。 */
  private nextIndex = 0;
  /** 上一个 token，用于区分 `func().x` 中的点号和数字小数点。 */
  private lastTokenValue: Token | null = null;
  /** 当前 token，需要先调用 `next()` 才可读取。 */
  private tokenValue: Token | null = null;

  constructor(private readonly source: string) {
    this.nextCharValue = source.length > 0 ? source[0] : null;
  }

  /** 创建一个读取指定字符串的 lexer。 */
  static lexer(source: string): MolangLexer {
    return new MolangLexer(source);
  }

  /** 一次性读取所有非 EOF token，主要用于调试或测试。 */
  static tokenizeAll(source: string): Token[] {
    return MolangLexer.lexer(source).tokenizeAll();
  }

  cursor(): Cursor {
    return this.cursorValue;
  }

  current(): Token {
    if (!this.tokenValue) {
      throw new Error('No current token, please call next() at least once');
    }
    return this.tokenValue;
  }

  next(): Token {
    this.lastTokenValue = this.tokenValue;
    this.tokenValue = this.nextToken();
    return this.tokenValue;
  }

  tokenizeAll(): Token[] {
    const tokens: Token[] = [];
    let token: Token;
    while ((token = this.next()).kind !== TokenKind.EOF) {
      tokens.push(token);
    }
    return tokens;
  }

  close(): void {}

  /**
   * 读取下一个 token。
   *
   * 方法内部会跳过空白字符，并按数字、标识符、字符串、符号运算符的顺序匹配。
   */
  private nextToken(): Token {
    let char = this.nextCharValue;
    if (char === null) {
      return new Token(TokenKind.EOF, null, this.cursorValue.index, this.cursorValue.index + 1);
    }

    while (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      char = this.read();
    }

    if (char === null) {
      return new Token(TokenKind.EOF, null, this.cursorValue.index, this.cursorValue.index + 1);
    }

    const start = this.cursorValue.index;
    // `func().x` 中右括号后的点号一定是字段访问符，不能按 `.5` 这类小数解析。
    if (char === '.' && this.lastTokenValue?.kind === TokenKind.RPAREN) {
      this.read();
      return new Token(TokenKind.DOT, null, start, this.cursorValue.index);
    }

    const isLastIdentifier = this.lastTokenValue?.kind === TokenKind.IDENTIFIER;
    if (isDigit(char) || (!isLastIdentifier && char === '.')) {
      let value = '';
      value += char;
      while (isDigit(char = this.read())) {
        value += char;
      }
      if (char === '.') {
        value += '.';
        while (isDigit(char = this.read())) {
          value += char;
        }
      }
      return new Token(TokenKind.FLOAT, value, start, this.cursorValue.index);
    }

    if (isWordStart(char)) {
      let word = '';
      do {
        word += char;
      } while (isWordContinuation(char = this.read()));

      const normalized = word.toLowerCase();
      switch (normalized) {
        case 'break':
          return new Token(TokenKind.BREAK, null, start, this.cursorValue.index);
        case 'continue':
          return new Token(TokenKind.CONTINUE, null, start, this.cursorValue.index);
        case 'return':
          return new Token(TokenKind.RETURN, null, start, this.cursorValue.index);
        case 'true':
          return new Token(TokenKind.TRUE, null, start, this.cursorValue.index);
        case 'false':
          return new Token(TokenKind.FALSE, null, start, this.cursorValue.index);
        default:
          return new Token(TokenKind.IDENTIFIER, normalized, start, this.cursorValue.index);
      }
    }

    if (char === '\'') {
      let value = '';
      while (true) {
        char = this.read();
        if (char === null) {
          return new Token(TokenKind.ERROR, 'Found end-of-file before closing quote', start, this.cursorValue.index);
        }
        if (char === '\'') {
          break;
        }
        value += char;
      }
      this.read();
      return new Token(TokenKind.STRING, value, start, this.cursorValue.index);
    }

    let kind: TokenKind;
    let value: string | null = null;
    let checkedContinuation = false;

    switch (char) {
      case '!': {
        checkedContinuation = true;
        const c1 = this.read();
        if (c1 === '=') {
          this.read();
          kind = TokenKind.BANGEQ;
        } else {
          kind = TokenKind.BANG;
        }
        break;
      }
      case '&': {
        checkedContinuation = true;
        const c1 = this.read();
        if (c1 === '&') {
          this.read();
          kind = TokenKind.AMPAMP;
        } else {
          kind = TokenKind.ERROR;
          value = `Unexpected token '${displayChar(c1)}', expected '&' (Molang doesn't support bitwise operators)`;
        }
        break;
      }
      case '|': {
        checkedContinuation = true;
        const c1 = this.read();
        if (c1 === '|') {
          this.read();
          kind = TokenKind.BARBAR;
        } else {
          kind = TokenKind.ERROR;
          value = `Unexpected token '${displayChar(c1)}', expected '|' (Molang doesn't support bitwise operators)`;
        }
        break;
      }
      case '<': {
        checkedContinuation = true;
        const c1 = this.read();
        if (c1 === '=') {
          this.read();
          kind = TokenKind.LTE;
        } else {
          kind = TokenKind.LT;
        }
        break;
      }
      case '>': {
        checkedContinuation = true;
        const c1 = this.read();
        if (c1 === '=') {
          this.read();
          kind = TokenKind.GTE;
        } else {
          kind = TokenKind.GT;
        }
        break;
      }
      case '=': {
        checkedContinuation = true;
        const c1 = this.read();
        if (c1 === '=') {
          this.read();
          kind = TokenKind.EQEQ;
        } else {
          kind = TokenKind.EQ;
        }
        break;
      }
      case '-': {
        checkedContinuation = true;
        const c1 = this.read();
        if (c1 === '>') {
          this.read();
          kind = TokenKind.ARROW;
        } else {
          kind = TokenKind.SUB;
        }
        break;
      }
      case '?': {
        checkedContinuation = true;
        const c1 = this.read();
        if (c1 === '?') {
          this.read();
          kind = TokenKind.QUESQUES;
        } else {
          kind = TokenKind.QUES;
        }
        break;
      }
      case '/': kind = TokenKind.SLASH; break;
      case '*': kind = TokenKind.STAR; break;
      case '+': kind = TokenKind.PLUS; break;
      case ',': kind = TokenKind.COMMA; break;
      case '.': kind = TokenKind.DOT; break;
      case '(': kind = TokenKind.LPAREN; break;
      case ')': kind = TokenKind.RPAREN; break;
      case '{': kind = TokenKind.LBRACE; break;
      case '}': kind = TokenKind.RBRACE; break;
      case ':': kind = TokenKind.COLON; break;
      case '[': kind = TokenKind.LBRACKET; break;
      case ']': kind = TokenKind.RBRACKET; break;
      case ';': kind = TokenKind.SEMICOLON; break;
      default:
        kind = TokenKind.ERROR;
        value = `Unexpected token '${char}': invalid token`;
        break;
    }

    if (!checkedContinuation) {
      this.read();
    }
    return new Token(kind, value, start, this.cursorValue.index);
  }

  private read(): string | null {
    this.nextIndex++;
    const char = this.nextIndex < this.source.length ? this.source[this.nextIndex] : null;
    this.cursorValue.push(char);
    this.nextCharValue = char;
    return char;
  }
}
