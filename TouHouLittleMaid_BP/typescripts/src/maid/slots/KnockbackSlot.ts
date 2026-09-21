/**
 * 抗击退槽位具名 API（对应 JSON slot:knockback_<n>，n 为百分制）。
 * 使用场景：Level 设 10/20；NPC 等设 100；也可用 setRatio 传入 0~1 浮点。
 */
import { Entity } from "@minecraft/server";
import { KNOCKBACK_SLOT } from "./registry";
import { clearIntSlot, getIntSlot, setIntSlot } from "./runtime";

/**
 * 将引擎 ratio（0~1）转为百分制 token（四舍五入到整数）
 */
export function knockbackRatioToToken(ratio: number): number {
  return Math.round(ratio * 100);
}

/**
 * 百分制 token → 引擎 ratio
 */
export function knockbackTokenToRatio(token: number): number {
  return token / 100;
}

/**
 * minecraft:knockback_resistance 原子槽（百分制见 KNOCKBACK_SLOT）
 */
export const KnockbackSlot = {
  /** 槽位元数据（只读） */
  def: KNOCKBACK_SLOT,

  /**
   * 获取当前百分制档；未通过本 API 设置过则为 undefined
   */
  get(maid: Entity): number | undefined {
    return getIntSlot(maid, KNOCKBACK_SLOT);
  },

  /**
   * 设置百分制抗击退（0~100）；越界返回 false
   */
  set(maid: Entity, percent: number): boolean {
    return setIntSlot(maid, KNOCKBACK_SLOT, percent);
  },

  /**
   * 按引擎 ratio（0~1）设置；内部四舍五入到百分制
   */
  setRatio(maid: Entity, ratio: number): boolean {
    return this.set(maid, knockbackRatioToToken(ratio));
  },

  /**
   * 当前档对应的 ratio；无档则 undefined
   */
  getRatio(maid: Entity): number | undefined {
    const token = this.get(maid);
    return token === undefined ? undefined : knockbackTokenToRatio(token);
  },

  /**
   * 卸下当前 knockback 槽组件组
   */
  clear(maid: Entity): void {
    clearIntSlot(maid, KNOCKBACK_SLOT);
  },
};
