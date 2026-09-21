/**
 * 最大生命槽位：步进区间（避免密排）。
 * 使用场景：Slots.health / Health.setMax；非精确档向下对齐到最高支持值。
 */
import { expandIntSlot } from "./expand.js";

/**
 * 偶数生命档：覆盖 lv1=64、lv2=70；set(71)→70
 * @type {import('./types.js').IntSlotDef}
 */
export const HEALTH_SLOT = {
  id: "health",
  kind: "int",
  min: 20,
  max: 100,
  step: 2,
  component: "minecraft:health",
  shape: { value: "$", max: "$" },
};

/**
 * 将 health 槽展开进生成器
 * @param {import('./types.js').MaidGeneratorApi} g
 */
export function processHealthSlot(g) {
  expandIntSlot(g, HEALTH_SLOT);
}
