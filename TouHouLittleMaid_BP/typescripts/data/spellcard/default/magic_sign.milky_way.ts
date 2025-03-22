import { Dimension, Entity, system } from "@minecraft/server";
import { Vector, VectorMC } from "../../../src/libs/VectorMC";
import * as Tool from "../../../src/libs/ScarletToolKit";
import {
  GeneralBullet as Danmaku,
  GeneralBulletColor as Color,
  GeneralBulletType as Type,
  GeneralBullet,
} from "../../../src/danmaku/shapes/main";
import { BulletShoot } from "../../../src/danmaku/shoots/BulletShoot";
import { EntityDanmakuActor } from "../../../src/danmaku/actors/EntityDanmakuActor";

/**
 * entity.getRotation()获取 [-180, 180]，对应(-180~180)的角度
 */


export function getRotationVector(vec3d: Vector, yawIn: number, yOffset: number, entity: Entity): Vector {
  let yaw = (entity.getRotation().y + yawIn) * -0.01745329251;// PI/180
  let pos = entity.location;

  let result = VectorMC.rotate_axis(vec3d, new Vector(0, 1, 0), yaw);
  result = VectorMC.add(result, new Vector(pos.x, pos.y + 1 + yOffset, pos.z));

  return result;
}

export const SpellCard = {
  // 释放该符卡的物品id，必须以thlms为开头
  id: "thlms:magic_sign.milky_way",
  /**
   * 执行的符卡逻辑，函数签名固定，会直接调用
   */
  spellCard: function (world: Dimension, entity: Entity) {
    // 中心散发的大星弹
    for (var i = 0; i < 50; i++) {
      var shoot_basic = function ($times: number) {
        for (var j = 0; j < 9; j++) {
          let bulletShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(entity)
              .setOffset(new Vector(0, 1, 0)),
            shape: new GeneralBullet()
              .setDamage(2)
              .setGeneralBulletType(Type.BIG_STAR)
              .setColor(Color.RED)
          });
          
          if ($times % 2 == 1) {
            (bulletShoot.shape as GeneralBullet).setColor(Color.BLUE);
          }
          // 旋转弹幕感觉没必要跟着转 Tool.angle2raduis(entity.getRotation().y - 5 * $times + 40 * j)
          let direction = VectorMC.rotate_axis(
            new Vector(0, 0, 1), new Vector(0, -1, 0), 
            Tool.angle2raduis(- 5 * $times + 40 * j)
          );
          bulletShoot.shootByDirection(direction, 0.7, 0);
        }
      }
      var shoot = function ($times: number) { return function () { shoot_basic($times); } };
      system.runTimeout(shoot(i), 5 * i);
    }

    // 一段时间后的斜向弹幕
    for (i = 0; i < 20; i++) {
      system.runTimeout(() => {
        for (var j = 0; j < 5; j++) {
          var pos = getRotationVector(new Vector(-15, 0, Math.random() * 30 - 10), 0, -0.1, entity);

          let bulletShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(entity)
              .setOffset(new Vector(0, 1, 0))
              .lockLocation(entity.dimension, pos),
            shape: new GeneralBullet()
              .setDamage(2)
              .setGeneralBulletType(Type.STAR)
              .setColor(Color.YELLOW)
          });

          let direction = VectorMC.rotate_axis(
            new Vector(0, 0, 1), 
            new Vector(0, -1, 0), 
            Tool.angle2raduis(entity.getRotation().y - 60)
          );
          bulletShoot.shootByDirection(direction, 0.3, 0);
        }
      }, 10 * i + 50);

      system.runTimeout(() => {
        for (var j = 0; j < 5; j++) {
          var pos = getRotationVector(new Vector(15, 0, Math.random() * 30 - 10), 0, -0.1, entity);
          
          let bulletShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(entity)
              .setOffset(new Vector(0, 1, 0))
              .lockLocation(entity.dimension, pos),
            shape: new GeneralBullet()
              .setDamage(2)
              .setGeneralBulletType(Type.STAR)
              .setColor(Color.GREEN)
          });

          let direction = VectorMC.rotate_axis(
            new Vector(0, 0, 1), 
            new Vector(0, -1, 0), 
            Tool.angle2raduis(entity.getRotation().y + 60)
          );
          bulletShoot.shootByDirection(direction, 0.3, 0);
        }
      }, 10 * i + 50);
    }
  }
}