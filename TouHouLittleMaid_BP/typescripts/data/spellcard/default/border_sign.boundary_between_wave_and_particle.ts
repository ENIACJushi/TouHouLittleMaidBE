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

// Java.asJSONCompatible 改为 export const SpellCard = 
export const SpellCard = {
  // 释放该符卡的物品id，必须以thlms为开头
  id: "thlms:border_sign.boundary_between_wave_and_particle",
  author: "tartaric_acid", // 作者，字符串
  version: "1.0.0", // 版本，字符串
  cooldown: 250, // 冷却时间，整型数
  times: 120, // 发射次数 默认为 120

  /**
   * 执行的符卡逻辑，函数签名固定，会直接调用
   * @param world 当前所处的维度
   * @param shooter 释放符卡的实体
   */
  spellCard: function (world: Dimension, shooter: Entity) {
    for (let i = 0; i < this.times; i++) {
      // 传值给延时命令
      let shoot_basic = function ($times: number) {
        for (let j = 0; j < 9; j++) {
          // 原初始化参数：世界 实体, damage, gravity, type, color，除了前两个均要另外设置
          let bulletShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(shooter)
              .setOffset(new Vector(0, 1, 0)),
            shape: new GeneralBullet()
              .setGeneralBulletType(Type.PETAL)
              .setColor(Color.MAGENTA)
              .setDamage(2)
          });

          // 旋转角设置
          let direction = VectorMC.rotate_axis(
            new Vector(0, 0, 1), 
            new Vector(0, -1, 0), 
            Tool.angle2raduis(- 40 * j + 5 * Math.pow($times / 4, 2))
          );
          bulletShoot.shootByDirection(direction, 0.4, 0);
        }
      };
      let shoot = function ($times: number) {
        return function () {
          shoot_basic($times);
        }
      };
      system.runTimeout(shoot(i), 2 * i);
    }
  }
};
