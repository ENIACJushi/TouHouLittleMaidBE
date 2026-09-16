import { Entity } from "@minecraft/server";

/**
 * thlm:anim 压缩整型的底层读写（属性名冻结）
 * 姿态语义见 Pose；饥饿见 Food
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
   * 设置/清除指定位（不处理姿态互斥；姿态请用 Pose）
   */
  setBit(maid: Entity, bit: number, value: boolean): void {
    let cur = this.get(maid);
    maid.setProperty(this.PROPERTY, value ? (cur | bit) : (cur & ~bit));
  },
};
