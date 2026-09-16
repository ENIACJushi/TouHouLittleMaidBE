import { Entity } from "@minecraft/server";
import { Movement } from "./Movement";

/**
 * 压缩位标志（thlm:anim）与姿态辅助
 * bit0 坐下 / bit1 抱起 / bit2 睡觉 / bit3~7 food_level（0~20，默认 20）
 */
export const Anim = {
  PROPERTY: "thlm:anim",
  BIT_SIT: 1 << 0,
  BIT_HUG: 1 << 1,
  BIT_SLEEP: 1 << 2,
  FOOD_SHIFT: 3,
  FOOD_MASK: 0x1F,
  FOOD_MAX: 20,
  FOOD_DEFAULT: 20,
  /**
   * 读取完整 anim 整型
   */
  get(maid: Entity): number {
    return (maid.getProperty(this.PROPERTY) as number | undefined)
      ?? (this.FOOD_DEFAULT << this.FOOD_SHIFT);
  },
  /**
   * 是否设置了指定位
   */
  has(maid: Entity, bit: number): boolean {
    return (this.get(maid) & bit) !== 0;
  },
  /**
   * 设置/清除指定位
   */
  setBit(maid: Entity, bit: number, value: boolean): void {
    let cur = this.get(maid);
    maid.setProperty(this.PROPERTY, value ? (cur | bit) : (cur & ~bit));
  },
  /**
   * 获取饥饿值 0~20
   */
  getFood(maid: Entity): number {
    // 饥饿值默认为 20，获取不到时按默认值返回
    return (this.get(maid) >> this.FOOD_SHIFT) & this.FOOD_MASK;
  },
  /**
   * 设置饥饿值（实际有效范围 0~20）
   */
  setFood(maid: Entity, value: number): void {
    let food = Math.max(0, Math.min(this.FOOD_MAX, Math.floor(Number(value) || 0)));
    let cur = this.get(maid);
    maid.setProperty(
      this.PROPERTY,
      (cur & ~(this.FOOD_MASK << this.FOOD_SHIFT)) | (food << this.FOOD_SHIFT),
    );
  },

  /** 是否处于坐下状态 */
  isSitting(maid: Entity): boolean {
    return this.has(maid, this.BIT_SIT);
  },

  /**
   * 设置坐下位（由实体事件 thlmm:j / thlmm:v 写入）
   * 同步锁定/恢复 minecraft:movement，避免坐下后仍寻路移动
   */
  setSitting(maid: Entity, value: boolean): void {
    this.setBit(maid, this.BIT_SIT, value);
    if (value) {
      Movement.lock(maid);
    }
    else {
      Movement.unlock(maid);
    }
  },

  /** 是否处于抱起状态 */
  isHug(maid: Entity): boolean {
    return this.has(maid, this.BIT_HUG);
  },

  /** 设置抱起位 */
  setHug(maid: Entity, value: boolean): void {
    this.setBit(maid, this.BIT_HUG, value);
  },

  /** 是否处于睡觉状态（bit2） */
  isSleeping(maid: Entity): boolean {
    return this.has(maid, this.BIT_SLEEP);
  },

  /** 设置睡觉位 */
  setSleeping(maid: Entity, value: boolean): void {
    this.setBit(maid, this.BIT_SLEEP, value);
  },

  /** 获取饥饿值（压缩在 thlm:anim 的 bit3~7） */
  getFoodLevel(maid: Entity): number {
    return this.getFood(maid);
  },

  /** 设置饥饿值 */
  setFoodLevel(maid: Entity, value: number): void {
    this.setFood(maid, value);
  },

  /** 坐下（触发实体事件） */
  sitDown(maid: Entity): void {
    maid.triggerEvent("thlmm:v");
  },

  /** 站起（触发实体事件） */
  standUp(maid: Entity): void {
    maid.triggerEvent("thlmm:w");
  },
};
