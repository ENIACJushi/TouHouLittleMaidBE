// 已迁移，重定向后删除
export class DanmakuType {
    /**
     * 弹幕类型枚举
     *
     * @param {Double} size 弹幕渲染放大缩小倍数，目前没有实现（TODO）
     */
    constructor(size) {
        this.size = size;
    }
    /**
     * 因为这不是一个真正的枚举类，处理类型时是直接看对应的数字，所以这里只是检查一下合法性
     * @param {Integer} index
     * @returns {Integer}
     */
    static getType(index) {
        if (index <= 0 || index > this.AMOUNT) {
            return this.PELLET;
        }
        return index;
    }
    /**
     * @returns {Integer}
     */
    static random() {
        return 1 + Math.floor(Math.random() * this.AMOUNT);
    }
    /**
     * @returns {Integer}
     */
    static getLength() {
        return this.AMOUNT;
    }
    /**
     * 获得类型对应的名称，如"pellet"
     * @param {Integer} index
     * @returns {string}
     */
    static getName(index) {
        return this.NAME_LIST[this.getType(index) - 1];
    }
    /**
     * 获得类型对应的弹幕实体名称，如"thlmd:danmaku_basic_pellet";
     * @param {Integer} index
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
    /**
     * @returns {Double}
     */
    getSize() {
        return this.size;
    }
}
DanmakuType.DanmakuPrefix = "thlmd:danmaku_basic_";
DanmakuType.AMOUNT = 10; // 总数
DanmakuType.RANDOM = -1; // 随机
DanmakuType.PELLET = 1; // 点弹    danmaku_new.png 1
DanmakuType.BALL = 2; // 小玉    danmaku_new.png 2
DanmakuType.ORBS = 3; // 环玉    danmaku_new.png 3
DanmakuType.BIG_BALL = 4; // 中玉    danmaku_new.png 4
DanmakuType.BUBBLE = 5; // 大玉    singe_plane_danmaku.png 5
DanmakuType.HEART = 6; // 心弹    singe_plane_danmaku.png 6
DanmakuType.AMULET = 7; // 札弹    amulet_danmaku.png
DanmakuType.STAR = 8; // 星弹    star_danmaku.png 1
DanmakuType.BIG_STAR = 9; // 大星弹  star_danmaku.png 2
DanmakuType.GLOWEY_BALL = 10; // 光玉    glowey_ball.png  大一号材质(64*64)
DanmakuType.PETAL = 11; // 米弹    petal.obj
DanmakuType.KNIFE = 12; // 刀弹    knife_bottom.obj knife_top.obj
DanmakuType.MASTER_SPARK = 13; // 魔炮    gossip.obj(八卦炉)
DanmakuType.BULLET = 14; // 铳弹    bullet_danmaku.obj
DanmakuType.KUNAI = 15; // 苦无弹  kunai.obj
DanmakuType.RAINDROP = 16; // 滴弹    raindrop.obj
DanmakuType.ARROWHEAD = 17; // 鳞弹    arrowhead.obj
DanmakuType.BUTTERFLY = 18; // 蝶弹    butterfly.obj
DanmakuType.JELLYBEAN = 19; // 椭弹    内置渲染
DanmakuType.NAME_LIST = [
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
//# sourceMappingURL=DanmakuType.js.map