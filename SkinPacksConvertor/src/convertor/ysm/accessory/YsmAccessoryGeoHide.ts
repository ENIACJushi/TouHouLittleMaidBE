import {getDynamicMolangVariableDefaults} from '../../molang/v/VariableResolvers';
import {toYsmRoamingKeepField} from '../roaming/YsmRoamingFields';
import {evalSimpleYsmRoamingExpr} from '../roaming/YsmRoamingExpr';

/**
 * 与眨眼/眉眼相关的骨骼：动画里常出现瞬时 scale:0，绝不能据此永久删几何体。
 * 覆盖 eyelid / Eyeslid / eyebrow / eyedot 等常见命名。
 */
const EYE_BONE_NAME_RE = /eyelid|eyeslid|eyebrow|eyedot/i;

/**
 * 从 YSM 动画 JSON 收集「默认应隐藏」的骨骼名，供几何体层永久隐藏。
 *
 * 用法：在 {@link registerYsmAccessoryDefaults} 之后调用，再把结果交给
 * {@link applyHideBonesToGeometry}。基岩对动画 `scale:0` 不稳定，必须在模型上删 cubes。
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
        if (shouldHideBoneByScale(name, bone?.scale, defaults)) {
          hide.add(name);
        }
      }
    }
  }
  return hide;
}

/**
 * 在几何体上永久隐藏指定骨骼：清空 cubes，scale 置 [0,0,0]。
 *
 * 同时隐藏：
 * - 无父骨骼的游离道具根（Phone/MIC 等，排除 Size / Root）
 * - 已被隐藏骨骼的全部子孙（如 MIC → MIC2）
 *
 * @returns 实际改写的骨骼数量
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
      if (isOrphanPropRoot(bone)) {
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

/**
 * 判断该骨骼是否应按默认外观从几何体中永久去掉。
 *
 * - roaming 表达式按登记默认值求值后为 0 → 隐藏（非默认服装变体等）
 * - 字面 `scale:0`：仅对非眼皮骨骼生效（眼皮常在闭眼关键为 0，不能删）
 */
function shouldHideBoneByScale(
  boneName: string,
  scale: unknown,
  defaults: ReadonlyMap<string, number>,
): boolean {
  if (scale === 0 || scale === '0') {
    // 眨眼闭眼关键等瞬时状态，禁止永久删骨
    if (EYE_BONE_NAME_RE.test(boneName)) {
      return false;
    }
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
  const value = evalSimpleYsmRoamingExpr(normalized, defaults);
  return value === 0;
}

/**
 * 游离根道具：无 parent、有 cubes，且不是模型坐标系根（Size/Root）。
 * 典型：YSM 把 Phone/MIC 挂在世界根上，动画里 scale:0 无法持久隐藏。
 */
function isOrphanPropRoot(bone: GeoBone): boolean {
  if (bone.parent) {
    return false;
  }
  if (bone.name === 'Size' || bone.name === 'Root') {
    return false;
  }
  return (bone.cubes?.length ?? 0) > 0;
}
