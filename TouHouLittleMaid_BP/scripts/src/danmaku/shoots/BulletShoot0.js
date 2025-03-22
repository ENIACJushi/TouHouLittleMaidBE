import { GeneralBulletColor, GeneralBulletType, } from "../shapes/main";
import { Vector } from "../../libs/VectorMC";
export class BulletShoot0 {
    constructor() {
        this.enable_shoot_location = false;
        this.enable_target_location = false;
        this.pre_judge = false;
        this.pre_judge_verticle = false;
        this.target_offset = new Vector(0, 0, 0);
        this.thrower_offset = new Vector(0, 0, 0); // 获取不了碰撞箱大小，故手动指定
        // Danmaku basic
        this.color = GeneralBulletColor.RANDOM;
        this.type = GeneralBulletType.RANDOM;
        this.damage = 6;
        this.gravity = 0.2;
        this.velocity = 0.6;
        this.inaccuracy = 0;
        this.lifeTime = 0;
        // Fan Shaped
        this.yawTotal = 3;
        this.fanNum = 3;
        this.axisRotation = 0; // 中轴绕发射向量的旋转角度（先转）
        this.directionRotation = 0; // 发射向量绕旋转向量旋转的角度（后转）
    }
    static create() {
        return new BulletShoot0();
    }
}
BulletShoot0.RANDOM = Math.random();
BulletShoot0.MAX_YAW = 2 * Math.PI;
BulletShoot0.MIN_FAN_NUM = 2;
//# sourceMappingURL=BulletShoot0.js.map