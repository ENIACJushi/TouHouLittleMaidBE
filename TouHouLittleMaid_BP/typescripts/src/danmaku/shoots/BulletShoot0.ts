/**
 * TODO: 实现重力 gravity
 */
import { Dimension, Entity } from "@minecraft/server";
import {
  GeneralBullet,
  GeneralBulletColor,
  GeneralBulletType,
} from "../shapes/main";
import * as Tool from "../../libs/ScarletToolKit"
import { Vector, VectorMC } from "../../libs/VectorMC";


export class BulletShoot0 {
  static RANDOM = Math.random();
  static MAX_YAW = 2 * Math.PI;
  static MIN_FAN_NUM = 2;

  // Shooter
  world?: Dimension; // NOT NULL
  thrower?: Entity;
  target?: Entity;

  enable_shoot_location = false;
  shoot_location?: Vector;
  enable_target_location = false;
  target_location?: Vector;
  pre_judge = false;
  pre_judge_verticle = false;

  target_offset = new Vector(0, 0, 0);
  thrower_offset = new Vector(0, 0, 0); // 获取不了碰撞箱大小，故手动指定

  // Danmaku basic
  color = GeneralBulletColor.RANDOM;
  type = GeneralBulletType.RANDOM;
  damage = 6;
  gravity = 0.2;
  velocity = 0.6;
  inaccuracy = 0;
  lifeTime = 0;

  // Fan Shaped
  yawTotal = 3;
  fanNum = 3;
  axisRotation = 0; // 中轴绕发射向量的旋转角度（先转）
  directionRotation = 0; // 发射向量绕旋转向量旋转的角度（后转）

  // 女仆专用
  ownerID?: string;

  static create() {
    return new BulletShoot0();
  }
}