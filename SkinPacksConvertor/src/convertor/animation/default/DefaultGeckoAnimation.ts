import { AnimationTypes } from "../types/AnimationTypes";
import { MaidAnimationFileSchema180 } from "../types/MaidAnimationFileSchema180";
import defaultMaidAnimationSource from "../../config/maid.animation.json";

/**
 * 默认 / 兜底 Gecko 动画相关常量与命名
 *  兜底动画由转换器内置源文件转换生成，不再依赖模组主资源包。
 *  源文件：tools/default_animates/assets/touhou_little_maid/animation/maid.animation.json
 */

/** 默认动画涵盖的类型（与 ANIMATION_DEF_TEMPLATE 中 *_1 引用对齐） */
export const DEFAULT_ANIMATION_TYPES = [
  AnimationTypes.hug,
  AnimationTypes.walk,
  AnimationTypes.beg,
  AnimationTypes.sit,
  AnimationTypes.idle,
  AnimationTypes.sleep,
  AnimationTypes.parallel0,
  AnimationTypes.parallel1,
  AnimationTypes.parallel2,
  AnimationTypes.parallel3,
  AnimationTypes.pre_parallel0,
  AnimationTypes.pre_parallel1,
  AnimationTypes.pre_parallel2,
  AnimationTypes.pre_parallel3,
  AnimationTypes.pre_parallel4,
  AnimationTypes.pre_parallel5,
  AnimationTypes.pre_parallel6,
  AnimationTypes.pre_parallel7,
] as const;

/**
 * 内置兜底源动画文件（Java 版 maid.animation.json）
 *  导出时按 AnimationTypes 逐项转换，写入皮肤包动画列表。
 */
export const DEFAULT_MAID_ANIMATION_SOURCE =
  defaultMaidAnimationSource as unknown as MaidAnimationFileSchema180;

/**
 * 生成基岩版皮肤包动画名
 *  形如：animation.tlm.skin_pack.1.walk
 */
export function buildSkinPackAnimationName(animationId: number, type: string): string {
  return `animation.tlm.skin_pack.${animationId}.${type}`;
}
