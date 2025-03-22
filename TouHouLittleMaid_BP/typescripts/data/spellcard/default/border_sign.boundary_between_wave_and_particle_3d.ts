
import { Dimension, Entity, system } from "@minecraft/server";
import { Vector } from "../../../src/libs/VectorMC";
import {
  GeneralBulletColor as Color,
  GeneralBulletType as Type,
  GeneralBullet,
} from "../../../src/danmaku/shapes/main";
import { BulletShoot } from "../../../src/danmaku/shoots/BulletShoot";
import { EntityDanmakuActor } from "../../../src/danmaku/actors/EntityDanmakuActor";

function fibonacciSphere(radius: number, samples: number, rotation: number) {
  rotation += 1;
  var offset = 2.0 / samples;
  var increment = Math.PI * (3 - Math.sqrt(5));
  var points = [];
  for (var i = 0; i < samples; i++) {
    var y = ((i * offset) - 1) + (offset / 2);
    var r = Math.sqrt(1 - y * y) * radius;
    var phi = ((i + rotation) % samples) * increment;
    var x = Math.cos(phi) * r;
    var z = Math.sin(phi) * r;
    points.push(new Vector(x, y * radius, z));
  }
  return points;
}

function shoot($d: number, shooter: BulletShoot) {
  return function () {
    shoot_basic($d, shooter);
  }
}

function shoot_basic($d: number, shooter: BulletShoot) {
  fibonacciSphere(0.2, 50, $d / 100).forEach(function (v) {
    shooter.shootByVelocity(v, 0);
  });
}

export const SpellCard = {
  id: "thlms:boundary_between_wave_and_particle_3d",
  author: "snownee",
  version: "1.0.0",
  cooldown: 150,
  /**
   * 执行的符卡逻辑，函数签名固定，会直接调用
   * @param {Dimension} world 当前所处的世界
   * @param {Entity} shooter 释放符卡的实体
   */
  spellCard: function (world: Dimension, shooter: Entity) {
    var d = 0.0;
    let bulletShoot = new BulletShoot({
      thrower: new EntityDanmakuActor(shooter)
        .setOffset(new Vector(0, 1, 0)),
      shape: new GeneralBullet()
        .setDamage(2)
        .setGeneralBulletType(Type.PELLET)
        .setColor(Color.MAGENTA)
    });
    for (var i = 0; i < 30; i++) {
      d += i;
      system.runTimeout(shoot(d, bulletShoot), 4 * i);
    }
  }
}
