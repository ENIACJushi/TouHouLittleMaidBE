/**
 * 攻击伤害槽位：为 minecraft:attack.damage 生成 slot:attack_<n> 原子档。
 * 使用场景：脚本 Slots.attack.set 挂载；Level 等业务日后组合调用，与 api:lv_* 捆包并存。
 */
import { expandIntSlot } from "./expand.js";

/** 与文档约定及等级常用伤害对齐的闭区间（含基础 6、lv1 12、lv2 16） */
export const ATTACK_SLOT = {
  id: "attack",
  kind: "int",
  min: 1,
  max: 32,
  component: "minecraft:attack",
  shape: { damage: "$" },
};

/**
 * 将 attack 槽展开进生成器
 * @param {object} g MaidGenerator 实例
 */
export function processAttackSlot(g) {
  expandIntSlot(g, ATTACK_SLOT);
}
