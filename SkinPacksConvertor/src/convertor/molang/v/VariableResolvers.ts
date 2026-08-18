import {TokenKind} from '../engin';
import {
  parsePrefixedExpression,
  PrefixedExpressionOperatorContext,
  PrefixedExpressionReplaceResult,
  TAKE_NULL_COALESCE_RHS,
} from '../PrefixedExpression';
import {MOLANG_VARIABLE_RESOLVE_RULES} from "../../config";

/** 动画骨骼通道类型，用于决定未匹配变量的兜底恒等元。 */
export type AnimationBoneChannel = 'position' | 'rotation' | 'scale' | 'script';

/** 运行期追加的 keep 字段（如 molang 伪骨骼定义的变量），小写。 */
const dynamicKeepVariableFields = new Set<string>();

/** 运行期登记的变量默认值（字段小写 → 数值），用于 scripts.initialize */
const dynamicVariableDefaults = new Map<string, number>();

/**
 * 清空本次转换累积的 keep / 默认值登记。
 *
 * 必须在每次 {@link SkinConvertor.startConvert} 开头调用：模块级 Set/Map 会在
 * 浏览器连续转换多个包时泄漏到下一轮，导致错误的 initialize 与配饰烘焙。
 */
export const clearDynamicMolangRegistrations = (): void => {
  dynamicKeepVariableFields.clear();
  dynamicVariableDefaults.clear();
};

/** 将字段名加入 keep 白名单（大小写不敏感）。 */
export const registerMolangVariableKeep = (fieldName: string): void => {
  dynamicKeepVariableFields.add(fieldName.toLowerCase());
};

/**
 * 登记变量默认值，并加入 keep 白名单。
 * 供 {@link MaidAnimationConvertor} 写入 `scripts.initialize` / 强制 `pre_animation`，
 * 以及配饰 scale 烘焙求值使用。
 * @param fieldName 不含 `v.` 前缀，如 `ysm_roaming_fumo` / `tail5z`
 * @param value 实体加载时的初始数值（配饰隐藏常用 1）
 */
export const registerMolangVariableDefault = (fieldName: string, value: number): void => {
  const key = fieldName.toLowerCase();
  dynamicKeepVariableFields.add(key);
  dynamicVariableDefaults.set(key, value);
};

/**
 * YSM 叶子名 → 基岩扁平变量字段名（不含 `v.`）。
 * 例：`fumo` → `ysm_roaming_fumo`。
 * 基岩对嵌套 `v.roaming.xxx` 赋值不稳定，转换期统一展平。
 */
export const toFlatYsmRoamingField = (roamingLeaf: string): string => {
  return `ysm_roaming_${roamingLeaf.toLowerCase()}`;
};

/**
 * 将 `roaming.xxx` 或裸叶子 `xxx` 规范为扁平 keep 字段名。
 * 例：`roaming.fumo` / `fumo` → `ysm_roaming_fumo`。
 */
export const toYsmRoamingKeepField = (roamingPathOrLeaf: string): string => {
  const raw = roamingPathOrLeaf.toLowerCase().replace(/^roaming\./, '');
  return toFlatYsmRoamingField(raw);
};

/** 取出转换过程中登记的全部 keep 字段（已小写）。 */
export const getDynamicMolangKeepFields = (): string[] => {
  return [...dynamicKeepVariableFields];
};

/**
 * 取出变量默认值表（字段小写 → 数值，只读视图）。
 * 未登记字段在导出 initialize 时仍按 0 处理。
 */
export const getDynamicMolangVariableDefaults = (): ReadonlyMap<string, number> => {
  return dynamicVariableDefaults;
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
 * - position / rotation / script：乘除语境 → `1`，其它 → `0`
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

  // YSM 轮盘/配饰：`v.roaming.xxx` → 扁平 `v.ysm_roaming_xxx`（基岩嵌套变量会丢值）
  if (segments.length >= 3 && segments[1].name.toLowerCase() === 'roaming') {
    const leaf = segments
      .slice(2)
      .map((s) => s.name.toLowerCase())
      .join('_');
    const flatField = toFlatYsmRoamingField(leaf);
    registerMolangVariableKeep(flatField);
    return `v.${flatField}`;
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
        // 静态 keep 也会在导出时写入 initialize=0（如源动画未赋值却被引用的 v.tail5z）
        registerMolangVariableKeep(field);
        return expression;
      }
      return rule.value;
    }
  }

  return fallbackVariableValue(channel, ctx);
};
