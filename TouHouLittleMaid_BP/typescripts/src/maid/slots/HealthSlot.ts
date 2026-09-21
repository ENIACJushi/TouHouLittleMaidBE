/**
 * 最大生命槽位具名 API（对应 JSON slot:health_<n>）。
 * 使用场景：Health.setMax / Level 组合设置 max HP；换组可能重置当前生命为同档 value。
 */
import { Entity } from "@minecraft/server";
import { HEALTH_SLOT } from "./registry";
import { clearIntSlot, getIntSlot, setIntSlot } from "./runtime";

/**
 * minecraft:health（value/max 同档）原子槽（范围见 HEALTH_SLOT）
 */
export const HealthSlot = {
  /** 槽位元数据（只读） */
  def: HEALTH_SLOT,

  /**
   * 获取当前已通过本 API 设置的最大生命档；未设置过则为 undefined
   */
  get(maid: Entity): number | undefined {
    return getIntSlot(maid, HEALTH_SLOT);
  },

  /**
   * 设置最大生命档（20~100）；越界返回 false
   */
  set(maid: Entity, maxHp: number): boolean {
    return setIntSlot(maid, HEALTH_SLOT, maxHp);
  },

  /**
   * 卸下当前 health 槽组件组
   */
  clear(maid: Entity): void {
    clearIntSlot(maid, HEALTH_SLOT);
  },
};
