import {
  getDynamicMolangVariableDefaults,
  toYsmRoamingKeepField,
} from '../molang/v/VariableResolvers';

/**
 * 从 YSM 动画 JSON 收集「默认应隐藏」的骨骼名，供几何体层永久隐藏。
 * 基岩对动画 scale:0 不稳定，必须在模型上删 cubes / 写死 scale。
 */
export function collectYsmHideBoneNames(animationJsonList: object[]): Set<string> {
  const defaults = getDynamicMolangVariableDefaults();
  const hide = new Set<string>();

  for (const file of animationJsonList) {
    const animations = (file as {animations?: Record<string, {bones?: Record<string, {scale?: unknown}>}>})
      .animations;
    if (!animations) {
      continue;
    }
    for (const anim of Object.values(animations)) {
      const bones = anim?.bones;
      if (!bones) {
        continue;
      }
      for (const [name, bone] of Object.entries(bones)) {
        if (shouldHideBoneByScale(bone?.scale, defaults)) {
          hide.add(name);
        }
      }
    }
  }
  return hide;
}

/**
 * 在几何体上永久隐藏指定骨骼：清空 cubes，scale 置 [0,0,0]。
 * 同时隐藏：
 * - 无父骨骼的游离道具根（Phone/MIC 等，排除 Size）
 * - 已被隐藏骨骼的全部子孙（如 MIC → MIC2）
 */
export function applyHideBonesToGeometry(
  modelJson: {format_version?: string; 'minecraft:geometry'?: Array<{bones?: GeoBone[]}>; [k: string]: unknown},
  hideBones: Set<string>,
): number {
  let count = 0;

  const visit = (bones: GeoBone[] | undefined) => {
    if (!bones) {
      return;
    }

    // 先收集：显式名单 + 游离根道具
    const toHide = new Set<string>(hideBones);
    for (const bone of bones) {
      const orphanProp = !bone.parent && bone.name !== 'Size' && (bone.cubes?.length ?? 0) > 0;
      if (orphanProp) {
        toHide.add(bone.name);
      }
    }

    // 再并入所有子孙（MIC 隐藏后 MIC2 仍有 cubes，基岩不会可靠继承 scale）
    let grew = true;
    while (grew) {
      grew = false;
      for (const bone of bones) {
        if (toHide.has(bone.name)) {
          continue;
        }
        if (bone.parent && toHide.has(bone.parent)) {
          toHide.add(bone.name);
          grew = true;
        }
      }
    }

    for (const bone of bones) {
      if (!toHide.has(bone.name)) {
        continue;
      }
      if (bone.cubes && bone.cubes.length > 0) {
        bone.cubes = [];
      }
      bone.scale = [0, 0, 0];
      count++;
    }
  };

  if (modelJson['format_version'] === '1.10.0') {
    for (const key of Object.keys(modelJson)) {
      if (key === 'format_version') {
        continue;
      }
      const block = modelJson[key] as {bones?: GeoBone[]};
      visit(block?.bones);
    }
  } else {
    for (const geo of modelJson['minecraft:geometry'] ?? []) {
      visit(geo.bones);
    }
  }
  return count;
}

interface GeoBone {
  name: string;
  parent?: string;
  pivot?: number[];
  cubes?: unknown[];
  scale?: number | number[];
}

function shouldHideBoneByScale(
  scale: unknown,
  defaults: ReadonlyMap<string, number>,
): boolean {
  if (scale === 0 || scale === '0') {
    return true;
  }
  if (typeof scale !== 'string') {
    return false;
  }
  if (!/roaming|ysm_roaming_/i.test(scale)) {
    return false;
  }
  // 源动画仍是 v.roaming.xxx，先归一到扁平名再求值
  const normalized = scale
    .replace(/v\.roaming\.([a-zA-Z0-9_]+)/gi, (_, leaf: string) => `v.${toYsmRoamingKeepField(leaf)}`)
    .replace(/\s+/g, '');
  const value = evalSimpleRoamingExpr(normalized, defaults);
  return value === 0;
}

/** 与 APYsmAccessoryHide 相同的简易求值（源/扁平变量） */
function evalSimpleRoamingExpr(
  expr: string,
  defaults: ReadonlyMap<string, number>,
): number | undefined {
  let m = /^v\.(ysm_roaming_[a-z0-9_]+)$/i.exec(expr);
  if (m) {
    return defaults.get(m[1].toLowerCase()) ?? 0;
  }
  m = /^1-v\.(ysm_roaming_[a-z0-9_]+)$/i.exec(expr);
  if (m) {
    return 1 - (defaults.get(m[1].toLowerCase()) ?? 0);
  }
  m = /^1-\(v\.(ysm_roaming_[a-z0-9_]+)(==([0-9.]+))?(\?1:0)?\)$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    if (m[2]) {
      return 1 - (cur === Number(m[3]) ? 1 : 0);
    }
    return 1 - (cur ? 1 : 0);
  }
  m = /^v\.(ysm_roaming_[a-z0-9_]+)==([0-9.]+)\?1:0$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    return cur === Number(m[2]) ? 1 : 0;
  }
  m = /^\(v\.(ysm_roaming_[a-z0-9_]+)==([0-9.]+)\)\?1:0$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    return cur === Number(m[2]) ? 1 : 0;
  }
  return undefined;
}
