import {TokenKind} from '../engin';
import {
  parsePrefixedExpression,
  PrefixedExpressionOperatorContext,
} from '../PrefixedExpression';

/** 动画骨骼通道类型，用于决定未匹配变量的兜底恒等元。 */
export type AnimationBoneChannel = 'position' | 'rotation' | 'scale';

/**
 * 已知应原样保留的 `v.` / `variable.` 单段字段名。
 *
 * 包含特殊字段（如 `exp`）以及本转换器在 pre_animation / 脚本中已初始化的变量。
 *
 * 参考 `src/convertor/animation/MaidAnimationConvertor.ts` 的 `exportDefinition` 中的默认变量
 */
export const KNOWN_VARIABLE_NAMES: ReadonlySet<string> = new Set([
  'exp',
  'tcos0',
  'walk_process',
  'gliding_speed_value',
  'emote_index',
  'emote_frame',
  'emote_speed',
  'scale',
  'biaoqing',
  'animate_walk',
  'animate_beg',
  'animate_sit',
]);

/** 判断字段名是否应以白名单策略保留。 */
export const isKnownVariableName = (name: string): boolean => {
  const lower = name.toLowerCase();
  return KNOWN_VARIABLE_NAMES.has(lower) || lower.startsWith('animate_');
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
 * - scale：一律 `0`
 * - position / rotation：乘除语境 → `1`，其它 → `0`
 */
export const fallbackVariableValue = (
  channel: AnimationBoneChannel,
  ctx: PrefixedExpressionOperatorContext,
): string => {
  if (channel === 'scale') {
    return '0';
  }
  return isMultiplicativeContext(ctx) ? '1' : '0';
};

/**
 * `v` / `variable` 表达式统一解析入口。
 *
 * - 白名单单段字段（及 `animate_*`）→ 原样保留
 * - 其余 → 按通道 + 相邻运算符兜底为 `0` / `1`
 */
export const resolveVariableExpression = (
  expression: string,
  channel: AnimationBoneChannel,
  ctx: PrefixedExpressionOperatorContext,
): string => {
  const segments = parsePrefixedExpression(expression);
  const root = segments[0]?.name.toLowerCase();
  if (root !== 'v' && root !== 'variable') {
    return expression;
  }

  // 仅一段字段名时才走白名单；多段如 `v.tcos0.x` 走兜底。
  if (segments.length === 2 && isKnownVariableName(segments[1].name)) {
    return expression;
  }

  return fallbackVariableValue(channel, ctx);
};
