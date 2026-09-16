import {
  DataDrivenEntityTriggerAfterEvent,
  EntityDieAfterEvent,
  system,
  world,
} from "@minecraft/server";
import { EntityMaid } from "../EntityMaid";
import { Pose } from "../facets/Pose";
import { Vector, VO } from "../../libs/VectorMC";
import { SakuraLaser } from "../../danmaku/shapes/laser/SakuraLaser";
import * as Tool from "../../libs/ScarletToolKit";
import { LineShoot } from "../../danmaku/shoots/LineShoot";
import { EntityDanmakuActor } from "../../danmaku/actors/EntityDanmakuActor";
import { GeneralBullet } from "../../danmaku/shapes/bullets/general_bullet/GeneralBullet";
import { FanShapedPattern } from "../../danmaku/patterns/line/FanShapedPattern";
import { GeneralBulletColor } from "../../danmaku/shapes/bullets/general_bullet/GeneralBulletColor";
import { GeneralBulletType } from "../../danmaku/shapes/bullets/general_bullet/GeneralBulletType";
import { MaidTarget } from "../work/MaidTarget";
import { maidInteractEvents } from "./MaidInteractEvents";

const HOME_RADIUS = 32;
/**
 * 日程事件（原 MaidManager.Shedule）
 */
export class MaidScheduleEvents {
  /**
   * 定时事件（一步约 3 秒）
   */
  onTimer(event: DataDrivenEntityTriggerAfterEvent) {
    const STEP_MAX = 1000;
    let maid = event.entity;
    if (maid === undefined) return;

    ///// 步数计算 一步3秒 /////
    let healStep = maid.getDynamicProperty("step") as number | undefined;
    // 计时量未初始化 立即初始化
    if (healStep === undefined) {
      maid.setDynamicProperty("step", 0);
      return;
    }
    if (healStep >= STEP_MAX) {
      maid.setDynamicProperty("step", 0);
    } else {
      maid.setDynamicProperty("step", healStep + 1);
    }

    ///// 取模决定执行任务 /////
    //// 每次
    // 抱起扫描（直接引用 interact 模块，避免经 MaidEvents 环依赖）
    if (Pose.isHug(maid)) maidInteractEvents.maidScan(maid);

    let work = EntityMaid.Work.get(maid);
    // 农业扫描
    switch (work) {
      case EntityMaid.Work.farm:
      case EntityMaid.Work.melon:
      case EntityMaid.Work.cocoa:
        MaidTarget.stepEvent(maid, work);
        break;
      default:
        break;
    }
    if (world.gameRules.mobGriefing === false && EntityMaid.Pick.get(maid) === true) {
      // 无生物破坏的拾物模式
      system.runTimeout(() => {
        EntityMaid.Pick.magnet(maid, 5);
      }, 2); // 延迟执行，更及时地捡起农作物
    }
    try {
      // 使用质数 2 3 5 7 11 13 17 19
      // 3步 - 9秒
      if (healStep % 3 === 0) {
        // 回血
        try {
          let healthComponent = EntityMaid.Health.getComponent(maid);
          if (healthComponent.currentValue < healthComponent.defaultValue) {
            // 回血
            let healAmount = EntityMaid.Level.getProperty(maid, "heal") as [number, number];
            healthComponent.setCurrentValue(
              Math.min(
                healthComponent.defaultValue,
                healthComponent.currentValue + Tool.getRandomInteger(healAmount[0], healAmount[1])
              )
            );
          }
        } catch {}
        // 扫描 坐下时不执行
        try {
          if (!Pose.isSitting(maid)) {
            MaidTarget.search(maid, 15);
          }
        } catch {}
      }
      // 11步 - 33秒
      else if (healStep % 11 === 0) {
        // 播放idle语音
        if (!EntityMaid.Sound.getMute(maid)) {
          system.runTimeout(() => {
            try {
              EntityMaid.Util.playSound(maid, "mob.thlmm.maid.idle");
            } catch {}
          }, Tool.getRandomInteger(0, 100));
        }
      }
    } catch {}
  }

  /**
   * 女仆击杀
   * 调用此事件时 event.damageSource.damagingEntity 必定存在且为女仆
   */
  onKill(event: EntityDieAfterEvent) {
    let maid = event.damageSource.damagingEntity!;
    let oldAmount = EntityMaid.Kill.get(maid);
    EntityMaid.Kill.set(maid, oldAmount + 1);
  }

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

      let shoot = new LineShoot({
        shape: new SakuraLaser()
          .setDamageArea(basicDamage / 3)
          .setDamageCenter(basicDamage)
          .setPiercing(1),
        thrower: new EntityDanmakuActor(maid)
          .setHead(true)
          .setOffset(new Vector(0, 1, 0)),
      });
      let location = maid.getHeadLocation();
      shoot.shootByVelocity(new Vector(
        target.location.x - location.x,
        target.location.y - location.y,
        target.location.z - location.z
      ));
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
          let bulletShoot = new LineShoot({
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
          let bulletShootSmall = new LineShoot({
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

          let bulletShootBig = new LineShoot({
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
      let bulletShootBig = new LineShoot({
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
          bulletShootBig.shootByTarget(0.5 * (distanceFactor + 1), 0.5);
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
    // 坐下时不回家（原 JSON bool_property 过滤器已失效，改由脚本判断）
    if (Pose.isSitting(maid)) {
      return;
    }
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