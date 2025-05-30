
/**
 * 带sigma的自机狙
 */
import { Vector } from "../../../libs/VectorMC";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { GeneralBullet, GeneralBulletColor, GeneralBulletType } from "../../shapes/main";
import { Entity, system } from "@minecraft/server";

export class FairyPatternTest1 {
  shoot(thrower: Entity, target: Entity): boolean {
    let bulletShoot = new BulletShoot({
      thrower: new EntityDanmakuActor(thrower)
        .setOffset(new Vector(0, 1, 0)),
      target: new EntityDanmakuActor(target)
        .setOffset(new Vector(0, 1, 0)),
      shape: new GeneralBullet()
        .setColor(GeneralBulletColor.random())
        .setGeneralBulletType(GeneralBulletType.BALL)
        .setDamage(6)
    });

    for (let i = 0; i < 40; i++) {
      system.runTimeout(() => {
        bulletShoot.shootByTarget(0.6, 6);
      }, i + 10);
    }
    return true;
  }
}
