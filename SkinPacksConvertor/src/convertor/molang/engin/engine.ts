import {Expression} from './ast';
import {EMPTY_OBJECT_BINDING, ObjectBinding} from './runtime-types';
import {MolangParser} from './parser';

/**
 * Molang 解析入口。
 *
 * 引擎只负责把源码解析成 AST，不直接绑定具体实体状态；运行时状态由
 * `ExpressionEvaluatorImpl` 在求值阶段提供。
 */
export class MolangEngine {
  private constructor(private readonly bindings: ObjectBinding) {}

  /** 使用自定义根绑定创建解析器，标识符会在 parse 阶段从该绑定中解析。 */
  static fromCustomBinding(binding: ObjectBinding): MolangEngine {
    return new MolangEngine(binding);
  }

  /** 创建不包含任何标识符的空引擎，通常只适合解析纯字面量表达式。 */
  static createEmpty(): MolangEngine {
    return new MolangEngine(EMPTY_OBJECT_BINDING);
  }

  /** 将完整 Molang 脚本解析为表达式列表；多个表达式用分号分隔。 */
  parse(source: string): Expression[] {
    return MolangParser.parseAll(source, this.bindings);
  }
}

/** 便捷解析函数，适合一次性解析少量 Molang 表达式。 */
export const parseMolang = (source: string, binding: ObjectBinding = EMPTY_OBJECT_BINDING): Expression[] => {
  return MolangEngine.fromCustomBinding(binding).parse(source);
};
