import { Entity, system } from "@minecraft/server";
import {Vector, VO} from "../../../libs/VectorMC";
import { Amulet, GeneralBullet, GeneralBulletType } from "../../shapes/main";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { AmuletController } from "../../shapes/bullets/Amulet";
import { getRandom } from "../../../libs/ScarletToolKit";

export class AmuletGoheiPattern {
  /**
   * 射击
   */
  static shoot(entity: Entity, location: Vector, direction: Vector, damage: number = 3, piercing: number = 0) {
    // 创建新符札弹种
    let bulletShoot0 = new BulletShoot({
      thrower: new EntityDanmakuActor(entity, true)
        .setOffset(new Vector(0, -0.3, 0)), // 比相机略低
      shape: new Amulet()
        .setDamage(damage)
    })
    // 发射
    bulletShoot0.shootByDirection(direction, 1, 0.05);

    // 多重射击
    let viewVector = entity.getViewDirection();
    let viewVector2D = VO.normalized(new Vector(viewVector.x, 0, viewVector.z));
    viewVector2D = VO.multiply(viewVector2D, 2);

    bulletShoot0.thrower.setOffset(new Vector(- viewVector2D.z, -0.3, viewVector2D.x));
    bulletShoot0.shootByDirection(direction, 1, 0.05);
    bulletShoot0.thrower.setOffset(new Vector(viewVector2D.z, -0.3, - viewVector2D.x));
    bulletShoot0.shootByDirection(direction, 1, 0.05);
  }

  /**
   * 旧射击，使用通用弹幕类型
   */
  static shootOld(entity: Entity, location: Vector, direction: Vector, damage: number = 3, piercing: number = 0) {
    // 创建旧符札弹种
    let bulletShoot = new BulletShoot({
      thrower: new EntityDanmakuActor(entity, true),
      shape: new GeneralBullet()
        .setGeneralBulletType(GeneralBulletType.AMULET)
        .setDamage(damage)
    })
    bulletShoot.shootByDirection(direction, 0.5, 0.05);
  }

  /**
   * 测试射击，向随机方向发射符札，然后转弯，直到与发射者视线平行
   */
  static shootDebug(entity: Entity, location: Vector, direction: Vector, damage: number = 3, piercing: number = 0) {
    // 创建符札弹种
    let bulletShoot0 = new BulletShoot({
      thrower: new EntityDanmakuActor(entity, true).setOffset(new Vector(0, -0.3, 0)),
      shape: new Amulet()
        .setDamage(damage)
    })

    // 循环向随机方向抛射弹幕
    for (let i = 0; i < 7; i++) {
      system.runTimeout(()=>{
        let bullet = bulletShoot0.shootByDirection({
          x: getRandom(-1, 1),
          y: getRandom(-1, 1),
          z: getRandom(-1, 1),
        }, 0.2, 0);
        if (!bullet) {
          return;
        }
        let amuletController = new AmuletController(bullet);
        amuletController.startTurningTask(entity.getViewDirection(), 5, 1, () => {
          amuletController.speedUp(0.2);
        });
      }, i);
    }
  }
}
