/**
 * 槽位系统对外桶导出（脚本→JSON 原子组件挂载）。
 * 使用场景：业务 facets 从本文件导入 Slots / AttackSlot，位于 Level 等业务层之下。
 */
export { ATTACK_SLOT, INT_SLOTS } from "./registry";
export type { IntSlotDef } from "./registry";
export { slotMountEvent, slotQuitEvent, slotDpKey } from "./names";
export {
  isIntTokenInRange,
  getIntSlot,
  setIntSlot,
  clearIntSlot,
} from "./runtime";
export { AttackSlot } from "./AttackSlot";

import { AttackSlot } from "./AttackSlot";

/**
 * 具名槽位聚合：Slots.attack.set(maid, 12)
 */
export const Slots = {
  attack: AttackSlot,
};
