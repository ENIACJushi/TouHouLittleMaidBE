// 已迁移，重定向后删除

/**
 * PS：颜色索引由1开始，而不是0
 */
export class DanmakuColor{
    static AMOUNT  = 13;

    static RANDOM  = -1;
    static RED     = 1;
    static ORANGE  = 2;
    static YELLOW  = 3;
    static LIME    = 4;
    static LIGHT_GREEN = 5;
    static GREEN   = 6;
    static CYAN    = 7;
    static LIGHT_BLUE = 8;
    static BLUE    = 8;
    static PURPLE  = 9;
    static MAGENTA = 11;
    static PINK    = 12;
    static GRAY    = 13

    /**
     * @param {Integer} color 
     */
    constructor(color) {
        this.rgb        = color;
        this.red        = color >> 16 & 255;
        this.green      = color >> 8 & 255;
        this.blue       = color & 255;
        this.floatRed   = this.red / 255;
        this.floatGreen = this.green / 255;
        this.floatBlue  = this.blue / 255;
    }
    /**
     * 因为这不是一个真正的枚举类，处理颜色时是直接看对应的数字，所以这里只是检查一下合法性
     * @param {Integer} index
     * @returns {Integer}
     */
    static getColor(index){
        if (index <= 0 || index > this.AMOUNT) {
            return this.RED;
        }
        return index;
    }
    /**
     * @param {Integer} index
     * @return {string}
     */
    static getTriggerEvent(index){
        if(index==this.RANDOM){
            return "init_ramdon";
        }
        else{
            return "init_c" + this.getColor(index);
        }
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
     * @returns {Integer}
     */
    getRed() {
        return this.red;
    }
    /**
     * @returns {Integer}
     */
    getGreen() {
        return this.green;
    }
    /**
     * @returns {Integer}
     */
    getBlue() {
        return this.blue;
    }
    /**
     * @returns {Integer}
     */
    getFloatRed(){
        return this.floatRed;
    }
    /**
     * @returns {Integer}
     */
    getFloatGreen() {
        return this.floatGreen;
    }
    /**
     * @returns {Integer}
     */
    getFloatBlue() {
        return this.floatBlue;
    }
    /**
     * @returns {Integer}
     */
    getRgb() {
        return this.rgb;
    }
}