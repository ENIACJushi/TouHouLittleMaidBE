/**
 * 抗击退槽位：百分制 token 0~100 → minecraft:knockback_resistance.value = token/100。
 * 使用场景：Level lv1=10、lv2=20；NPC/雕像等 100；脚本 Slots.knockback.set。
 */
import { expandIntSlot } from "./expand.js";

/** 百分制闭区间；事件名 slot:knockback_<n>，组件 value 为 n/100 */
export const KNOCKBACK_SLOT = {
  id: "knockback",
  kind: "int",
  min: 0,
  max: 100,
  component: "minecraft:knockback_resistance",
  shape: { value: "$" },
  /**
   * @param {number} token 百分制档位
   * @returns {number} 引擎 value（0~1）
   */
  mapToken: (token) => token / 100,
};

/**
 * 将 knockback 槽展开进生成器
 * @param {object} g MaidGenerator 实例
 */
export function processKnockbackSlot(g) {
  expandIntSlot(g, KNOCKBACK_SLOT);
}
