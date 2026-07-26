import {
  AssignableVariable,
  EMPTY_OBJECT_BINDING,
  ExecutionContext,
  MolangValue,
  ObjectBinding,
  Variable,
} from './runtime-types';
import {createAssignableVariable, createVariable, StandardBindings} from './runtime';

export {EMPTY_OBJECT_BINDING, ObjectBinding};

/**
 * 基于 Map 的简单对象绑定。
 *
 * 用于构建 Molang 根命名空间或子命名空间，例如 `query.xxx`、`variable.xxx`、`math.xxx`。
 * 属性名统一转小写以匹配 Molang 标识符大小写不敏感的规则。
 */
export class SimpleObjectBinding implements ObjectBinding {
  private readonly properties = new Map<string, MolangValue>();

  constructor(initial?: Record<string, MolangValue> | Map<string, MolangValue>) {
    if (initial instanceof Map) {
      initial.forEach((value, key) => this.setProperty(key, value));
    } else if (initial) {
      Object.keys(initial).forEach((key) => this.setProperty(key, initial[key]));
    }
  }

  static fromObject(initial: Record<string, MolangValue>): SimpleObjectBinding {
    return new SimpleObjectBinding(initial);
  }

  getProperty(name: string): MolangValue {
    return this.properties.get(name.toLowerCase()) ?? null;
  }

  setProperty(name: string, value: MolangValue): this {
    this.properties.set(name.toLowerCase(), value);
    return this;
  }

  deleteProperty(name: string): boolean {
    return this.properties.delete(name.toLowerCase());
  }
}

export const createObjectBinding = (initial?: Record<string, MolangValue>): SimpleObjectBinding => {
  return new SimpleObjectBinding(initial);
};

export class MemoryAssignableVariable implements AssignableVariable {
  constructor(private value: MolangValue = null) {}

  evaluate(_context: ExecutionContext): MolangValue {
    return this.value;
  }

  assign(_context: ExecutionContext, value: MolangValue): void {
    this.value = value;
  }
}

export const createMemoryVariable = (initial: MolangValue = null): MemoryAssignableVariable => {
  return new MemoryAssignableVariable(initial);
};

export const createReadonlyVariable = (value: MolangValue | ((context: ExecutionContext) => MolangValue)): Variable => {
  return typeof value === 'function'
    ? createVariable(value as (context: ExecutionContext) => MolangValue)
    : createVariable(() => value);
};

export const createWritableVariable = (
  getter: (context: ExecutionContext) => MolangValue,
  setter: (context: ExecutionContext, value: MolangValue) => void,
): AssignableVariable => createAssignableVariable(getter, setter);

export const createStandardBinding = (): SimpleObjectBinding => {
  return new SimpleObjectBinding()
    .setProperty('loop', StandardBindings.LOOP_FUNC)
    .setProperty('for_each', StandardBindings.FOR_EACH_FUNC);
};
