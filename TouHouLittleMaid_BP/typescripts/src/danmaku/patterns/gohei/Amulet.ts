import { Entity } from "@minecraft/server";
import { Vector } from "../../../libs/VectorMC";
import { Amulet, GeneralBullet, GeneralBulletType } from "../../shapes/main";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
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
    thrower: new EntityDanmakuActor(entity, true),
    shape: new Amulet()
      .setDamage(damage)
  })
  bulletShoot0.shootByDirection(direction, 0.1, 0);

  // let bulletShoot = new BulletShoot({
  //   thrower: new EntityDanmakuActor(entity, true),
  //   shape: new GeneralBullet()
  //     .setDamage(damage)
  //     .setGeneralBulletType(GeneralBulletType.AMULET)
  // })
  
  // bulletShoot.shootByDirection(direction, 0.5, 0.05);
}