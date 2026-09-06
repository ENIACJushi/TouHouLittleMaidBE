import {
  BinaryExpression,
  BinaryOp,
  binaryPrecedence,
  CallExpression,
  DoubleExpression,
  ExecutionScopeExpression,
  Expression,
  IdentifierExpression,
  StatementExpression,
  StatementOp,
  StringExpression,
  StructAccessExpression,
  TernaryConditionalExpression,
  UnaryExpression,
  UnaryOp,
  unaryPrecedence,
} from './ast';
import {MolangLexer} from './lexer';
import {FunctionArgumentCollection} from './runtime';
import {isMolangFunction, isObjectBinding, ObjectBinding} from './runtime-types';
import {ParseException, Token, TokenKind} from './types';

// `?` / `?:` 使用独立优先级，保证嵌套三元表达式按 Java 版逻辑从右向左结合。
const PRECEDENCE_QUES = 1400;
const UNSET = Symbol('unset');

/**
 * Molang 语法分析器。
 *
 * 使用 Pratt / precedence climbing 方式解析表达式，输出可被访问者执行或转换的 AST。
 * 标识符会在解析阶段通过 `ObjectBinding` 绑定到变量、函数或命名空间。
 */
export class MolangParser {
  /** 最近一次 `next()` 返回的表达式；用 UNSET 区分“未读取”和“读到 EOF”。 */
  private currentExpression: Expression | null | typeof UNSET = UNSET;

  constructor(private readonly lexerValue: MolangLexer, private readonly binding: ObjectBinding) {}

  /** 从字符串或已有 lexer 创建 parser。 */
  static parser(source: string | MolangLexer, binding: ObjectBinding): MolangParser {
    return new MolangParser(typeof source === 'string' ? MolangLexer.lexer(source) : source, binding);
  }

  /** 解析完整源码，直到 EOF。 */
  static parseAll(source: string, binding: ObjectBinding): Expression[] {
    return MolangParser.parser(source, binding).parseAll();
  }

  lexer(): MolangLexer {
    return this.lexerValue;
  }

  current(): Expression | null {
    if (this.currentExpression === UNSET) {
      throw new Error('No current parsed expression, call next() at least once!');
    }
    return this.currentExpression;
  }

  next(): Expression | null {
    const expression = this.nextExpression();
    this.currentExpression = expression;
    return expression;
  }

  parseAll(): Expression[] {
    const expressions: Expression[] = [];
    let expression: Expression | null;
    while ((expression = this.next()) !== null) {
      expressions.push(expression);
    }
    return expressions;
  }

  close(): void {
    this.lexerValue.close();
  }

