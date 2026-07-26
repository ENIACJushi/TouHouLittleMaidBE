import {
  AssignableVariable,
  isAssignableVariable,
  isMolangFunction,
  isVariable,
  MolangArgumentCollection,
  MolangFunction,
  Variable,
} from './runtime-types';

/** 所有 Molang AST 节点的基础接口。 */
export interface Expression {
  /** 使用访问者处理当前表达式；求值、格式化、转换都通过该入口实现。 */
  visit<R>(visitor: ExpressionVisitor<R>): R;
}

/**
 * 表达式访问者。
 *
 * 新增一种 AST 后，应在这里增加对应访问方法，并在运行时或转换器中实现它。
 */
export interface ExpressionVisitor<R> {
  visit(expression: Expression): R;
  visitDouble(expression: DoubleExpression): R;
  visitString(expression: StringExpression): R;
  visitIdentifier(expression: IdentifierExpression): R;
  visitVariable(expression: VariableExpression): R;
  visitAssignableVariable(expression: AssignableVariableExpression): R;
  visitStruct(expression: StructAccessExpression): R;
  visitTernaryConditional(expression: TernaryConditionalExpression): R;
  visitUnary(expression: UnaryExpression): R;
  visitExecutionScope(expression: ExecutionScopeExpression): R;
  buildExecutionScopeFunction(expression: ExecutionScopeExpression): MolangFunction;
  visitBinary(expression: BinaryExpression): R;
  visitCall(expression: CallExpression): R;
  visitStatement(expression: StatementExpression): R;
}

/** 数字字面量表达式；Molang 中布尔值也会被解析成 0 或 1。 */
export class DoubleExpression implements Expression {
  static readonly ZERO = new DoubleExpression(0);
  static readonly ONE = new DoubleExpression(1);

  constructor(public readonly value: number) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitDouble(this);
  }

  toString(): string {
    return `Double(${this.value})`;
  }
}

/** 单引号字符串字面量表达式。 */
export class StringExpression implements Expression {
  constructor(public readonly value: string) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitString(this);
  }

  toString(): string {
    return `String('${this.value}')`;
  }
}

/**
 * 标识符表达式。
 *
 * 解析阶段会立即将标识符绑定到目标对象；如果目标是常量或变量，会被转换成更具体的表达式。
 */
export class IdentifierExpression implements Expression {
  private constructor(public readonly name: string, public readonly target: unknown) {
    this.name = name.toLowerCase();
  }

  /** 根据绑定目标类型选择最合适的 AST 节点。 */
  static get(name: string, target: unknown): Expression {
    if (typeof target === 'number') {
      return new DoubleExpression(target);
    }
    if (typeof target === 'string') {
      return new StringExpression(target);
    }
    if (isAssignableVariable(target)) {
      return new AssignableVariableExpression(target);
    }
    if (isVariable(target)) {
      return new VariableExpression(target);
    }
    if (isMolangFunction(target)) {
      return new IdentifierExpression(name, target);
    }
    return new IdentifierExpression(name, target);
  }

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitIdentifier(this);
  }

  toString(): string {
    return `Identifier(${this.name})`;
  }
}

/** 只读变量表达式，求值时从 `Variable.evaluate` 读取。 */
export class VariableExpression implements Expression {
  constructor(public readonly target: Variable) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitVariable(this);
  }

  toString(): string {
    return String(this.target);
  }
}

/** 可写变量表达式，可作为赋值语句左值。 */
export class AssignableVariableExpression implements Expression {
  constructor(public readonly target: AssignableVariable) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitAssignableVariable(this);
  }

  toString(): string {
    return String(this.target);
  }
}

/**
 * 结构体字段访问表达式。
 *
 * 例如 `variable.tmp.x` 在 `variable.tmp` 返回 Struct 时，会通过该节点访问 `x` 字段。
 */
export class StructAccessExpression implements Expression {
  public readonly path: string;

  constructor(public readonly left: Expression, path: string) {
    this.path = path.toLowerCase();
  }

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitStruct(this);
  }
}

