import { Entity, system } from "@minecraft/server";
import {Vector, VO} from "../../../libs/VectorMC";
import { Amulet, GeneralBullet, GeneralBulletType } from "../../shapes/main";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { AmuletController } from "../../shapes/bullets/Amulet";
import { getRandom } from "../../../libs/ScarletToolKit";

export interface AmuletGoheiPatternParams {
  entity: Entity; // 发射弹幕的实体
  direction: Vector; // 发射方向
  amount?: number; // 一次发射的数量，默认1
  spacing?: number; // 发射大于一个的弹幕时，弹幕之间的间距，默认为4
  velocity?: number; // 动量大小 默认 1
  inaccuracy?: number; // 散步，默认 0.05
  damage?: number; // 伤害，默认 3
  piercing?: number; // 穿透力，默认为 0
  offsetY?: number; // 发射位置相对头部位置在Y方向的偏移]
}

export class AmuletGoheiPattern {
  /**
   * 射击
   */
  static shoot(params: AmuletGoheiPatternParams) {
    let entity = params.entity;
    let direction = params.direction;
    let damage = params.damage ?? 5;
    let velocity = params.velocity ?? 1;
    let inaccuracy = params.inaccuracy ?? 0.05;
    let amount = params.amount ?? 1;
    let spacing = params.spacing ?? 3;
    let offsetY = params.offsetY ?? -0.4;
    let piercing = params.piercing ?? 0;

    // 创建新符札弹种
    let bulletShoot0 = new BulletShoot({
      thrower: new EntityDanmakuActor(entity, true)
        .setOffset(new Vector(0, offsetY, 0)), // 比相机略低
      shape: new Amulet()
        .setDamage(damage)
        .setPiercing(piercing)
        .setXRotation(90)
    });
    /**
     * 多重射击
     *  如果是单数，在零偏移处射一发，然后按双数处理
     *  如果是双数，则在左右平均分布，和 STG 的排列方式相同
     */
    let viewVector = entity.getViewDirection();
    let viewVector2D = VO.normalized(new Vector(viewVector.x, 0, viewVector.z));
    // 单数
    if (amount % 2 === 1) {
      bulletShoot0.shootByDirection(direction, velocity, inaccuracy);
    }
    // 双数
    for (let i = 0; i + 1<= amount/2; i++) {
      bulletShoot0.thrower.setOffset(new Vector(
        -viewVector2D.z * spacing * (i + 0.5),
        offsetY,
        viewVector2D.x * spacing * (i + 0.5),
      ));
      bulletShoot0.shootByDirection(direction, velocity, inaccuracy);

      bulletShoot0.thrower.setOffset(new Vector(
        viewVector2D.z * spacing * (i + 0.5),
        offsetY,
        -viewVector2D.x * spacing * (i + 0.5),
      ));
      bulletShoot0.shootByDirection(direction, velocity, inaccuracy);
    }
  }

  /**
   * 旧射击，使用通用弹幕类型
   */
  static shootOld(entity: Entity, direction: Vector, damage: number = 3, piercing: number = 0) {
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
  static shootDebug(entity: Entity, direction: Vector, damage: number = 3, piercing: number = 0) {
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
