/**
 * PS：颜色索引由1开始，而不是0
 */
export class GeneralBulletColor {
    static getLength() {
        return this.AMOUNT;
    }
    /**
     * 因为这不是一个真正的枚举类，处理颜色时是直接看对应的数字，所以这里只是检查一下合法性
     * @param index
     */
    static getColor(index) {
        if (index <= 0 || index > this.AMOUNT) {
            return this.RED;
        }
        return index;
    }
    /**
     * 获取一个随机颜色
     * @returns {number}
     */
    static random() {
        return 1 + Math.floor(Math.random() * this.AMOUNT);
    }
    /**
     * 获取颜色对应的实体事件
     */
    static getTriggerEvent(index) {
        if (index == this.RANDOM) {
            return "init_ramdon";
        }
        else {
            return "init_c" + this.getColor(index);
        }
    }
}
GeneralBulletColor.AMOUNT = 13; // 颜色总数
GeneralBulletColor.RANDOM = -1;
GeneralBulletColor.RED = 1;
GeneralBulletColor.ORANGE = 2;
GeneralBulletColor.YELLOW = 3;
GeneralBulletColor.LIME = 4;
GeneralBulletColor.LIGHT_GREEN = 5;
GeneralBulletColor.GREEN = 6;
GeneralBulletColor.CYAN = 7;
GeneralBulletColor.LIGHT_BLUE = 8;
GeneralBulletColor.BLUE = 8;
GeneralBulletColor.PURPLE = 9;
GeneralBulletColor.MAGENTA = 11;
GeneralBulletColor.PINK = 12;
GeneralBulletColor.GRAY = 13;
//# sourceMappingURL=GeneralBulletColor.js.map