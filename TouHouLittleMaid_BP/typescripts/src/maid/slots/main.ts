/**
 * 槽位系统对外桶导出（脚本→JSON 原子组件挂载）。
 * 使用场景：业务 facets 从本文件导入 Slots / AttackSlot，位于 Level 等业务层之下。
 */
export { ATTACK_SLOT, HEALTH_SLOT, VARIANT_SLOT, INT_SLOTS } from "./registry";
export type { IntSlotDef } from "./registry";
export { slotMountEvent, slotQuitEvent, slotDpKey } from "./names";
export {
  isIntTokenInRange,
  getIntSlot,
  setIntSlot,
  clearIntSlot,
  defaultSlotEvents,
  SKIN_LEGACY_EVENTS,
} from "./runtime";
export type { SlotEventNames, SetIntSlotOptions } from "./runtime";
export { AttackSlot } from "./AttackSlot";
export { HealthSlot } from "./HealthSlot";
export { VariantSlot } from "./VariantSlot";

import { AttackSlot } from "./AttackSlot";
import { HealthSlot } from "./HealthSlot";
import { VariantSlot } from "./VariantSlot";

/**
 * 具名槽位聚合：Slots.attack / health / variant
 */
export const Slots = {
  attack: AttackSlot,
  health: HealthSlot,
  variant: VariantSlot,
};
