import {
  parsePrefixedExpression,
  PrefixedExpressionOperatorContext,
  PrefixedExpressionReplaceResult,
} from '../PrefixedExpression';
import {MOLANG_TLM_RESOLVE_RULES} from '../../config';
import {
  AnimationBoneChannel,
  fallbackVariableValue,
} from '../v/VariableResolvers';
import {writeErrorLog} from "../../../common/Log";

/**
 * `tlm` 表达式统一解析入口。
 *
 * 处理流程与 `v` / `variable` 一致：
 * - 命中规则且 `keep` → 原样保留
 * - 命中规则且 `replace` → 替换为指定值
 * - 未命中 → 按通道 + 相邻运算符兜底为 `0` / `1`，或取 `??` 右值
 */
export const resolveTlmExpression = (
  expression: string,
  channel: AnimationBoneChannel,
  ctx: PrefixedExpressionOperatorContext,
): PrefixedExpressionReplaceResult => {
  const segments = parsePrefixedExpression(expression);
  const root = segments[0]?.name.toLowerCase();
  if (root !== 'tlm') {
    return expression;
  }

  // 仅一段字段名时才走规则；多段如 `tlm.xxx.y` 走兜底。
  if (segments.length === 2) {
    const field = segments[1].name.toLowerCase();
    for (const rule of MOLANG_TLM_RESOLVE_RULES) {
      if (!field.startsWith(rule.name)) {
        continue;
      }
      if (rule.type === 'keep') {
        return expression;
      }
      return rule.value;
    }
  }
  // 未命中的 tlm 变量大概率可以做适配，在这输出到网页控制台
  writeErrorLog(`Unknown tlm variable: ${expression}`);
  return fallbackVariableValue(channel, ctx);
};
