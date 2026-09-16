import { Entity } from "@minecraft/server";
import { PackedState } from "./PackedState";

/**
 * 饥饿值（压缩在 thlm:anim 的 bit3~7）
 * 统一 API：get / set（0~20）
 */
export const Food = {
  MAX: 20,
  SHIFT: 3,
  MASK: 0x1F,
  DEFAULT: 20,

  /**
   * 获取饥饿值 0~20（属性缺失时按默认 20）
   */
  get(maid: Entity): number {
    return (PackedState.get(maid) >> this.SHIFT) & this.MASK;
  },

  /**
   * 设置饥饿值（钳制到 0~20）
   */
  set(maid: Entity, value: number): void {
    let food = Math.max(0, Math.min(this.MAX, Math.floor(Number(value) || 0)));
    let cur = PackedState.get(maid);
    maid.setProperty(
      PackedState.PROPERTY,
      (cur & ~(this.MASK << this.SHIFT)) | (food << this.SHIFT),
    );
  },
};
