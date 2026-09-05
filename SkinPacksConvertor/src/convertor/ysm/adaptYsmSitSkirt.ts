import {
  AnimationDefinition180,
  BoneAnimation,
  Molang,
  PositionChannel,
  RotationChannel,
  ScaleChannel,
} from '../animation/types/AnimationSchema180';
import {MaidAnimationListSchema180} from '../animation/types/MaidAnimationFileSchema180';
import {APUtils} from '../animation/processor/APUtils';
import {isAnimationEmpty} from './YsmLocomotionResolver';

const TAG = 'adaptYsmSitSkirt';

/**
 * 动画骨名在几何体中缺失时，按组内已存在骨名重定向。
 * 例：sit 写 `Skirt`，模型只有 `Mskirt`。
 */
const BONE_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ['Skirt', 'Mskirt', 'mskirt', 'skirt', 'SKIRT'],
];

/** 主裙骨（弱旋转补强对象） */
const MAIN_SKIRT_BONE_RE = /^(m?skirt)$/i;

/** TLM 默认 sit 裙俯仰量级；低于弱阈值时向该目标补强 */
export const YSM_SIT_SKIRT_TARGET_PITCH = -32.5;

/** |pitch| 小于此值视为坐下裙姿过弱（度） */
export const YSM_SIT_SKIRT_WEAK_ABS = 25;

const PARALLEL_CLIP_RE = /^(pre_)?parallel\d*$/i;
const SIT_CLIP_RE = /^sit/i;

export interface AdaptYsmSitSkirtResult {
  remapped: number;
  boosted: number;
  gated: number;
}

/**
 * YSM 坐下裙姿适配：骨名映射 → 弱旋转补强 → parallel 冲突门控。
 * 应在 {@link adaptYsmSitClips} 之后调用；`boneNames` 来自主模型几何体。
 */
export function adaptYsmSitSkirtClips(
  animations: MaidAnimationListSchema180,
  boneNames?: ReadonlySet<string>,
): AdaptYsmSitSkirtResult {
  const remapped = boneNames && boneNames.size > 0
    ? remapMissingBonesByAlias(animations, boneNames)
    : 0;
  const boosted = boostWeakSitSkirtPitch(animations);
  const gated = gateParallelConflictsWithSit(animations);

  if (remapped || boosted || gated) {
    console.log(
      TAG,
      `坐下裙适配: remap=${remapped}, boost=${boosted}, gate=${gated}`,
    );
  }
  return {remapped, boosted, gated};
}

/**
 * 将动画中「几何体不存在」的骨名，改写到同组别名中实际存在的骨。
 * @returns 重映射次数
 */
export function remapMissingBonesByAlias(
  animations: MaidAnimationListSchema180,
  boneNames: ReadonlySet<string>,
): number {
  let count = 0;
  for (const anim of Object.values(animations)) {
    if (!anim?.bones || isAnimationEmpty(anim)) {
      continue;
    }
    count += remapBonesInAnimation(anim, boneNames);
  }
  return count;
}

/**
 * 对 sit 中主裙骨过弱的静态 X 旋转，向 {@link YSM_SIT_SKIRT_TARGET_PITCH} 补强。
 * @returns 补强的 clip 数（按骨计）
 */
