/**
 * 抗击退槽位：百分制 token 0~100 → minecraft:knockback_resistance.value = token/100。
 * 使用场景：Level lv1=10、lv2=20；NPC/雕像等 100；脚本 Slots.knockback.set。
 */
import { expandIntSlot } from "./expand.js";

/**
 * 百分制闭区间 step=2（偶数档）；事件名 slot:knockback_<n>，组件 value 为 n/100
 * @type {import('./types.js').IntSlotDef}
 */
export const KNOCKBACK_SLOT = {
  id: "knockback",
  kind: "int",
  min: 0,
  max: 100,
  step: 2,
  component: "minecraft:knockback_resistance",
  shape: { value: "$" },
  mapToken: (token) => token / 100,
};

/**
 * 将 knockback 槽展开进生成器
 * @param {import('./types.js').MaidGeneratorApi} g
 */
export function processKnockbackSlot(g) {
  expandIntSlot(g, KNOCKBACK_SLOT);
}
