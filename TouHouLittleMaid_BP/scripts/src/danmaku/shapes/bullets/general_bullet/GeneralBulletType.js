/**
 * 通用弹幕类型枚举
 */
export class GeneralBulletType {
    /**
     * 因为这不是一个真正的枚举类，处理类型时是直接看对应的数字，所以这里只是检查一下合法性
     * @param {number} index
     * @returns {number}
     */
    static getType(index) {
        if (index <= 0 || index > this.AMOUNT) {
            return this.PELLET;
        }
        return index;
    }
    /**
     * @returns {number}
     */
    static random() {
        return 1 + Math.floor(Math.random() * this.AMOUNT);
    }
    /**
     * @returns {number}
     */
    static getLength() {
        return this.AMOUNT;
    }
    /**
     * 获得类型对应的名称，如"pellet"
     * @param {number} index
     * @returns {string}
     */
    static getName(index) {
        return this.NAME_LIST[this.getType(index) - 1];
    }
    /**
     * 获得类型对应的弹幕实体名称，如"thlmd:danmaku_basic_pellet";
     * @param {number} index
     * @returns {string}
     */
    static getEntityName(index) {
        if (index == this.RANDOM) {
            return this.DanmakuPrefix + this.NAME_LIST[this.random() - 1];
        }
        else {
            return this.DanmakuPrefix + this.NAME_LIST[this.getType(index) - 1];
        }
    }
}
GeneralBulletType.DanmakuPrefix = "thlmd:danmaku_basic_";
GeneralBulletType.AMOUNT = 10; // 总数
GeneralBulletType.RANDOM = -1; // 随机
GeneralBulletType.PELLET = 1; // 点弹    danmaku_new.png 1
GeneralBulletType.BALL = 2; // 小玉    danmaku_new.png 2
GeneralBulletType.ORBS = 3; // 环玉    danmaku_new.png 3
GeneralBulletType.BIG_BALL = 4; // 中玉    danmaku_new.png 4
GeneralBulletType.BUBBLE = 5; // 大玉    singe_plane_danmaku.png 5
GeneralBulletType.HEART = 6; // 心弹    singe_plane_danmaku.png 6
GeneralBulletType.AMULET = 7; // 札弹    amulet_danmaku.png
GeneralBulletType.STAR = 8; // 星弹    star_danmaku.png 1
GeneralBulletType.BIG_STAR = 9; // 大星弹  star_danmaku.png 2
GeneralBulletType.GLOWEY_BALL = 10; // 光玉    glowey_ball.png  大一号材质(64*64)
GeneralBulletType.PETAL = 11; // 米弹    petal.obj
GeneralBulletType.KNIFE = 12; // 刀弹    knife_bottom.obj knife_top.obj
GeneralBulletType.MASTER_SPARK = 13; // 魔炮    gossip.obj(八卦炉)
GeneralBulletType.BULLET = 14; // 铳弹    bullet_danmaku.obj
GeneralBulletType.KUNAI = 15; // 苦无弹  kunai.obj
GeneralBulletType.RAINDROP = 16; // 滴弹    raindrop.obj
GeneralBulletType.ARROWHEAD = 17; // 鳞弹    arrowhead.obj
GeneralBulletType.BUTTERFLY = 18; // 蝶弹    butterfly.obj
GeneralBulletType.JELLYBEAN = 19; // 椭弹    内置渲染
GeneralBulletType.NAME_LIST = [
    "pellet",
    "ball",
    "orbs",
    "big_ball",
    "bubble",
    "heart",
    "amulet",
    "star",
    "big_star",
    "glowey_ball"
];
//# sourceMappingURL=GeneralBulletType.js.map