  /**
   * 解析一个无需左值的基础表达式。
   *
   * 包括字面量、括号表达式、执行作用域、关键字语句、标识符和一元表达式。
   */
  private parseSingle(lexer: MolangLexer): Expression {
    let token = lexer.current();
    switch (token.kind) {
      case TokenKind.FLOAT: {
        lexer.next();
        const value = Number(token.value);
        if (Number.isNaN(value)) {
          throw new ParseException(`Invalid number literal: ${token.value}`, lexer.cursor());
        }
        return new DoubleExpression(value);
      }
      case TokenKind.STRING:
        lexer.next();
        return new StringExpression(token.value ?? '');
      case TokenKind.TRUE:
        lexer.next();
        return DoubleExpression.ONE;
      case TokenKind.FALSE:
        lexer.next();
        return DoubleExpression.ZERO;
      case TokenKind.LPAREN: {
        lexer.next();
        const expression = this.parseCompoundExpression(lexer, 0);
        token = lexer.current();
        if (token.kind !== TokenKind.RPAREN) {
          throw new ParseException('Non closed expression', lexer.cursor());
        }
        lexer.next();
        return expression;
      }
      case TokenKind.LBRACE: {
        lexer.next();
        const expressions: Expression[] = [];
        while (true) {
          if (lexer.current().kind === TokenKind.RBRACE) {
            lexer.next();
            break;
          }
          expressions.push(this.parseCompoundExpression(lexer, 0));
          token = lexer.current();
          if (token.kind === TokenKind.RBRACE) {
            lexer.next();
            break;
          }
          if (token.kind === TokenKind.EOF) {
            throw new ParseException('Found the end before the execution scope closing token', lexer.cursor());
          }
          if (token.kind === TokenKind.ERROR) {
            throw new ParseException(`Found an invalid token (error): ${token.value}`, lexer.cursor());
          }
          if (token.kind !== TokenKind.SEMICOLON) {
            throw new ParseException('Missing semicolon', lexer.cursor());
          }
          lexer.next();
        }
        return new ExecutionScopeExpression(expressions);
      }
      case TokenKind.BREAK:
        lexer.next();
        return new StatementExpression(StatementOp.BREAK);
      case TokenKind.CONTINUE:
        lexer.next();
        return new StatementExpression(StatementOp.CONTINUE);
      case TokenKind.IDENTIFIER:
        return this.parseIdentifier(lexer, token);
      case TokenKind.PLUS:
        lexer.next();
        return this.parseCompoundExpression(lexer, unaryPrecedence(UnaryOp.PLUS));
      case TokenKind.SUB:
        lexer.next();
        return new UnaryExpression(
          UnaryOp.ARITHMETICAL_NEGATION,
          this.parseCompoundExpression(lexer, unaryPrecedence(UnaryOp.ARITHMETICAL_NEGATION)),
        );
      case TokenKind.BANG:
        lexer.next();
        return new UnaryExpression(
          UnaryOp.LOGICAL_NEGATION,
          this.parseCompoundExpression(lexer, unaryPrecedence(UnaryOp.LOGICAL_NEGATION)),
        );
      case TokenKind.RETURN:
        lexer.next();
        return new UnaryExpression(UnaryOp.RETURN, this.parseCompoundExpression(lexer, unaryPrecedence(UnaryOp.RETURN)));
      default:
        throw new ParseException('Expected an expression.', lexer.cursor());
    }
  }

  /**
   * 解析标识符及第一层命名空间访问。
   *
   * Java 版在 parse 阶段解析 `math.sin` 这类绑定；后续 `.field` 会作为 Struct 字段访问处理。
   */
  private parseIdentifier(lexer: MolangLexer, token: Token): Expression {
    let lastTarget = this.binding.getProperty(token.value ?? '');
    if (lastTarget === null || lastTarget === undefined) {
      throw new ParseException(`Failed to get property: ${token.value}`, lexer.cursor());
    }

    let expression = IdentifierExpression.get(token.value ?? '', lastTarget);
    token = lexer.next();

    if (token.kind === TokenKind.DOT) {
      token = lexer.next();
      if (token.kind !== TokenKind.IDENTIFIER) {
        throw new ParseException('Unexpected token, expected a valid field token', lexer.cursor());
      }
      if (!isObjectBinding(lastTarget)) {
        throw new ParseException(`Illegal access to : ${token.value}`, lexer.cursor());
      }
      lastTarget = lastTarget.getProperty(token.value ?? '');
      if (lastTarget === null || lastTarget === undefined) {
        throw new ParseException(`Failed to get property: ${token.value}`, lexer.cursor());
      }
      expression = IdentifierExpression.get(token.value ?? '', lastTarget);
      lexer.next();
    }

    return expression;
  }

  private parseCompoundExpression(lexer: MolangLexer, lastPrecedence: number): Expression {
    let expression = this.parseSingle(lexer);
    while (true) {
      const compoundExpression = this.parseCompound(lexer, expression, lastPrecedence);
      const current = lexer.current();
      if (current.kind === TokenKind.EOF || current.kind === TokenKind.SEMICOLON) {
        return compoundExpression;
      }
      if (compoundExpression === expression) {
        return expression;
      }
      expression = compoundExpression;
    }
  }

  private parseCompound(lexer: MolangLexer, left: Expression, lastPrecedence: number): Expression {
    let current = lexer.current();
    switch (current.kind) {
      case TokenKind.RPAREN:
      case TokenKind.EOF:
        return left;
      case TokenKind.LPAREN:
        return this.parseCallOrImplicitMultiply(lexer, left, lastPrecedence);
      case TokenKind.QUES:
        return this.parseQuestion(lexer, left, lastPrecedence);
    }

    if (current.kind === TokenKind.DOT) {
      current = lexer.next();
      if (current.kind !== TokenKind.IDENTIFIER) {
        throw new ParseException('Expect a identifier after struct access operator', lexer.cursor());
      }
      lexer.next();
      return new StructAccessExpression(left, current.value ?? '');
    }

    const op = this.binaryOpFromToken(current.kind);
    if (!op) return left;

    const precedence = binaryPrecedence(op);
    if (lastPrecedence >= precedence) {
      return left;
    }

    lexer.next();
    return new BinaryExpression(op, left, this.parseCompoundExpression(lexer, precedence));
  }

