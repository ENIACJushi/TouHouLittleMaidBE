import { Entity } from "@minecraft/server";
import { Vector } from "../../../libs/VectorMC";
import { Amulet, GeneralBullet, GeneralBulletType } from "../../shapes/main";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { AmuletController } from "../../shapes/bullets/Amulet";
import { getRandom } from "../../../libs/ScarletToolKit";
/**
 * 
 * @param {Entity} entity 
 * @param {Location} location 
 * @param {Vector} direction 
 * @param {number} damage 
 * @param {number} piercing 穿透力 暂未实现
 */
export function shoot (entity: Entity, location: Location, direction: Vector, damage: number=3, piercing: number=0) {
  let bulletShoot0 = new BulletShoot({
    thrower: new EntityDanmakuActor(entity, true).setOffset(new Vector(0, -0.3, 0)),
    shape: new Amulet()
      .setDamage(damage)
  })
  let bullet = bulletShoot0.shootByDirection({
    x: getRandom(-1, 1),
    y: getRandom(-1, 1),
    z: getRandom(-1, 1),
  }, 0.35, 0);
  // let bullet = bulletShoot0.shootByDirection(direction, 0.5, 0.05);
  if (!bullet) {
    return;
  }
  let amuletController = new AmuletController(bullet)
    .setTurningIncrement(5)
    .setTurningStep(1);
  amuletController.startTurningTask(entity.getViewDirection());
  // let bulletShoot = new BulletShoot({
  //   thrower: new EntityDanmakuActor(entity, true),
  //   shape: new GeneralBullet()
  //     .setDamage(damage)
  //     .setGeneralBulletType(GeneralBulletType.AMULET)
  // })
  
  // bulletShoot.shootByDirection(direction, 0.5, 0.05);
}