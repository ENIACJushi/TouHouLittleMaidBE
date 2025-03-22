import { Vector, VectorMC } from "../../../src/libs/VectorMC";
import { BulletShoot } from "../shoots/BulletShoot";
/**
 * 图案需要给定 Shoot 才能发射
 */
export class BulletPatternBase {
    constructor(bulletShoot) {
        this.bulletShoot = bulletShoot;
    }
    shootByDirection(data, direction, velocity, inaccuracy = 0) {
        // 转换并动量
        let bedrockVelocity;
        if (velocity === 0) {
            bedrockVelocity = new Vector(0, 0, 0);
        }
        else {
            bedrockVelocity = VectorMC.getVector_speed_direction(velocity, new Vector(direction.x, direction.y, direction.z));
        }
        return this.shootByVelocity(data, bedrockVelocity, inaccuracy);
    }
    shootByTarget(data, velocity, inaccuracy, _target) {
        // 确定目标
        let target = _target;
        if (!target) {
            if (!this.bulletShoot.target) {
                return false;
            }
            target = this.bulletShoot.target;
        }
        // 计算向量
        let v = BulletShoot.getVelocity2Target(this.bulletShoot.thrower, target, velocity, this.bulletShoot.preJudge, this.bulletShoot.preJudgeVerticle);
        if (!v) {
            return false;
        }
        // 射击
        return this.shootByVelocity(data, v, inaccuracy);
    }
}
//# sourceMappingURL=BulletPatternBase.js.map