/**
 * 夜符「Night Bird」
 */
import { Dimension, Entity, system } from "@minecraft/server";
import { Vector, VectorMC } from "../../../src/libs/VectorMC";
import * as Tool from "../../../src/libs/ScarletToolKit"
import {
  GeneralBullet as Danmaku,
  GeneralBulletColor as Color,
  GeneralBulletType as Type,
  GeneralBullet,
} from "../../../src/danmaku/shapes/main";
import { BulletShoot } from "../../../src/danmaku/shoots/BulletShoot";
import { EntityDanmakuActor } from "../../../src/danmaku/actors/EntityDanmakuActor";


export const SpellCard = {
  // 释放该符卡的物品id，必须以thlms为开头
  id: "thlms:night_sign.night_bird",
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
    for (var i = 0; i < 1; i++) {
      // 第 1，3 次左侧扇形弹幕
      system.runTimeout(() => {
        for (var j = 0; j < 16; j++) {
          for (var k = 0; k < 3; k++) {
            let bulletShoot = new BulletShoot({
              thrower: new EntityDanmakuActor(entity)
                .setOffset(new Vector(0, 0.8, 0)),
              shape: new GeneralBullet()
                .setDamage(2)
                .setGeneralBulletType(Type.ORBS)
                .setColor(Color.PURPLE)
            });

            let direction = VectorMC.rotate_axis(
              new Vector(0, 0, 1),
              new Vector(0, -1, 0), 
              Tool.angle2raduis(entity.getRotation().y + 90.0 - 135.0 / 16.0 * j - 3)
            );
            bulletShoot.shootByDirection(direction, 0.04 + 0.04 * Math.pow(1.09, 15 - j + k * 5), 0)
          }
        }
      }, i * 60);

      // 第 1，3 次右侧扇形弹幕
      system.runTimeout(() => {
        for (var j = 0; j < 16; j++) {
          for (var k = 0; k < 3; k++) {
            let bulletShoot = new BulletShoot({
              thrower: new EntityDanmakuActor(entity)
                .setOffset(new Vector(0, 0.8, 0)),
              shape: new GeneralBullet()
                .setDamage(2)
                .setGeneralBulletType(Type.ORBS)
                .setColor(Color.CYAN)
            });

            let direction = VectorMC.rotate_axis(
              new Vector(0, 0, 1), 
              new Vector(0, -1, 0), 
              Tool.angle2raduis(entity.getRotation().y - 90.0 + 135.0 / 16.0 * j)
            );
            bulletShoot.shootByDirection(direction, 0.04 + 0.04 * Math.pow(1.09, 15 - j + k * 5), 0);
          }
        }
      }, i * 60 + 15);

      // 第 2，4 次左侧扇形弹幕
      system.runTimeout(() => {
        for (var j = 0; j < 16; j++) {
          for (var k = 0; k < 3; k++) {
            let bulletShoot = new BulletShoot({
              thrower: new EntityDanmakuActor(entity)
                .setOffset(new Vector(0, 0.8, 0)),
              shape: new GeneralBullet()
                .setDamage(2)
                .setGeneralBulletType(Type.ORBS)
                .setColor(Color.PURPLE)
            });

            let direction = VectorMC.rotate_axis(
              new Vector(0, 0, 1), 
              new Vector(0, -1, 0), 
              Tool.angle2raduis(entity.getRotation().y + 90.0 - 135.0 / 16.0 * j - 2)
            );
            bulletShoot.shootByDirection(direction, 0.04 + 0.04 * Math.pow(1.09, 15 - j + k * 5), 0);
          }
        }
      }, i * 60 + 30);

      // 第 2，4 次右侧扇形弹幕
      system.runTimeout(() => {
        for (var j = 0; j < 16; j++) {
          for (var k = 0; k < 3; k++) {
            let bulletShoot = new BulletShoot({
              thrower: new EntityDanmakuActor(entity)
                .setOffset(new Vector(0, 0.8, 0)),
              shape: new GeneralBullet()
                .setDamage(2)
                .setGeneralBulletType(Type.ORBS)
                .setColor(Color.CYAN)
            });

            let direction = VectorMC.rotate_axis(
              new Vector(0, 0, 1), 
              new Vector(0, -1, 0), 
              Tool.angle2raduis(entity.getRotation().y - 90.0 + 135.0 / 16.0 * j - 1)
            );
            bulletShoot.shootByDirection(direction, 0.04 + 0.04 * Math.pow(1.09, 15 - j + k * 5), 0);
          }
        }
      }, i * 60 + 45);
    }
  }
}