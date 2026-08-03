import {
  parsePrefixedExpression,
  PrefixedExpressionOperatorContext,
} from '../PrefixedExpression';
import {MOLANG_YSM_RESOLVE_RULES} from '../../config';
import {
  AnimationBoneChannel,
  fallbackVariableValue,
} from '../v/VariableResolvers';
import {writeErrorLog} from '../../../common/Log';

/**
 * `ysm` 表达式统一解析入口。
 *
 * 处理流程与 `v` / `variable` / `tlm` 一致：
 * - 命中规则且 `keep` → 原样保留
 * - 命中规则且 `replace` → 替换为指定值
 * - 未命中 → 按通道 + 相邻运算符兜底为 `0` / `1`
 */
export const resolveYsmExpression = (
  expression: string,
  channel: AnimationBoneChannel,
  ctx: PrefixedExpressionOperatorContext,
): string => {
  const segments = parsePrefixedExpression(expression);
  const root = segments[0]?.name.toLowerCase();
  if (root !== 'ysm') {
    return expression;
  }

  // 仅一段字段名时才走规则；多段如 `ysm.bone_rot(...).x` 走兜底。
  if (segments.length === 2) {
    const field = segments[1].name.toLowerCase();
    for (const rule of MOLANG_YSM_RESOLVE_RULES) {
      if (!field.startsWith(rule.name)) {
        continue;
      }
      if (rule.type === 'keep') {
        return expression;
      }
      return rule.value;
    }
  }
  // 未命中的 ysm 变量大概率可以做适配，在这输出到网页控制台
  // writeErrorLog(`Unknown ysm variable: ${expression}`);
  return fallbackVariableValue(channel, ctx);
};
