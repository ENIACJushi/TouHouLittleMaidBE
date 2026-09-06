import {
  AssignableVariableExpression,
  BinaryExpression,
  BinaryOp,
  CallExpression,
  DoubleExpression,
  ExecutionScopeExpression,
  Expression,
  ExpressionVisitor,
  IdentifierExpression,
  StatementExpression,
  StatementOp,
  StringExpression,
  StructAccessExpression,
  TernaryConditionalExpression,
  UnaryExpression,
  UnaryOp,
  VariableExpression,
} from './ast';
import {
  AssignableVariable,
  createMolangFunction,
  ExecutionContext,
  HashMapStruct,
  isStruct,
  MolangArgumentCollection,
  MolangFunction,
  MolangValue,
  Variable,
} from './runtime-types';
import {isNil} from './types';

/**
 * Molang 运行时类型转换规则。
 *
 * 与 Java 版保持一致：`null` 视为 0 / false，非数字对象在数值上下文中视为 1。
 */
export class ValueConversions {
  static asBoolean(value: MolangValue): boolean {
    if (isNil(value)) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return true;
  }

  static asFloat(value: MolangValue): number {
    if (isNil(value)) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return 1;
  }

  static asInt(value: MolangValue): number {
    return Math.trunc(ValueConversions.asFloat(value));
  }

  static asDouble(value: MolangValue): number {
    return ValueConversions.asFloat(value);
  }

  static asString(value: MolangValue): string | null {
    return typeof value === 'string' ? value : null;
  }
}

/**
 * 函数实参集合。
 *
 * 保存的是未求值 AST，函数实现可以选择按需读取，支持 `loop` 这类需要执行代码块的函数。
 */
export class FunctionArgumentCollection implements MolangArgumentCollection {
  static readonly EMPTY = new FunctionArgumentCollection([]);

  constructor(private readonly argumentsValue: Expression[]) {}

  size(): number {
    return this.argumentsValue.length;
  }

  getAsString(ctx: ExecutionContext, index: number): string | null {
    return ValueConversions.asString(ctx.eval(this.argumentsValue[index]));
  }

  getAsDouble(ctx: ExecutionContext, index: number): number {
    return ValueConversions.asDouble(ctx.eval(this.argumentsValue[index]));
  }

  getAsInt(ctx: ExecutionContext, index: number): number {
    return ValueConversions.asInt(ctx.eval(this.argumentsValue[index]));
  }

  getAsFloat(ctx: ExecutionContext, index: number): number {
    return ValueConversions.asFloat(ctx.eval(this.argumentsValue[index]));
  }

  getAsBoolean(ctx: ExecutionContext, index: number): boolean {
    return ValueConversions.asBoolean(ctx.eval(this.argumentsValue[index]));
  }

  getValue(ctx: ExecutionContext, index: number): MolangValue {
    return ctx.eval(this.argumentsValue[index]);
  }

  getExpression(index: number): Expression {
    return this.argumentsValue[index];
  }
}

/** 表达式求值器接口，同时也是 AST 访问者。 */
export interface ExpressionEvaluator<TEntity = unknown> extends ExecutionContext<TEntity>, ExpressionVisitor<MolangValue> {
  createChild(): ExpressionEvaluator<TEntity>;
  createChild<TNewEntity>(entity: TNewEntity | null | undefined): ExpressionEvaluator<TNewEntity>;
  popReturnValue(): MolangValue;
}

/**
 * 默认表达式求值器。
 *
 * 它按访问者模式递归执行 AST，并维护当前执行作用域中的 `return` / `break` / `continue` 状态。
 */
export class ExpressionEvaluatorImpl<TEntity = unknown> implements ExpressionEvaluator<TEntity> {
  /** 临时返回值栈顶；执行作用域每条语句后会读取并清空。 */
  private returnValue: MolangValue = null;

  constructor(private readonly entityValue: TEntity | null | undefined = null) {}

  static evaluator<TEntity = unknown>(entity?: TEntity | null): ExpressionEvaluator<TEntity> {
    return new ExpressionEvaluatorImpl(entity);
  }

  entity(): TEntity | null | undefined {
    return this.entityValue;
  }

  eval(expression: Expression): MolangValue {
    return expression.visit(this);
  }

