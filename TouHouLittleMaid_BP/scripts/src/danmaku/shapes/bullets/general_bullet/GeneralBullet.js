import { BulletBase } from "../BulletBase";
import { GeneralBulletColor } from "./GeneralBulletColor";
import { GeneralBulletType } from "./GeneralBulletType";
export class GeneralBullet extends BulletBase {
    constructor() {
        super(...arguments);
        this.color = GeneralBulletColor.RANDOM; // 颜色，仅通用弹种
        this.type = GeneralBulletType.RANDOM; // 类型，仅通用弹种
    }
    //// 构建 ////
    createBulletEntity(world, location) {
        let bullet = super.createBulletEntity(world, location);
        this.applyColor(bullet);
        return bullet;
    }
    getBulletEntityName() {
        let type = this.type === GeneralBulletType.RANDOM ? GeneralBulletType.random() : this.type;
        return GeneralBulletType.getEntityName(type);
    }
    applyColor(danmaku) {
        danmaku.triggerEvent(GeneralBulletColor.getTriggerEvent(this.color));
    }
    //// 设置函数 ////
    /**
     * @param color GeneralBulletColor
     */
    setColor(color) {
        this.color = color;
        return this;
    }
    /**
     * 设置随机颜色
     */
    setRandomColor() {
        this.color = GeneralBulletColor.random();
        return this;
    }
    /**
     * 设置弹幕类型
     */
    setGeneralBulletType(type) {
        this.type = type;
        return this;
    }
    /**
     * 设置随机类型
     */
    setRandomType() {
        this.type = GeneralBulletType.random();
        return this;
    }
}
//# sourceMappingURL=GeneralBullet.js.map