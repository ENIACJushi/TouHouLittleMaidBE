/**
 * 槽位模块入口：展开 JSON 原子档，并同步元数据到 BP 脚本侧 slots.gen.ts。
 * 使用场景：MaidGenerator.main；改数值以本目录各槽定义为准，build 后脚本侧自动对齐。
 *
 * 通用类型：{@link ./types.js}
 */
import { ATTACK_SLOT, processAttackSlot } from "./attack.js";
import { HEALTH_SLOT, processHealthSlot } from "./health.js";
import { KNOCKBACK_SLOT, processKnockbackSlot } from "./knockback.js";
import { SKIN_VARIANT_SLOT } from "../Skin.js";
import { writeSlotsGen } from "./sync.js";

/**
 * 处理全部已注册槽位：展开事件组 + 同步脚本元数据
 * @param {import('./types.js').MaidGeneratorApi} g
 */
export function processSlots(g) {
  console.log("展开槽位系统...");
  processAttackSlot(g);
  processHealthSlot(g);
  processKnockbackSlot(g);
  // variant 事件由 Skin.js 展开；此处一并同步数值区间到脚本
  writeSlotsGen([ATTACK_SLOT, HEALTH_SLOT, KNOCKBACK_SLOT, SKIN_VARIANT_SLOT]);
}
