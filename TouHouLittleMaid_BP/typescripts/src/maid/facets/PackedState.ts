import { Entity } from "@minecraft/server";
import { Movement } from "./Movement";

/**
 * 压缩姿态位域（实体属性仍为 thlm:anim，契约冻结不改名）
 * bit0 坐下 / bit1 抱起 / bit2 睡觉；饥饿见 Food
 */
export const PackedState = {
  /** 引擎侧属性名（历史命名，勿改） */
  PROPERTY: "thlm:anim",
  BIT_SIT: 1 << 0,
  BIT_HUG: 1 << 1,
  BIT_SLEEP: 1 << 2,

  /**
   * 读取完整压缩整型
   * 属性缺失时按「饥饿默认 20」填充高位（与 Food.DEFAULT/SHIFT 一致：20 << 3）
   */
  get(maid: Entity): number {
    return (maid.getProperty(this.PROPERTY) as number | undefined) ?? (20 << 3);
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

  /** 坐下（触发实体事件） */
  sitDown(maid: Entity): void {
    maid.triggerEvent("thlmm:v");
  },

  /** 站起（触发实体事件） */
  standUp(maid: Entity): void {
    maid.triggerEvent("thlmm:w");
  },
};
