
/**
 * 激光（伪）
 */
import { Vector } from "../../../libs/VectorMC";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { GeneralBullet, GeneralBulletColor, GeneralBulletType } from "../../shapes/main";
import { Entity, system } from "@minecraft/server";

export class FairyPatternTest6 {
  shoot(thrower: Entity, target: Entity): boolean {
    let bulletShoot = new BulletShoot({
      thrower: new EntityDanmakuActor(thrower)
        .setOffset(new Vector(0, 1, 0)),
      target: new EntityDanmakuActor(target)
        .setOffset(new Vector(0, 1, 0)),
      shape: new GeneralBullet()
        .setColor(GeneralBulletColor.RED)
        .setGeneralBulletType(GeneralBulletType.GLOWEY_BALL)
        .setDamage(0)
    });
    
    for (let i2 = 0; i2 < 80; i2++) {
      system.runTimeout(() => {
        bulletShoot.shootByTarget(0.1, 0);
        bulletShoot.shootByTarget(0.1, 0);
      }, i2)
    }
    return true;
  }
}
