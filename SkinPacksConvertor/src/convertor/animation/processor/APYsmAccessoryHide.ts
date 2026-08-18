import {AnimationDefinition180, ScaleChannel} from '../types/AnimationSchema180';
import {getDynamicMolangVariableDefaults} from '../../molang/v/VariableResolvers';
import {evalSimpleYsmRoamingExpr} from '../YsmRoamingExpr';

/**
 * 动画处理器：将 YSM 配饰相关 scale 按登记默认值烘焙成常量。
 *
 * 注册于 {@link AnimationProcessor}，须在 APMolang 之后执行（此时 `v.roaming.*`
 * 已扁平为 `v.ysm_roaming_*`）。
 *
 * 基岩 animation molang 读取实体脚本变量不稳定（常见：加载后几秒变量失效，
 * `1-v.xxx` 变回 1，配饰重新显示）。转换器无轮盘 UI，故在导出期把
 * `v.ysm_roaming_*` 表达式求成 0/1 常量。
 *
 * 服装类 `v.ysm_roaming_shangyi==0?1:0` 会按默认 0 求成 1（保持默认外观），
 * 道具类 `1-v.ysm_roaming_fumo` 按默认 1 求成 0（永久隐藏）。
 *
 * 无 YSM 配饰登记时直接跳过，避免影响纯 TLM 包。
 */
export const data = {
  types: undefined as undefined,
  func: async ({ animation }: { animation: AnimationDefinition180 }) => {
    const defaults = getDynamicMolangVariableDefaults();
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

/**
 * 遍历动画骨骼：可求值的 roaming scale 写成数字；同组道具伴随骨一并藏掉。
 */
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
 * 尝试把含 ysm_roaming 的 scale 求成数字；无法识别则返回 undefined（保留原值）。
 */
function tryBakeScale(
  scale: ScaleChannel | undefined,
  defaults: ReadonlyMap<string, number>,
): number | undefined {
  if (scale === undefined || scale === null || typeof scale === 'number') {
    return undefined;
  }
  if (typeof scale !== 'string') {
    // 关键帧 / 数组中的 roaming 较罕见，暂不烘焙以免误伤
    return undefined;
  }
  if (!/ysm_roaming_/i.test(scale)) {
    return undefined;
  }

  const expr = scale.replace(/\s+/g, '');
  return evalSimpleYsmRoamingExpr(expr, defaults);
}

/**
 * 去掉骨骼名末尾数字，得到组名前缀（Fumo2 → Fumo），用于匹配伴随骨。
 */
function stripTrailingDigits(name: string): string {
  return name.replace(/\d+$/, '');
}

/**
 * 仅对明确的道具类伴随骨强制隐藏，避免误伤 Hair/Clothes 等同前缀骨骼。
 */
function isPropAccessoryStem(stem: string): boolean {
  return /^(Fumo|Saisenbako|Table|Tatami|BigNiaoju|MiniSaisenbako|OnmyouDama|Goin|baijian|Niaoju)$/i.test(
    stem,
  );
}

/**
 * 判断 scale 是否已是「全 0」（数字 / 字符串 / 三元组）。
 */
function isZeroScale(scale: ScaleChannel | undefined): boolean {
  if (scale === 0 || scale === '0') {
    return true;
  }
  if (Array.isArray(scale) && scale.length === 3) {
    return scale.every((v) => v === 0 || v === '0');
  }
  return false;
}