  createChild(): ExpressionEvaluator<TEntity>;
  createChild<TNewEntity>(entity: TNewEntity | null | undefined): ExpressionEvaluator<TNewEntity>;
  createChild<TNewEntity>(entity?: TNewEntity | null): ExpressionEvaluator<TEntity> | ExpressionEvaluator<TNewEntity> {
    if (arguments.length === 0) {
      return new ExpressionEvaluatorImpl(this.entityValue);
    }
    return new ExpressionEvaluatorImpl(entity);
  }

  popReturnValue(): MolangValue {
    const value = this.returnValue;
    this.returnValue = null;
    return value;
  }

  visit(expression: Expression): MolangValue {
    throw new Error(`Unsupported expression type: ${expression}`);
  }

  visitCall(expression: CallExpression): MolangValue {
    return expression.functionTarget.evaluate(this, expression.argumentCollection);
  }

  visitDouble(expression: DoubleExpression): MolangValue {
    return expression.value;
  }

  visitString(expression: StringExpression): MolangValue {
    return expression.value;
  }

  visitExecutionScope(executionScope: ExecutionScopeExpression): MolangValue {
    return this.buildExecutionScopeFunction(executionScope).evaluate(this, FunctionArgumentCollection.EMPTY);
  }

  buildExecutionScopeFunction(executionScope: ExecutionScopeExpression): MolangFunction {
    const expressions = executionScope.expressions;
    const evaluatorForThisScope = this.createChild();
    return createMolangFunction(() => {
      let lastResult: MolangValue = null;
      for (const expression of expressions) {
        lastResult = evaluatorForThisScope.eval(expression);
        const returnValue = evaluatorForThisScope.popReturnValue();
        if (!isNil(returnValue)) {
          return returnValue;
        }
      }
      return lastResult;
    });
  }

  visitIdentifier(expression: IdentifierExpression): MolangValue {
    throw new Error(`Unknown identifier type: ${expression.name}`);
  }

  visitVariable(expression: VariableExpression): MolangValue {
    return expression.target.evaluate(this);
  }

  visitAssignableVariable(expression: AssignableVariableExpression): MolangValue {
    return expression.target.evaluate(this);
  }

  visitStruct(expression: StructAccessExpression): MolangValue {
    const value = expression.left.visit(this);
    return isStruct(value) ? value.getProperty(expression.path) : null;
  }

  visitBinary(expression: BinaryExpression): MolangValue {
    const left = expression.left;
    const right = expression.right;

    switch (expression.op) {
      case BinaryOp.AND:
        return ValueConversions.asBoolean(left.visit(this)) && ValueConversions.asBoolean(right.visit(this));
      case BinaryOp.OR:
        return ValueConversions.asBoolean(left.visit(this)) || ValueConversions.asBoolean(right.visit(this));
      case BinaryOp.LT:
        return ValueConversions.asFloat(left.visit(this)) < ValueConversions.asFloat(right.visit(this));
      case BinaryOp.LTE:
        return ValueConversions.asFloat(left.visit(this)) <= ValueConversions.asFloat(right.visit(this));
      case BinaryOp.GT:
        return ValueConversions.asFloat(left.visit(this)) > ValueConversions.asFloat(right.visit(this));
      case BinaryOp.GTE:
        return ValueConversions.asFloat(left.visit(this)) >= ValueConversions.asFloat(right.visit(this));
      case BinaryOp.ADD:
        return ValueConversions.asFloat(left.visit(this)) + ValueConversions.asFloat(right.visit(this));
      case BinaryOp.SUB:
        return ValueConversions.asFloat(left.visit(this)) - ValueConversions.asFloat(right.visit(this));
      case BinaryOp.MUL:
        return ValueConversions.asFloat(left.visit(this)) * ValueConversions.asFloat(right.visit(this));
      case BinaryOp.DIV: {
        const dividend = ValueConversions.asFloat(left.visit(this));
        const divisor = ValueConversions.asFloat(right.visit(this));
        return divisor === 0 ? 0 : dividend / divisor;
      }
      case BinaryOp.ARROW: {
        const value = left.visit(this);
        return isNil(value) ? null : right.visit(this.createChild(value));
      }
      case BinaryOp.NULL_COALESCE: {
        const value = left.visit(this);
        return isNil(value) ? right.visit(this) : value;
      }
      case BinaryOp.ASSIGN:
        return this.evaluateAssign(left, right);
      case BinaryOp.CONDITIONAL:
        return ValueConversions.asBoolean(left.visit(this)) ? right.visit(this) : null;
      case BinaryOp.EQ:
        return this.evaluateEquals(left.visit(this), right.visit(this));
      case BinaryOp.NEQ:
        return !this.evaluateEquals(left.visit(this), right.visit(this));
      default:
        throw new Error(`Unknown binary operation: ${expression.op}`);
    }
  }

