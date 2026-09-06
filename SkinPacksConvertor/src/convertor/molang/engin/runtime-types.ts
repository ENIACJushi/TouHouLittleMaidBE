/** Molang 运行时值。可为 number、string、boolean、Struct、数组、对象或 null。 */
export type MolangValue = unknown;

/**
 * 表达式执行上下文。
 *
 * `entity` 用于承载外部宿主对象，例如动画实体、模型实例或转换过程中的临时对象。
 */
export interface ExecutionContext<TEntity = unknown> {
  entity(): TEntity | null | undefined;
  eval(expression: unknown): MolangValue;
}

/** 函数参数集合，内部保存原始 AST 参数，并在读取时按需求值。 */
export interface MolangArgumentCollection {
  size(): number;
  getAsString(ctx: ExecutionContext, index: number): string | null;
  getAsDouble(ctx: ExecutionContext, index: number): number;
  getAsInt(ctx: ExecutionContext, index: number): number;
  getAsFloat(ctx: ExecutionContext, index: number): number;
  getAsBoolean(ctx: ExecutionContext, index: number): boolean;
  getValue(ctx: ExecutionContext, index: number): MolangValue;
  getExpression(index: number): unknown;
}

export interface MolangFunction {
  readonly __molangFunction: true;
  evaluate(context: ExecutionContext, args: MolangArgumentCollection): MolangValue;
  validateArgumentSize?(size: number): boolean;
}

export interface Variable {
  evaluate(context: ExecutionContext): MolangValue;
}

export interface AssignableVariable extends Variable {
  assign(context: ExecutionContext, value: MolangValue): void;
}

export interface ObjectBinding {
  getProperty(name: string): MolangValue;
}

export interface Struct {
  getProperty(name: string): MolangValue;
  putProperty(name: string, value: MolangValue): void;
  copy(): Struct;
}

export class HashMapStruct implements Struct {
  private readonly properties: Map<string, MolangValue>;

  constructor(private readonly isRightValue = false, properties?: Map<string, MolangValue>) {
    this.properties = properties ?? new Map<string, MolangValue>();
  }

  getProperty(name: string): MolangValue {
    return this.properties.get(name.toLowerCase());
  }

  putProperty(name: string, value: MolangValue): void {
    this.properties.set(name.toLowerCase(), value);
  }

  copy(): Struct {
    return this.isRightValue
      ? new HashMapStruct(false, this.properties)
      : new HashMapStruct(false, new Map(this.properties));
  }

  toString(): string {
    const entries = Array.from(this.properties.entries())
      .map(([key, value]) => `${key}=${value === null || value === undefined ? 'null' : String(value)}`)
      .join(', ');
    return `struct{${entries}}`;
  }
}

export const EMPTY_OBJECT_BINDING: ObjectBinding = {
  getProperty: () => null,
};

export const createMolangFunction = (
  evaluate: (context: ExecutionContext, args: MolangArgumentCollection) => MolangValue,
  validateArgumentSize?: (size: number) => boolean,
): MolangFunction => ({
  __molangFunction: true,
  evaluate,
  validateArgumentSize,
});

export const isMolangFunction = (value: unknown): value is MolangFunction => {
  return !!value
    && typeof value === 'object'
    && (value as MolangFunction).__molangFunction === true
    && typeof (value as MolangFunction).evaluate === 'function';
};

export const isObjectBinding = (value: unknown): value is ObjectBinding => {
  return !!value && typeof value === 'object' && typeof (value as ObjectBinding).getProperty === 'function';
};

export const isAssignableVariable = (value: unknown): value is AssignableVariable => {
  return !!value
    && typeof value === 'object'
    && typeof (value as AssignableVariable).evaluate === 'function'
    && typeof (value as AssignableVariable).assign === 'function';
};

export const isVariable = (value: unknown): value is Variable => {
  return !!value
    && typeof value === 'object'
    && !isMolangFunction(value)
    && typeof (value as Variable).evaluate === 'function';
};

export const isStruct = (value: unknown): value is Struct => {
  return !!value
    && typeof value === 'object'
    && typeof (value as Struct).getProperty === 'function'
    && typeof (value as Struct).putProperty === 'function'
    && typeof (value as Struct).copy === 'function';
};