export function boostWeakSitSkirtPitch(animations: MaidAnimationListSchema180): number {
  let count = 0;
  for (const [name, anim] of Object.entries(animations)) {
    if (!SIT_CLIP_RE.test(name) || !anim?.bones || isAnimationEmpty(anim)) {
      continue;
    }
    for (const [boneName, bone] of Object.entries(anim.bones)) {
      if (!MAIN_SKIRT_BONE_RE.test(boneName) || !bone.rotation) {
        continue;
      }
      if (boostStaticPitchToward(bone.rotation, YSM_SIT_SKIRT_TARGET_PITCH, YSM_SIT_SKIRT_WEAK_ABS)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * 基岩 sit 与 parallel 同时播放时会争抢同骨通道。
 * 对与 sit 重叠的 parallel 通道，在 `v.tlm_is_sitting` 时归零，对齐 Java 层 sit 优先。
 * @returns 被门控的骨通道数
 */
export function gateParallelConflictsWithSit(animations: MaidAnimationListSchema180): number {
  const sitBones = collectSitDrivenBones(animations);
  if (sitBones.size === 0) {
    return 0;
  }

  let gated = 0;
  for (const [name, anim] of Object.entries(animations)) {
    if (!PARALLEL_CLIP_RE.test(name) || !anim?.bones) {
      continue;
    }
    for (const boneName of Object.keys(anim.bones)) {
      if (!sitBones.has(boneName)) {
        continue;
      }
      const bone = anim.bones[boneName];
      if (gateBoneWhenSitting(bone)) {
        gated++;
      }
    }
  }
  return gated;
}

function remapBonesInAnimation(
  anim: AnimationDefinition180,
  boneNames: ReadonlySet<string>,
): number {
  const bones = anim.bones!;
  let count = 0;
  for (const from of Object.keys(bones)) {
    if (boneNames.has(from)) {
      continue;
    }
    const to = resolveAliasTarget(from, boneNames);
    if (!to || to === from) {
      continue;
    }
    mergeBoneAnimation(bones, from, to);
    count++;
  }
  return count;
}

function resolveAliasTarget(from: string, boneNames: ReadonlySet<string>): string | undefined {
  for (const group of BONE_ALIAS_GROUPS) {
    if (!group.includes(from)) {
      continue;
    }
    return group.find((name) => boneNames.has(name));
  }
  return undefined;
}

/** 将 from 骨通道并入 to；同通道已存在时以 from（动画作者意图）覆盖 */
function mergeBoneAnimation(
  bones: Record<string, BoneAnimation>,
  from: string,
  to: string,
): void {
  const src = bones[from];
  if (!src) {
    return;
  }
  const dst = bones[to] ?? (bones[to] = {});
  if (src.rotation !== undefined) {
    dst.rotation = src.rotation;
  }
  if (src.position !== undefined) {
    dst.position = src.position;
  }
  if (src.scale !== undefined) {
    dst.scale = src.scale;
  }
  if (src.relative_to !== undefined) {
    dst.relative_to = src.relative_to;
  }
  delete bones[from];
}

function collectSitDrivenBones(animations: MaidAnimationListSchema180): Set<string> {
  const out = new Set<string>();
  for (const [name, anim] of Object.entries(animations)) {
    if (!SIT_CLIP_RE.test(name) || !anim?.bones || isAnimationEmpty(anim)) {
      continue;
    }
    for (const [boneName, bone] of Object.entries(anim.bones)) {
      if (bone.rotation !== undefined || bone.position !== undefined || bone.scale !== undefined) {
        out.add(boneName);
      }
    }
  }
  return out;
}

function gateBoneWhenSitting(bone: BoneAnimation): boolean {
  let changed = false;
  if (bone.rotation !== undefined) {
    bone.rotation = gateChannelWhenSitting(bone.rotation) as RotationChannel;
    changed = true;
  }
  if (bone.position !== undefined) {
    bone.position = gateChannelWhenSitting(bone.position) as PositionChannel;
    changed = true;
  }
  if (bone.scale !== undefined) {
    // scale 坐下归 1，避免平行层把裙缩没；与 rotation/position 归 0 不同
    bone.scale = gateScaleChannelWhenSitting(bone.scale);
    changed = true;
  }
  return changed;
}

function gateChannelWhenSitting(
  data: PositionChannel | RotationChannel | ScaleChannel,
): PositionChannel | RotationChannel | ScaleChannel {
  return APUtils.forEachMolangOfChannel(data, (m) => gateMolangWhenSitting(m, 0));
}

function gateScaleChannelWhenSitting(data: ScaleChannel): ScaleChannel {
  return APUtils.forEachMolangOfChannel(data, (m) => gateMolangWhenSitting(m, 1));
}

/**
 * 坐下时用 idle 值替换通道；已含门控则不重复包裹。
 */
function gateMolangWhenSitting(value: Molang, idle: number): Molang {
  if (typeof value === 'string' && /tlm_is_sitting/.test(value)) {
    return value;
  }
  if (typeof value === 'number') {
    if (value === idle) {
      return value;
    }
    return `v.tlm_is_sitting?${idle}:${value}`;
  }
  return `v.tlm_is_sitting?${idle}:(${value})`;
}

/**
 * 仅处理「整段静态三元组」的 pitch；关键帧 / 表达式跳过。
 */
function boostStaticPitchToward(
  rotation: RotationChannel,
  targetPitch: number,
  weakAbs: number,
): boolean {
  if (!Array.isArray(rotation) || rotation.length !== 3) {
    return false;
  }
  const x = rotation[0];
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    return false;
  }
  if (Math.abs(x) >= weakAbs) {
    return false;
  }
  // 已比目标更「躺」（更负）则不动；同号向目标靠拢
  if (targetPitch < 0) {
    if (x <= targetPitch) {
      return false;
    }
    rotation[0] = targetPitch;
    return true;
  }
  if (x >= targetPitch) {
    return false;
  }
  rotation[0] = targetPitch;
  return true;
}
