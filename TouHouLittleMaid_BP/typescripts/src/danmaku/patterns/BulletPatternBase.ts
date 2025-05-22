import { Vector, VO } from "../../libs/VectorMC";
import { BulletShoot } from "../shoots/BulletShoot";
import { DanmakuActor } from "../actors/DanmakuActor";

/**
 * 图案需要给定 Shoot 才能发射
 */
export abstract class BulletPatternBase<T> {
  bulletShoot: BulletShoot;

  constructor (bulletShoot: BulletShoot) {
    this.bulletShoot = bulletShoot;
  }
  /**
   * 图案需要提供指定发射向量的发射方法
   * 其它发射方法会自动基于这种方法给定
   */
  abstract shootByVelocity (data: T, velocity: Vector, inaccuracy: number): boolean;
  
  public shootByDirection (data: T, direction: Vector, velocity: number, inaccuracy: number = 0): boolean {
    // 转换并动量
    let bedrockVelocity: Vector;
    if (velocity === 0) {
      bedrockVelocity = new Vector(0, 0, 0);
    }
    else {
      bedrockVelocity = VO.Secondary.getVector_speed_direction(velocity, new Vector(direction.x, direction.y, direction.z));
    }
    return this.shootByVelocity(data, bedrockVelocity, inaccuracy);
  }

  public shootByTarget(data: T, velocity: number, inaccuracy: number, _target?: DanmakuActor): boolean {
    // 确定目标
    let target = _target;
    if (!target) {
      if (!this.bulletShoot.target) {
        return false;
      }
      target = this.bulletShoot.target;
    }
    // 计算向量
    let v = BulletShoot.getVelocity2Target(this.bulletShoot.thrower, target, velocity, 
      this.bulletShoot.preJudge, this.bulletShoot.preJudgeVerticle);
    if (!v) {
      return false;
    }
    // 射击
    return this.shootByVelocity(data, v, inaccuracy);
  }
}