/** 二元运算类型；优先级定义见 `BINARY_PRECEDENCE`。 */
export enum BinaryOp {
  AND = 'AND',
  OR = 'OR',
  LT = 'LT',
  LTE = 'LTE',
  GT = 'GT',
  GTE = 'GTE',
  ADD = 'ADD',
  SUB = 'SUB',
  MUL = 'MUL',
  DIV = 'DIV',
  ARROW = 'ARROW',
  NULL_COALESCE = 'NULL_COALESCE',
  ASSIGN = 'ASSIGN',
  CONDITIONAL = 'CONDITIONAL',
  EQ = 'EQ',
  NEQ = 'NEQ',
}

const BINARY_PRECEDENCE: Record<BinaryOp, number> = {
  [BinaryOp.AND]: 1800,
  [BinaryOp.OR]: 1600,
  [BinaryOp.LT]: 2200,
  [BinaryOp.LTE]: 2200,
  [BinaryOp.GT]: 2200,
  [BinaryOp.GTE]: 2200,
  [BinaryOp.ADD]: 2400,
  [BinaryOp.SUB]: 2400,
  [BinaryOp.MUL]: 2600,
  [BinaryOp.DIV]: 2600,
  [BinaryOp.ARROW]: 3000,
  [BinaryOp.NULL_COALESCE]: 1200,
  [BinaryOp.ASSIGN]: 1,
  [BinaryOp.CONDITIONAL]: 1400,
  [BinaryOp.EQ]: 2000,
  [BinaryOp.NEQ]: 2000,
};

export const binaryPrecedence = (op: BinaryOp): number => BINARY_PRECEDENCE[op];

export class BinaryExpression implements Expression {
  constructor(
    public readonly op: BinaryOp,
    public readonly left: Expression,
    public readonly right: Expression,
  ) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitBinary(this);
  }

  toString(): string {
    return `${this.op}(${this.left}, ${this.right})`;
  }
}

export enum UnaryOp {
  LOGICAL_NEGATION = 'LOGICAL_NEGATION',
  ARITHMETICAL_NEGATION = 'ARITHMETICAL_NEGATION',
  PLUS = 'PLUS',
  RETURN = 'RETURN',
}

const UNARY_PRECEDENCE: Record<UnaryOp, number> = {
  [UnaryOp.LOGICAL_NEGATION]: 2800,
  [UnaryOp.ARITHMETICAL_NEGATION]: 2800,
  [UnaryOp.PLUS]: 2800,
  [UnaryOp.RETURN]: -1,
};

export const unaryPrecedence = (op: UnaryOp): number => UNARY_PRECEDENCE[op];

export class UnaryExpression implements Expression {
  constructor(public readonly op: UnaryOp, public readonly expression: Expression) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitUnary(this);
  }

  toString(): string {
    return `Unary(${this.op})(${this.expression})`;
  }
}

export class TernaryConditionalExpression implements Expression {
  constructor(
    public readonly condition: Expression,
    public readonly trueExpression: Expression,
    public readonly falseExpression: Expression,
  ) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitTernaryConditional(this);
  }

  toString(): string {
    return `TernaryCondition(${this.condition}, ${this.trueExpression}, ${this.falseExpression})`;
  }
}

export class ExecutionScopeExpression implements Expression {
  constructor(public readonly expressions: Expression[]) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitExecutionScope(this);
  }

  buildFunction(visitor: ExpressionVisitor<unknown>): MolangFunction {
    return visitor.buildExecutionScopeFunction(this);
  }

  toString(): string {
    return `ExecutionScope(${this.expressions})`;
  }
}

export enum StatementOp {
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
}

export class StatementExpression implements Expression {
  constructor(public readonly op: StatementOp) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitStatement(this);
  }
}

export class CallExpression implements Expression {
  constructor(
    public readonly functionTarget: MolangFunction,
    public readonly argumentCollection: MolangArgumentCollection,
  ) {}

  visit<R>(visitor: ExpressionVisitor<R>): R {
    return visitor.visitCall(this);
  }

  toString(): string {
    return `Call(${this.functionTarget}, ${this.argumentCollection})`;
  }
}
