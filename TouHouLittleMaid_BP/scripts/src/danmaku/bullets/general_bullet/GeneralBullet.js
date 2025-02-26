import { BulletBase } from "../BulletBase";
import { GeneralBulletColor } from "./GeneralBulletColor";
import { GeneralBulletType } from "./GeneralBulletType";
export class GeneralBullet extends BulletBase {
    constructor() {
        super(...arguments);
        this.color = GeneralBulletColor.RANDOM; // 颜色，仅通用弹种
        this.type = GeneralBulletType.RANDOM; // 类型，仅通用弹种
    }
    shoot(direction, velocity, inaccuracy) {
        let danmaku = super.shoot(direction, velocity, inaccuracy);
        if (!danmaku) {
            return undefined;
        }
        this.applyColor(danmaku);
        return danmaku;
    }
    shoot_bedrock(velocity, inaccuracy) {
        let danmaku = super.shoot(velocity, inaccuracy);
        if (!danmaku) {
            return undefined;
        }
        this.applyColor(danmaku);
        return danmaku;
    }
    //// 工厂函数 ////
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
     * @param type GeneralBulletType
     */
    setGeneralBulletType(type) {
        this.type = type;
        return this;
    }
}
//# sourceMappingURL=GeneralBullet.js.map