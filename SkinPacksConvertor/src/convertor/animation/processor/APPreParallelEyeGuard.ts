import {AnimationDefinition180, BoneAnimation} from '../types/AnimationSchema180';
import {AnimationTypes} from '../types/AnimationTypes';

/** 与主动画眨眼冲突的眼部骨骼（睑/眉/瞳点） */
const EYE_BONE_NAME_RE = /eyelid|eyebrow|eyedot/i;

/** 眼部骨骼拆尽后的无操作占位骨骼，避免原动画变为不被允许的 `{}` */
const PLACEHOLDER_BONE_NAME = 'tlm_placeholder';

/**
 * 对齐 Java：main（sit/idle）覆盖同通道时，pre_parallel 的眼皮写入应消失。
 *
 * 基岩无覆盖语义，且 `this` 透传不可靠，故将眼部骨骼拆到 extractedEyeAnimation，
 * 由导出阶段仅在 !v.tlm_suppress_molang_blink 时播放。
 */
export const data = {
  types: [
    AnimationTypes.pre_parallel0,
    AnimationTypes.pre_parallel1,
    AnimationTypes.pre_parallel2,
    AnimationTypes.pre_parallel3,
    AnimationTypes.pre_parallel4,
    AnimationTypes.pre_parallel5,
    AnimationTypes.pre_parallel6,
    AnimationTypes.pre_parallel7,
  ],
  func: async (animation: AnimationDefinition180) => {
    if (!animation.bones) {
      return;
    }
    const eyeBones: Record<string, BoneAnimation> = {};
    for (const boneName of Object.keys(animation.bones)) {
      if (!isEyeBoneName(boneName)) {
        continue;
      }
      eyeBones[boneName] = animation.bones[boneName];
      delete animation.bones[boneName];
    }
    if (Object.keys(eyeBones).length === 0) {
      return;
    }
    // 与原动画共用 loop / 时长，保证眨眼节奏一致
    animation.extractedEyeAnimation = {
      loop: animation.loop ?? true,
      animation_length: animation.animation_length,
      anim_time_update: animation.anim_time_update,
      bones: eyeBones,
    };
    // 眼部骨骼拆尽后 bones 为空时，原动画会变成无效的 {}，补占位骨骼
    if (Object.keys(animation.bones).length === 0) {
      animation.bones[PLACEHOLDER_BONE_NAME] = {};
    }
  },
};

/** 主动画是否自带眼皮/眉毛关键帧（用于决定坐下/idle 时抑制 molang 眨眼） */
export const animationHasEyeBones = (animation: AnimationDefinition180 | undefined): boolean => {
  if (!animation?.bones) {
    return false;
  }
  return Object.keys(animation.bones).some((name) => isEyeBoneName(name));
};

export const isEyeBoneName = (boneName: string): boolean => EYE_BONE_NAME_RE.test(boneName);
