/**
 * 攻击伤害槽位：步进区间（避免密排）。
 * 使用场景：脚本 Slots.attack.set；非精确档向下对齐到最高支持值。
 */
import { expandIntSlot } from "./expand.js";

/**
 * 偶数伤害档：覆盖基础 6、lv1 12、lv2 16；set(13)→12
 * @type {import('./types.js').IntSlotDef}
 */
export const ATTACK_SLOT = {
  id: "attack",
  kind: "int",
  min: 2,
  max: 32,
  step: 2,
  component: "minecraft:attack",
  shape: { damage: "$" },
};

/**
 * 将 attack 槽展开进生成器
 * @param {import('./types.js').MaidGeneratorApi} g
 */
export function processAttackSlot(g) {
  expandIntSlot(g, ATTACK_SLOT);
}
