import {
  DataDrivenEntityTriggerAfterEvent, system, world,
} from "@minecraft/server";
import {EntityMaid} from "../EntityMaid";
import {Vector, VO} from "../../libs/VectorMC";
import {shoot as cherryShoot} from "../../danmaku/patterns/Cherry";
import * as Tool from "../../libs/ScarletToolKit";
import {BulletShoot} from "../../danmaku/shoots/BulletShoot";
import {EntityDanmakuActor} from "../../danmaku/actors/EntityDanmakuActor";
import {GeneralBullet} from "../../danmaku/shapes/bullets/general_bullet/GeneralBullet";
import {FanShapedPattern} from "../../danmaku/patterns/Fan";
import {GeneralBulletColor} from "../../danmaku/shapes/bullets/general_bullet/GeneralBulletColor";
import {GeneralBulletType} from "../../danmaku/shapes/bullets/general_bullet/GeneralBulletType";

const HOME_RADIUS = 32;

/**
 * 日程事件
 */
export class MaidScheduleEvents {
  /**
   * 进行弹幕攻击
   */
  tryDanmakuAttack(event: DataDrivenEntityTriggerAfterEvent) {
    const AIMED_SHOT_PROBABILITY = 0.8; // java 0.9
    // 女仆不存在时退出
    let maid = event.entity;
    if (!maid) {
      return;
    }
    // 女仆目标不存在时退出
    let target = maid.target
    if (!target) {
      return;
    }

    let basicDamage = EntityMaid.Level.getProperty(maid, "danmaku") as number;

    // 目标为幻翼时，使用樱花束攻击
    if (target.typeId === 'minecraft:phantom') {// 无效：target.getComponent("minecraft:can_fly") !== undefined
      let location = maid.getHeadLocation()
      let direction = new Vector(
        target.location.x - location.x,
        target.location.y - location.y,
        target.location.z - location.z
      );
      cherryShoot(maid, location, direction, basicDamage, basicDamage / 3, 1);
      return;
    }

    // 默认攻击方式
    let distance = VO.length(new Vector(
      maid.location.x - target.location.x,
      maid.location.y - target.location.y,
      maid.location.z - target.location.z,));
    let distanceFactor = distance / 8;
    let yOffset = distance < 5 ? 0.2 : 0.5; // 根据距离偏移目标位置

    // 周围怪物数量判定
    let monsters = maid.dimension.getEntities({
      location: maid.location,
      families: ["monster"],
      maxDistance: 20,
    });
    if (monsters.length > 4) {
      // 大于4使用群攻
      const amount = 3;
      const delta = 0.8; // 伤害系数
      // 随机选择一种群攻弹幕
      let random = Tool.getRandomInteger(0, 1);
      switch (random) {
        case 0: {
          // 扇形弹幕
          let bulletShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(maid)
              .setOffset(new Vector(0, 1, 0)),
            target: new EntityDanmakuActor(target)
              .setOffset(new Vector(0, yOffset, 0)),
            shape: new GeneralBullet()
              .setRandomColor()
              .setRandomType()
              .setDamage((distanceFactor + basicDamage + 0.5) * delta / amount)
              .setLifeTime(30)
          })
            .setOwnerID(EntityMaid.Owner.getID(maid));

          let fanShapedShot = new FanShapedPattern(bulletShoot);
          for (let i = 0; i < amount; i++) {
            system.runTimeout(() => {
              fanShapedShot.shootByTarget({
                fanNum: 12,
                yawTotal: Math.PI / 2
              }, 0.5 * (distanceFactor + 1), 0.02);
            }, i * 20);
          }
        }; break;
        case 1: {
          // 散射星弹
          let bulletShootSmall = new BulletShoot({
            thrower: new EntityDanmakuActor(maid)
              .setOffset(new Vector(0, 1, 0)),
            target: new EntityDanmakuActor(target)
              .setOffset(new Vector(0, yOffset, 0)),
            shape: new GeneralBullet()
              .setColor(GeneralBulletColor.RANDOM)
              .setGeneralBulletType(GeneralBulletType.STAR)
              .setDamage((distanceFactor + basicDamage + 0.5) * delta / 18)
              .setLifeTime(40)
          })
            .setOwnerID(EntityMaid.Owner.getID(maid));

          let bulletShootBig = new BulletShoot({
            thrower: new EntityDanmakuActor(maid)
              .setOffset(new Vector(0, 1, 0)),
            target: new EntityDanmakuActor(target)
              .setOffset(new Vector(0, yOffset, 0)),
            shape: new GeneralBullet()
              .setColor(GeneralBulletColor.RANDOM)
              .setGeneralBulletType(GeneralBulletType.BIG_STAR)
              .setDamage((distanceFactor + basicDamage + 0.5) * delta / 10)
              .setLifeTime(45)
          })
            .setOwnerID(EntityMaid.Owner.getID(maid));

          for (let i = 0; i < 5; i++) {
            system.runTimeout(() => {
              bulletShootBig.shootByTarget(Tool.getRandom(0.3, 1), 12);
            }, i * 8);
            system.runTimeout(() => {
              bulletShootSmall.shootByTarget(Tool.getRandom(0.3, 1), 25.7);
            }, 1 + i * 8);
            system.runTimeout(() => {
              bulletShootSmall.shootByTarget(Tool.getRandom(0.3, 1), 25.7);
            }, 2 + i * 8);
            system.runTimeout(() => {
              bulletShootBig.shootByTarget(Tool.getRandom(0.3, 1), 12);
            }, 3 + i * 8);
            system.runTimeout(() => {
              bulletShootSmall.shootByTarget(Tool.getRandom(0.3, 1), 25.7);
            }, 4 + i * 8);
          }
        }; break;
        default: break;
      }
    } else {
      // 单体点射 连发四次
      const amount = 4;
      let bulletShootBig = new BulletShoot({
        thrower: new EntityDanmakuActor(maid)
          .setOffset(new Vector(0, 1, 0)),
        target: new EntityDanmakuActor(target)
          .setOffset(new Vector(0, yOffset, 0)),
        shape: new GeneralBullet()
          .setRandomColor()
          .setRandomType()
          .setDamage((distanceFactor + basicDamage) / amount)
          .setLifeTime(45)
      })
        .setOwnerID(EntityMaid.Owner.getID(maid))
        .enablePreJudge();

      for (let i = 0; i < amount; i++) {
        system.runTimeout(() => {
          bulletShootBig.shootByTarget(0.5 * (distanceFactor + 1), 3);
        }, i * 12);
      }
    }
  }

  /**
   * 设置等级
   */
  setLevel(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    if (!maid) {
      return;
    }
    let level = parseInt(event.eventId.substring(7));
    EntityMaid.Level.set(maid, level);
  }

  /**
   * 尝试回家
   */
  tryReturnHome(event: DataDrivenEntityTriggerAfterEvent) {
    // 比较维度
    let maid = event.entity;
    // NPC的家半径为 2
    let homeRadius = EntityMaid.Work.get(maid) === -1 ? 2 : HOME_RADIUS;

    let home_location = EntityMaid.Home.getLocation(maid);

    // 没有家，设置为当前位置
    if (home_location === undefined) {
      EntityMaid.Home.setLocation(maid);
      return;
    }
    let in_home = (maid.dimension.id === home_location[3]);
    if (in_home) {
      // 计算位置是否在家范围内
      in_home = Tool.pointInArea_2D(maid.location.x, maid.location.z,
        home_location[0] - homeRadius, home_location[2] - homeRadius,
        home_location[0] + homeRadius, home_location[2] + homeRadius);
    }
    // 维度不同或超出范围，回家
    world.getDimension(home_location[3]);
    if (!in_home) {
      maid.teleport(new Vector(home_location[0], home_location[1], home_location[2]),
        { "dimension": world.getDimension(home_location[3]) });
    }
  }
}