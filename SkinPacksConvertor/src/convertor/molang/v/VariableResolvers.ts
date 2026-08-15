import {TokenKind} from '../engin';
import {
  parsePrefixedExpression,
  PrefixedExpressionOperatorContext,
  PrefixedExpressionReplaceResult,
  TAKE_NULL_COALESCE_RHS,
} from '../PrefixedExpression';
import {MOLANG_VARIABLE_RESOLVE_RULES} from "../../config";

/** 动画骨骼通道类型，用于决定未匹配变量的兜底恒等元。 */
export type AnimationBoneChannel = 'position' | 'rotation' | 'scale';

/** 运行期追加的 keep 字段（如 molang 伪骨骼定义的变量），小写。 */
const dynamicKeepVariableFields = new Set<string>();

/** 将字段名加入 keep 白名单（大小写不敏感）。 */
export const registerMolangVariableKeep = (fieldName: string): void => {
  dynamicKeepVariableFields.add(fieldName.toLowerCase());
};

/**
 * 乘除语境：左右相邻 token 任一侧为 `*` 或 `/`。
 * 此时未匹配变量应替换为乘除恒等元 `1`。
 */
const isMultiplicativeContext = (ctx: PrefixedExpressionOperatorContext): boolean => {
  return ctx.leftOperator === TokenKind.STAR
    || ctx.leftOperator === TokenKind.SLASH
    || ctx.rightOperator === TokenKind.STAR
    || ctx.rightOperator === TokenKind.SLASH;
};

/**
 * 按通道与运算符上下文，为未匹配的 `v.` / `variable.` 选择兜底值。
 *
 * - 位于 `??` 左侧：返回 {@link TAKE_NULL_COALESCE_RHS}，由替换层丢弃左值与 `??`、保留右值
 *   （例：`v.player_scale??1` → `1`，不会产生 `??1` 中间态）
 * - scale：一律 `0`
 * - position / rotation：乘除语境 → `1`，其它 → `0`
 */
export const fallbackVariableValue = (
  channel: AnimationBoneChannel,
  ctx: PrefixedExpressionOperatorContext,
): PrefixedExpressionReplaceResult => {
  // 未匹配变量在 ?? 左侧：取空值合并右值，避免先写成 0 再破坏 ?? 语义
  if (ctx.rightOperator === TokenKind.QUESQUES) {
    return TAKE_NULL_COALESCE_RHS;
  }
  if (channel === 'scale') {
    return '0';
  }
  return isMultiplicativeContext(ctx) ? '1' : '0';
};

/**
 * `v` / `variable` 表达式统一解析入口。
 *
 * - 命中规则且 `keep` → 原样保留
 * - 命中规则且 `replace` → 替换为指定值
 * - 未命中 → 按通道 + 相邻运算符兜底为 `0` / `1`，或取 `??` 右值
 */
export const resolveVariableExpression = (
  expression: string,
  channel: AnimationBoneChannel,
  ctx: PrefixedExpressionOperatorContext,
): PrefixedExpressionReplaceResult => {
  const segments = parsePrefixedExpression(expression);
  const root = segments[0]?.name.toLowerCase();
  if (root !== 'v' && root !== 'variable') {
    return expression;
  }

  // 仅一段字段名时才走规则；多段如 `v.tcos0.x` 走兜底。
  if (segments.length === 2) {
    const field = segments[1].name.toLowerCase();
    if (dynamicKeepVariableFields.has(field)) {
      return expression;
    }
    for (const rule of MOLANG_VARIABLE_RESOLVE_RULES) {
      if (!field.startsWith(rule.name)) {
        continue;
      }
      if (rule.type === 'keep') {
        return expression;
      }
      return rule.value;
    }
  }

  return fallbackVariableValue(channel, ctx);
};
