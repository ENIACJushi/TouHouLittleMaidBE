/**
 * PS：颜色索引由1开始，而不是0
 */
export class GeneralBulletColor {
  static AMOUNT = 13; // 颜色总数

  static RANDOM = -1;
  static RED = 1;
  static ORANGE = 2;
  static YELLOW = 3;
  static LIME = 4;
  static LIGHT_GREEN = 5;
  static GREEN = 6;
  static CYAN = 7;
  static LIGHT_BLUE = 8;
  static BLUE = 8;
  static PURPLE = 9;
  static MAGENTA = 11;
  static PINK = 12;
  static GRAY = 13

  static getLength(): number {
    return this.AMOUNT;
  }

  /**
   * 因为这不是一个真正的枚举类，处理颜色时是直接看对应的数字，所以这里只是检查一下合法性
   * @param index
   */
  static getColor(index: number): number {
    if (index <= 0 || index > this.AMOUNT) {
      return this.RED;
    }
    return index;
  }

  /**
   * 获取一个随机颜色
   * @returns {number}
   */
  static random(): number {
    return 1 + Math.floor(Math.random() * this.AMOUNT);
  }

  /**
   * 获取颜色对应的实体事件
   */
  static getTriggerEvent(index: number): string {
    if (index == this.RANDOM) {
      return "init_ramdon";
    }
    else {
      return "init_c" + this.getColor(index);
    }
  }
}