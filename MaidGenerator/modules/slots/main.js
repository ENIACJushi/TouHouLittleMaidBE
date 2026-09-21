/**
 * 槽位模块入口：集中调用各先锋/业务槽的展开。
 * 使用场景：MaidGenerator.main 在 Skin/Seek 之外注册脚本→JSON 原子挂载点。
 */
import { processAttackSlot } from "./attack.js";
import { processHealthSlot } from "./health.js";

/**
 * 处理全部已注册槽位
 * @param {object} g MaidGenerator 实例
 */
export function processSlots(g) {
  console.log("展开槽位系统...");
  processAttackSlot(g);
  processHealthSlot(g);
}
