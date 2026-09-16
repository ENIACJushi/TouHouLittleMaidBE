import { Entity, EntityHealthComponent } from "@minecraft/server";

/**
 * 生命值读写与显示字符串（行为对齐 EntityMaid.Health）
 */
export const Health = {
  /**
   * 获取生命值属性
   */
  getComponent(maid: Entity): EntityHealthComponent {
    return maid.getComponent("health") as EntityHealthComponent;
  },
  /**
   * 获取当前生命值
   */
  get(maid: Entity): number {
    return this.getComponent(maid).currentValue;
  },
  /**
   * 获取最大生命值
   */
  getMax(maid: Entity): number {
    return this.getComponent(maid).defaultValue;
  },

  /**
   * 设置生命值
   */
  set(maid: Entity, amount: number): boolean {
    return this.getComponent(maid).setCurrentValue(amount);
  },
  /**
   * TODO: 设置最大生命值 *未实现
   */
  setMax(maid: Entity, amount: number): void {

  },
  // 特殊字符的起始位置
  strOffset: 0xE600,
  /**
   * 将健康值（整数）转换为文本
   */
  toStr(health: number): string {
    let result = "";
    let stack = Math.floor(health / 20);
    let value = health % 20;
    if (value === 0) value = 20;
    for (let i = 10; i > 0;) {
      if (value >= 2) {
        value -= 2;
        result += this.fullStr();
      }
      else if (value === 1) {
        value -= 1;
        result += this.halfStr();
      }
      else {
        result += this.emptyStr();
      }
      i--;
    }
    return result;
  },
  emptyStr(): string { return String.fromCodePoint(this.strOffset + 0x03); },
  halfStr(): string { return String.fromCodePoint(this.strOffset + 0x04); },
  fullStr(): string { return String.fromCodePoint(this.strOffset + 0x05); },
};
