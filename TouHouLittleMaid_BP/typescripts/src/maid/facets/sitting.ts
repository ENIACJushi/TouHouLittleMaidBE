import { Entity } from "@minecraft/server";

/** 与 EntityMaid.Anim 坐下位一致；Task 4 迁入 Anim 后可替换 */
const ANIM_PROPERTY = "thlm:anim";
const BIT_SIT = 1 << 0;
const FOOD_DEFAULT = 20;
const FOOD_SHIFT = 3;

/**
 * 是否处于坐下状态（对齐 EntityMaid.isSitting）
 */
export function isSitting(maid: Entity): boolean {
  const anim = (maid.getProperty(ANIM_PROPERTY) as number | undefined)
    ?? (FOOD_DEFAULT << FOOD_SHIFT);
  return (anim & BIT_SIT) !== 0;
}
