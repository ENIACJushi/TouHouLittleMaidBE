import {AnimationDefinition180, ScaleChannel} from '../types/AnimationSchema180';
import {getDynamicMolangVariableDefaults} from '../../molang/v/VariableResolvers';

/**
 * 将 YSM 配饰相关 scale 按登记默认值烘焙成常量。
 *
 * 基岩 animation molang 读取实体脚本变量不稳定（常见：加载后几秒变量失效，
 * `1-v.xxx` 变回 1，配饰重新显示）。转换器无轮盘 UI，故在导出期把
 * `v.ysm_roaming_*` 表达式求成 0/1 常量。
 *
 * 服装类 `v.ysm_roaming_shangyi==0?1:0` 会按默认 0 求成 1（保持默认外观），
 * 道具类 `1-v.ysm_roaming_fumo` 按默认 1 求成 0（永久隐藏）。
 */
export const data = {
  types: undefined as undefined,
  func: async ({ animation }: { animation: AnimationDefinition180 }) => {
    const defaults = getDynamicMolangVariableDefaults();
    // 无 YSM 配饰默认登记时不处理（纯 TLM 包）
    const hasYsmRoaming = [...defaults.keys()].some((k) => k.startsWith('ysm_roaming_'));
    if (!hasYsmRoaming) {
      return;
    }
    bakeRoamingScales(animation, defaults);
    if (animation.extractedEyeAnimation) {
      bakeRoamingScales(animation.extractedEyeAnimation, defaults);
    }
  },
};

function bakeRoamingScales(
  animation: AnimationDefinition180,
  defaults: ReadonlyMap<string, number>,
): void {
  const bones = animation.bones;
  if (!bones) {
    return;
  }

  const propRoots = new Set<string>();

  for (const [name, bone] of Object.entries(bones)) {
    const baked = tryBakeScale(bone.scale, defaults);
    if (baked === undefined) {
      continue;
    }
    bone.scale = baked;
    if (baked === 0) {
      propRoots.add(stripTrailingDigits(name));
    }
  }

  // 伴随骨：Fumo2/Table2 等无 scale，但同组根骨已藏 → 一并 scale=0
  for (const [name, bone] of Object.entries(bones)) {
    if (bone.scale === 0 || isZeroScale(bone.scale)) {
      continue;
    }
    const stem = stripTrailingDigits(name);
    if (!propRoots.has(stem)) {
      continue;
    }
    if (!isPropAccessoryStem(stem)) {
      continue;
    }
    bone.scale = 0;
  }
}

/**
 * 尝试把含 ysm_roaming 的 scale 求成数字；无法识别则原样返回 undefined。
 */
function tryBakeScale(
  scale: ScaleChannel | undefined,
  defaults: ReadonlyMap<string, number>,
): number | undefined {
  if (scale === undefined || scale === null || typeof scale === 'number') {
    return undefined;
  }
  if (typeof scale !== 'string') {
    // 关键帧 / 数组：若整体是简单 roaming 表达式较罕见，暂不处理
    const text = JSON.stringify(scale);
    if (!/ysm_roaming_/i.test(text)) {
      return undefined;
    }
    return undefined;
  }
  if (!/ysm_roaming_/i.test(scale)) {
    return undefined;
  }

  const expr = scale.replace(/\s+/g, '');
  const value = evalSimpleRoamingExpr(expr, defaults);
  return value;
}

/**
 * 求值常见配饰/服装 scale 写法；失败返回 undefined。
 */
function evalSimpleRoamingExpr(
  expr: string,
  defaults: ReadonlyMap<string, number>,
): number | undefined {
  // v.ysm_roaming_xxx
  let m = /^v\.(ysm_roaming_[a-z0-9_]+)$/i.exec(expr);
  if (m) {
    return defaults.get(m[1].toLowerCase()) ?? 0;
  }

  // 1-v.ysm_roaming_xxx
  m = /^1-v\.(ysm_roaming_[a-z0-9_]+)$/i.exec(expr);
  if (m) {
    return 1 - (defaults.get(m[1].toLowerCase()) ?? 0);
  }

  // 1-(v.ysm_roaming_xxx==N?1:0) 或 1-(v.ysm_roaming_xxx?1:0)
  m = /^1-\(v\.(ysm_roaming_[a-z0-9_]+)(==([0-9.]+))?(\?1:0)?\)$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    if (m[2]) {
      const n = Number(m[3]);
      return 1 - (cur === n ? 1 : 0);
    }
    return 1 - (cur ? 1 : 0);
  }

  // v.ysm_roaming_xxx==N?1:0
  m = /^v\.(ysm_roaming_[a-z0-9_]+)==([0-9.]+)\?1:0$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    return cur === Number(m[2]) ? 1 : 0;
  }

  // (v.ysm_roaming_xxx==N)?1:0
  m = /^\(v\.(ysm_roaming_[a-z0-9_]+)==([0-9.]+)\)\?1:0$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    return cur === Number(m[2]) ? 1 : 0;
  }

  // 0+v.ysm_roaming_xxx==1 之类宽松写法
  m = /^0\+v\.(ysm_roaming_[a-z0-9_]+)==1$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    return cur === 1 ? 1 : 0;
  }

  return undefined;
}

function stripTrailingDigits(name: string): string {
  return name.replace(/\d+$/, '');
}

/** 仅对明确的道具类伴随骨强制隐藏，避免误伤 Hair/Clothes */
function isPropAccessoryStem(stem: string): boolean {
  return /^(Fumo|Saisenbako|Table|Tatami|BigNiaoju|MiniSaisenbako|OnmyouDama|Goin|baijian|Niaoju)$/i.test(
    stem,
  );
}

function isZeroScale(scale: ScaleChannel | undefined): boolean {
  if (scale === 0 || scale === '0') {
    return true;
  }
  if (Array.isArray(scale) && scale.length === 3) {
    return scale.every((v) => v === 0 || v === '0');
  }
  return false;
}
