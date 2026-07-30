import { AnimationTypes } from "../types/AnimationTypes";

/**
 * 默认 Gecko 动画相关常量与命名
 *  默认动画由模组主资源包提供，转换器不生成其内容，仅按同一命名规则引用。
 *  内容需稍后手动转换并放入主资源包。
 */

/** 默认动画涵盖的类型（主资源包按同名规则提供） */
export const DEFAULT_ANIMATION_TYPES = [
  AnimationTypes.walk,
  AnimationTypes.beg,
  AnimationTypes.sit,
] as const;

/**
 * 生成基岩版皮肤包动画名
 *  形如：animation.tlm.skin_pack.1.walk
 */
export function buildSkinPackAnimationName(animationId: number, type: string): string {
  return `animation.tlm.skin_pack.${animationId}.${type}`;
}