  visitUnary(expression: UnaryExpression): MolangValue {
    const value = expression.expression.visit(this);
    switch (expression.op) {
      case UnaryOp.LOGICAL_NEGATION:
        return !ValueConversions.asBoolean(value);
      case UnaryOp.ARITHMETICAL_NEGATION:
        return -ValueConversions.asFloat(value);
      case UnaryOp.PLUS:
        return ValueConversions.asFloat(value);
      case UnaryOp.RETURN:
        this.returnValue = value;
        return 0;
      default:
        throw new Error(`Unknown unary operation: ${expression.op}`);
    }
  }

  visitStatement(expression: StatementExpression): MolangValue {
    switch (expression.op) {
      case StatementOp.BREAK:
        this.returnValue = StatementOp.BREAK;
        break;
      case StatementOp.CONTINUE:
        this.returnValue = StatementOp.CONTINUE;
        break;
    }
    return null;
  }

  visitTernaryConditional(expression: TernaryConditionalExpression): MolangValue {
    return ValueConversions.asBoolean(expression.condition.visit(this))
      ? expression.trueExpression.visit(this)
      : expression.falseExpression.visit(this);
  }

  private evaluateAssign(left: Expression, right: Expression): MolangValue {
    let value = right.visit(this);
    if (left instanceof AssignableVariableExpression) {
      if (isStruct(value)) {
        value = value.copy();
      }
      left.target.assign(this, value);
    } else if (left instanceof StructAccessExpression) {
      if (isStruct(value)) {
        return value;
      }
      const target = left.left.visit(this);
      if (isNil(target)) {
        if (left.left instanceof AssignableVariableExpression) {
          const struct = new HashMapStruct();
          struct.putProperty(left.path, value);
          left.left.target.assign(this, struct);
        }
      } else if (isStruct(target)) {
        target.putProperty(left.path, value);
      }
    }
    return value;
  }

  private evaluateEquals(left: MolangValue, right: MolangValue): boolean {
    if (left === right) return true;
    if (isNil(right)) return false;
    if (typeof right === 'number') {
      return ValueConversions.asFloat(right) === ValueConversions.asFloat(left);
    }
    if (typeof right === 'string') {
      return right === left;
    }
    return false;
  }
}

const MAX_LOOP_ROUND = 1024;

export class StandardBindings {
  static readonly LOOP_FUNC = createMolangFunction((ctx, args) => {
    if (args.size() < 2) return null;

    const rounds = Math.min(Math.round(args.getAsDouble(ctx, 0)), MAX_LOOP_ROUND);
    const expression = args.getExpression(1);
    if (expression instanceof ExecutionScopeExpression) {
      const callable = expression.buildFunction(ctx as unknown as ExpressionVisitor<unknown>);
      for (let i = 0; i < rounds; i++) {
        const value = callable.evaluate(ctx, FunctionArgumentCollection.EMPTY);
        if (value === StatementOp.BREAK) break;
      }
    }
    return null;
  });

  static readonly FOR_EACH_FUNC = createMolangFunction((ctx, args) => {
    if (args.size() < 3) return null;

    const variableExpression = args.getExpression(0);
    if (!(variableExpression instanceof AssignableVariableExpression)) return null;

    const variableAccess = variableExpression.target;
    const array = args.getValue(ctx, 1);
    const iterable = StandardBindings.asIterable(array);
    if (!iterable) return null;

    const expression = args.getExpression(2);
    if (expression instanceof ExecutionScopeExpression) {
      const callable = expression.buildFunction(ctx as unknown as ExpressionVisitor<unknown>);
      for (const value of iterable) {
        variableAccess.assign(ctx, value);
        const returnValue = callable.evaluate(ctx, FunctionArgumentCollection.EMPTY);
        if (returnValue === StatementOp.BREAK) break;
      }
    }
    return null;
  });

  private static asIterable(value: MolangValue): Iterable<unknown> | null {
    if (Array.isArray(value)) return value;
    if (!!value && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function') {
      return value as Iterable<unknown>;
    }
    return null;
  }
}

export const createVariable = (evaluate: (context: ExecutionContext) => MolangValue): Variable => ({evaluate});

export const createAssignableVariable = (
  evaluate: (context: ExecutionContext) => MolangValue,
  assign: (context: ExecutionContext, value: MolangValue) => void,
): AssignableVariable => ({evaluate, assign});