  private parseCallOrImplicitMultiply(lexer: MolangLexer, left: Expression, lastPrecedence: number): Expression {
    if (left instanceof IdentifierExpression) {
      lexer.next();
      const argumentsValue: Expression[] = [];

      if (lexer.current().kind === TokenKind.RPAREN) {
        lexer.next();
      } else {
        while (true) {
          argumentsValue.push(this.parseCompoundExpression(lexer, 0));
          const current = lexer.current();
          if (current.kind === TokenKind.EOF) {
            throw new ParseException('Found EOF before closing RPAREN', null);
          }
          if (current.kind === TokenKind.RPAREN) {
            lexer.next();
            break;
          }
          if (current.kind !== TokenKind.COMMA) {
            throw new ParseException('Expected a comma', lexer.cursor());
          }
          lexer.next();
        }
      }

      if (isMolangFunction(left.target)) {
        const validate = left.target.validateArgumentSize;
        if (validate && !validate(argumentsValue.length)) {
          throw new ParseException(`Function call to "${left.name}" has illegal parameter size`, null);
        }
        return new CallExpression(left.target, new FunctionArgumentCollection(argumentsValue));
      }
      throw new ParseException(`"${left.name}" is not a function`, null);
    }

    if (lastPrecedence >= binaryPrecedence(BinaryOp.MUL)) {
      return left;
    }
    return new BinaryExpression(BinaryOp.MUL, left, this.parseCompoundExpression(lexer, binaryPrecedence(BinaryOp.MUL)));
  }

  private parseQuestion(lexer: MolangLexer, left: Expression, lastPrecedence: number): Expression {
    if (lastPrecedence > PRECEDENCE_QUES) {
      return left;
    }

    lexer.next();
    const trueValue = this.parseCompoundExpression(lexer, PRECEDENCE_QUES);
    if (lexer.current().kind === TokenKind.COLON) {
      lexer.next();
      return new TernaryConditionalExpression(left, trueValue, this.parseCompoundExpression(lexer, PRECEDENCE_QUES));
    }
    return new BinaryExpression(BinaryOp.CONDITIONAL, left, trueValue);
  }

  private binaryOpFromToken(kind: TokenKind): BinaryOp | null {
    switch (kind) {
      case TokenKind.AMPAMP: return BinaryOp.AND;
      case TokenKind.BARBAR: return BinaryOp.OR;
      case TokenKind.LT: return BinaryOp.LT;
      case TokenKind.LTE: return BinaryOp.LTE;
      case TokenKind.GT: return BinaryOp.GT;
      case TokenKind.GTE: return BinaryOp.GTE;
      case TokenKind.PLUS: return BinaryOp.ADD;
      case TokenKind.SUB: return BinaryOp.SUB;
      case TokenKind.STAR: return BinaryOp.MUL;
      case TokenKind.SLASH: return BinaryOp.DIV;
      case TokenKind.QUESQUES: return BinaryOp.NULL_COALESCE;
      case TokenKind.EQ: return BinaryOp.ASSIGN;
      case TokenKind.EQEQ: return BinaryOp.EQ;
      case TokenKind.BANGEQ: return BinaryOp.NEQ;
      case TokenKind.ARROW: return BinaryOp.ARROW;
      default: return null;
    }
  }

  private nextExpression(): Expression | null {
    let token = this.lexerValue.next();
    if (token.kind === TokenKind.EOF) {
      return null;
    }
    if (token.kind === TokenKind.ERROR) {
      throw new ParseException(`Found an invalid token (error): ${token.value}`, this.lexerValue.cursor());
    }

    const expression = this.parseCompoundExpression(this.lexerValue, -10);
    token = this.lexerValue.current();
    if (token.kind !== TokenKind.EOF && token.kind !== TokenKind.SEMICOLON) {
      throw new ParseException(`Expected a semicolon, but was ${token.toString()}`, this.lexerValue.cursor());
    }
    return expression;
  }
}
