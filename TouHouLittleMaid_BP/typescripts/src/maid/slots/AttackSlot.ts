/**
 * 攻击伤害槽位具名 API（对应 JSON slot:attack_<n>）。
 * 使用场景：Level 等业务设置近战伤害档，禁止业务直接 triggerEvent("slot:attack_…")。
 */
import { Entity } from "@minecraft/server";
import { ATTACK_SLOT } from "./registry";
import { clearIntSlot, getIntSlot, setIntSlot } from "./runtime";

/**
 * minecraft:attack.damage 原子槽（范围见 ATTACK_SLOT）
 */
export const AttackSlot = {
  /** 槽位元数据（只读），便于上层查询合法区间 */
  def: ATTACK_SLOT,

  /**
   * 获取当前伤害档；尚未通过本 API 设置过则为 undefined
   */
  get(maid: Entity): number | undefined {
    return getIntSlot(maid, ATTACK_SLOT);
  },

  /**
   * 设置伤害档（2~32，step=2）；非偶数向下对齐，如 13→12；越界返回 false
   */
  set(maid: Entity, damage: number): boolean {
    return setIntSlot(maid, ATTACK_SLOT, damage);
  },

  /**
   * 卸下当前伤害档组件组
   */
  clear(maid: Entity): void {
    clearIntSlot(maid, ATTACK_SLOT);
  },
};
