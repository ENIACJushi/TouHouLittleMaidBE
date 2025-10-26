/**
 * 米字弹幕
 */
import { Vector } from "../../../libs/VectorMC";
import { LineShoot } from "../../shoots/LineShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { GeneralBullet, GeneralBulletType } from "../../shapes/main";
import { FanShapedPattern } from "../line/FanShapedPattern";
import { Entity } from "@minecraft/server";

export class FairyPatternTest0 {
  shoot(thrower: Entity, target: Entity): boolean {

    let bulletShoot = new LineShoot({
      thrower: new EntityDanmakuActor(thrower)
        .setOffset(new Vector(0, 1, 0)),
      target: new EntityDanmakuActor(target)
        .setOffset(new Vector(0, 1, 0)),
      shape: new GeneralBullet()
        .setRandomColor()
        .setGeneralBulletType(GeneralBulletType.BALL)
        .setDamage(6)
    });

    let fanShapedPattern = new FanShapedPattern(bulletShoot);
    fanShapedPattern.shootByTarget({
      fanNum: 17,
      yawTotal: Math.PI / 4,
      axisRotation: 0,
    }, 1, 0);
      
    let yaw = Math.PI / 8;
    for (let i = -4; i < 4; i++) {
      fanShapedPattern.shootByTarget({
        fanNum: 17,
        yawTotal: Math.PI / 4,
        axisRotation: i * yaw,
      }, 1, 0);
    }
    return true;
  }
}