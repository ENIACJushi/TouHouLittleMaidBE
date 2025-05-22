/**
 * 金符「Metal Fatigue」
 */
import { Dimension, Entity, system } from "@minecraft/server";
import { Vector, VO } from "../../../src/libs/VectorMC";
import * as Tool from "../../../src/libs/ScarletToolKit"
import {
  GeneralBullet as Danmaku,
  GeneralBulletColor as Color,
  GeneralBulletType as Type,
  GeneralBullet,
} from "../../../src/danmaku/shapes/main";
import { BulletShoot } from "../../../src/danmaku/shoots/BulletShoot";
import { EntityDanmakuActor } from "../../../src/danmaku/actors/EntityDanmakuActor";


function getRotationVector(vec3d: Vector, yawIn: number, yOffset: number, entity: Entity): Vector{
  let yaw = (entity.getRotation().y + yawIn) * -0.01745329251;// PI/180
  let pos = entity.location;

  let result = VO.Secondary.rotate_axis(vec3d, new Vector(0, 1, 0), yaw);
  result = VO.add(result, new Vector(pos.x, pos.y + 1 + yOffset, pos.z));
  
  return result;
}

export const SpellCard = {
  // 释放该符卡的物品id，必须以thlms为开头
  id: "thlms:metal_sign.metal_fatigue",
  // 作者，字符串
  author: "tartaric_acid",
  // 版本，字符串
  version: "1.0.0",
  // 冷却时间，整型数
  cooldown: 170,
  /**
   * 执行的符卡逻辑，函数签名固定，会直接调用
   */
  spellCard: function (world: Dimension, entity: Entity) {
    // 第一波角度和后面不一致
    for (var j = 0; j < 8; j++) {
      let bulletShoot = new BulletShoot({
        thrower: new EntityDanmakuActor(entity)
          .setOffset(new Vector(0, 0.8, 0)),
        shape: new GeneralBullet()
          .setDamage(2)
          .setGeneralBulletType(Type.BIG_BALL)
          .setColor(Color.YELLOW)
          .setLifeTime(31)
      });

      let direction = VO.Secondary.rotate_axis(
        new Vector(0, 0, 1), 
        new Vector(0, -1, 0), 
        Tool.angle2raduis(entity.getRotation().y + 15 + 45 * j)
      );
      bulletShoot.shootByDirection(direction, 0.2, 0);
    }

    system.runTimeout(() => {
      for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
          var pos = getRotationVector(new Vector(0, 0, 5.6), 15 + 45 * i, -0.1, entity);
          let bulletShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(entity)
              .setOffset(new Vector(0, 0.8, 0))
              .lockLocation(entity.dimension, pos),
            shape: new GeneralBullet()
              .setDamage(2)
              .setGeneralBulletType(Type.BIG_BALL)
              .setColor(Color.YELLOW)
              .setLifeTime(31)
          });
          let direction = VO.Secondary.rotate_axis(
            new Vector(0, 0, 1),
            new Vector(0, -1, 0), 
            Tool.angle2raduis(entity.getRotation().y + 45 * j)
          );
          bulletShoot.shootByDirection(direction, 0.2, 0);
        }
      }
    }, 30);


    // 后面来上 5 波即可，此时角度是固定的
    for (var k = 0; k < 5; k++) {
      system.runTimeout(() => {
        for (var j = 0; j < 8; j++) {
          let bulletShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(entity)
              .setOffset(new Vector(0, 0.8, 0)),
            shape: new GeneralBullet()
              .setDamage(2)
              .setGeneralBulletType(Type.BIG_BALL)
              .setColor(Color.YELLOW)
              .setLifeTime(31)
          });
          let direction = VO.Secondary.rotate_axis(
            new Vector(0, 0, 1), 
            new Vector(0, -1, 0), 
            Tool.angle2raduis(entity.getRotation().y + 30 + 45 * j)
          );
          bulletShoot.shootByDirection(direction, 0.2, 0);
        }
      }, 20 * (k + 1));

      system.runTimeout(() => {
        for (var i = 0; i < 8; i++) {
          for (var j = 0; j < 8; j++) {
            var pos = getRotationVector(new Vector(0, 0, 5.6), 30 + 45 * i, -0.1, entity);
            let bulletShoot = new BulletShoot({
              thrower: new EntityDanmakuActor(entity)
                .setOffset(new Vector(0, 0.8, 0))
                .lockLocation(entity.dimension, pos),
              shape: new GeneralBullet()
                .setDamage(2)
                .setGeneralBulletType(Type.BIG_BALL)
                .setColor(Color.YELLOW)
                .setLifeTime(31)
            });
            let direction = VO.Secondary.rotate_axis(
              new Vector(0, 0, 1), 
              new Vector(0, -1, 0), 
              Tool.angle2raduis(entity.getRotation().y + 30 + 45 * j)
            );
            bulletShoot.shootByDirection(direction, 0.2, 0);
          }
        }
      }, 30 + 20 * (k + 1));
    }
  }
}