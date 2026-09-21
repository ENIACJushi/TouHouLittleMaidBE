/**
 * 最大生命槽位：为 minecraft:health 生成 slot:health_<n>（value/max 同档）。
 * 使用场景：脚本 Slots.health.set / Health.setMax；拆 api:lv_*_basic 时由 Level 组合调用。
 */
import { expandIntSlot } from "./expand.js";

/** 覆盖 lv1=64、lv2=70，并预留升级区间 */
export const HEALTH_SLOT = {
  id: "health",
  kind: "int",
  min: 20,
  max: 100,
  component: "minecraft:health",
  shape: { value: "$", max: "$" },
};

/**
 * 将 health 槽展开进生成器
 * @param {object} g MaidGenerator 实例
 */
export function processHealthSlot(g) {
  expandIntSlot(g, HEALTH_SLOT);
}
