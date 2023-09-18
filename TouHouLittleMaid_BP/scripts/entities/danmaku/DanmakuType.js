
export default class DanmakuType{
    static DanmakuPrefix = "thlmd:danmaku_basic_";
    static AMOUNT   = 4;

    static RANDOM   = -1;
    static PELLET   = 1;
    static BALL     = 2;
    static ORBS     = 3;
    static BIG_BALL = 4;
    static NAME_LIST = [
        "pellet",
        "ball",
        "orbs",
        "big_ball"
    ]
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
    static getName(index){
        return this.NAME_LIST[this.getType(index)-1];
    }
    /**
     * 获得类型对应的弹幕实体名称，如"thlmd:danmaku_basic_pellet";
     * @param {Integer} index 
     * @returns {string}
     */
    static getEntityName(index){
        if(index==this.RANDOM){
            return this.DanmakuPrefix + this.NAME_LIST[this.random()-1];
        }
        else{
            return this.DanmakuPrefix + this.NAME_LIST[this.getType(index)-1];
        }
    }
    /**
     * @returns {Double}
     */
    getSize() {
        return this.size;
    }
}