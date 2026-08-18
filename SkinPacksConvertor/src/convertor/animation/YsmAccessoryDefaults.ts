import {YsmJson, YsmConfigForm} from '../model/YsmJson';
import {
  registerMolangVariableDefault,
  registerMolangVariableKeep,
  toYsmRoamingKeepField,
} from '../molang/v/VariableResolvers';

const TAG = 'YsmAccessoryDefaults';

/** 标题/描述暗示「勾选后隐藏」的关键词 */
const HIDE_LABEL_RE = /消失|隐藏|关闭|不显示|hide|disable|off/i;

/**
 * 根据 ysm.json 轮盘按钮与动画文本，登记配饰变量默认值，使道具类配饰默认隐藏。
 *
 * 字段一律登记为扁平名 `ysm_roaming_xxx`（对应动画里 `v.roaming.xxx` 的转换结果）。
 *
 * - checkbox 标题含「消失」等 → 默认 `1`（勾选隐藏）
 * - 其它 checkbox → 默认 `0`（勾选才显示）
 * - 动画中仅出现 `1-(v.roaming.x…)` 用法的变量 → 默认 `1`
 * - 直接 `scale: v.roaming.x` 的显示型 → 默认 `0`
 */
export function registerYsmAccessoryDefaults(
  manifest: YsmJson,
  animationTexts: string[],
): void {
  const defaults = new Map<string, number>();

  // 1) ysm.json 轮盘配置（最贴近作者意图）
  for (const button of manifest.properties?.extra_animation_buttons ?? []) {
    for (const form of button.config_forms ?? []) {
      applyConfigFormDefault(form, defaults);
    }
  }

  // 2) 扫描动画用法，补全未在表单中声明的 roaming 变量
  const combined = animationTexts.join('\n');
  applyAnimationPatternDefaults(combined, defaults);

  // 道具类：动画为 1-v.roaming.x（隐藏型），即使 checkbox 未写「消失」也强制默认隐藏
  const PROP_HIDE_LEAF = /^(fumo|saiqian|saiqian2|niaoju|table|tatami|baijian|mima\d+)$/i;
  for (const m of combined.matchAll(/1-\s*\(?\s*v\.roaming\.([a-zA-Z0-9_]+)/g)) {
    if (PROP_HIDE_LEAF.test(m[1])) {
      defaults.set(toYsmRoamingKeepField(m[1]), 1);
    }
  }

  // 3) 登记到全局 keep + 默认值表（导出 initialize / pre_animation 时使用）
  for (const [field, value] of defaults) {
    registerMolangVariableDefault(field, value);
  }

  const hidden = [...defaults.entries()].filter(([, v]) => v !== 0).map(([k]) => k);
  if (hidden.length > 0) {
    console.log(TAG, `配饰默认隐藏: ${hidden.join(', ')}`);
  }
}

/**
 * 从 checkbox / range 表单项提取默认值（写入扁平字段名）。
 */
function applyConfigFormDefault(form: YsmConfigForm, defaults: Map<string, number>): void {
  const field = roamingFieldFromValue(form.value);
  if (!field) {
    return;
  }
  registerMolangVariableKeep(field);

  if (form.type === 'checkbox') {
    const label = `${form.title ?? ''}${form.description ?? ''}`;
    const hideByDefault = HIDE_LABEL_RE.test(label);
    defaults.set(field, hideByDefault ? 1 : 0);
    return;
  }

  // range / radio：服装与表情保持 0（默认款）
  if (!defaults.has(field)) {
    defaults.set(field, 0);
  }
}

/**
 * 按动画中的 scale 写法推断默认值。
 */
function applyAnimationPatternDefaults(text: string, defaults: Map<string, number>): void {
  const hideWhen1 = new Set<string>();
  const showWhenTruthy = new Set<string>();

  for (const m of text.matchAll(/1-\s*\(?\s*v\.roaming\.([a-zA-Z0-9_]+)/g)) {
    hideWhen1.add(toYsmRoamingKeepField(m[1]));
  }
  for (const m of text.matchAll(/"scale"\s*:\s*"v\.roaming\.([a-zA-Z0-9_]+)"/g)) {
    showWhenTruthy.add(toYsmRoamingKeepField(m[1]));
  }

  for (const field of showWhenTruthy) {
    if (!defaults.has(field)) {
      defaults.set(field, 0);
    }
  }

  for (const field of hideWhen1) {
    if (showWhenTruthy.has(field)) {
      if (!defaults.has(field)) {
        defaults.set(field, 0);
      }
      continue;
    }
    if (!defaults.has(field)) {
      defaults.set(field, 1);
    }
  }
}

/** `v.roaming.foo` → `ysm_roaming_foo` */
function roamingFieldFromValue(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim().replace(/;$/, '');
  const match = /^(?:v|variable)\.roaming\.([a-zA-Z0-9_]+)$/i.exec(trimmed);
  return match ? toYsmRoamingKeepField(match[1]) : undefined;
}
