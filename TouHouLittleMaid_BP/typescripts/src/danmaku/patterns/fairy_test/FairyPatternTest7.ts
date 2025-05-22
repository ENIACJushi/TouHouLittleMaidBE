
  
/**
 * 曲线激光（伪）
 */
import { Vector, VO } from "../../../libs/VectorMC";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { GeneralBullet, GeneralBulletColor, GeneralBulletType } from "../../shapes/main";
import { Entity, system } from "@minecraft/server";

var laserRadius = 0;
var laserStep = 0.1;

export class FairyPatternTest7{
  laserIsShooting: boolean = false;
  shoot(thrower: Entity, target: Entity): boolean {
    if (this.laserIsShooting) {
      return false;
    }
    
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

    let direction = thrower.getViewDirection();
    let axis = VO.normalized(VO.Advanced.getAnyVerticalVector(direction));
    var shootNext = function () {
      system.runTimeout(() => {
        if (laserRadius > 60 || laserRadius < -60) {
          laserStep = -laserStep;
        }
        laserRadius += laserStep;

        let direction_shoot = VO.Secondary.rotate_axis(direction, axis, laserRadius * Math.PI / 180);
        bulletShoot.shootByDirection(new Vector(direction_shoot.x, direction_shoot.y, direction_shoot.z), 0.1);
        shootNext();
      }, 1)
    }
    shootNext();
    return true;
  }
}
  