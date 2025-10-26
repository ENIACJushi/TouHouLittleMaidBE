import { LaserBase } from "./LaserBase";
import { LineShapeShootParams } from "../LineShapeBase";
import { DanmakuInterface } from "../../DanmakuInterface";
import { VO } from "../../../libs/VectorMC";
import { system, world } from "@minecraft/server";

const ANGLE_PI = 180 / Math.PI;

/**
 * 樱花束
 */
export class SakuraLaser extends LaserBase {
  damageCenter: number = 9; // 中心伤害
  damageArea: number = 3; // 外层伤害
  piercing: number = 3; // 穿透力

  shootShape(params: LineShapeShootParams): undefined {
    const dimension = params.location.dimension;
    const location = params.location.pos;
    const entity = params.throwerId ? world.getEntity(params.throwerId) : undefined;
    // 发射中心弹幕 中心弹幕只是用来展示粒子，实际伤害在这里就会施加
    let danmaku = dimension.spawnEntity("thlmc:danmaku_custom_cherry" as any, location);
    // 设置发射者信息
    if (params.throwerId) {
      DanmakuInterface.setTrower(danmaku, params.throwerId);
    }
    // 穿透力
    DanmakuInterface.setPiercing(danmaku, 5);
    let euler = VO.Advanced.getEulerAngleXZ(params.velocity);
    danmaku.setProperty("thlm:r_x", ANGLE_PI * euler[0]);
    danmaku.setProperty("thlm:r_y", 0);
    danmaku.setProperty("thlm:r_z", ANGLE_PI * euler[1]);

    /// 确定行进距离 ///
    let distance = 128; // 行进距离

    // 处理实体并施加伤害
    let attackList: Map<string, boolean> = new Map();
    DanmakuInterface.setDamage(danmaku, this.damageCenter);
    let victims = dimension.getEntitiesFromRay(location, params.velocity); // 由近到远排列，会包含实体自身，会被方块阻挡
    let piercing = this.piercing ?? 3;
    for (let victim of victims) {
      attackList.set(victim.entity.id, true);
      if (DanmakuInterface.applyDamage(entity, danmaku, victim.entity)) {
        piercing--;
        if (piercing <= 0) {
          distance = victim.distance;
          break;
        }
      }
    }
    if (piercing !== undefined && piercing > 0) {
      // 没有被实体阻挡完，处理方块
      let blockQuery = dimension.getBlockFromRay(location, params.velocity, { includeLiquidBlocks: false, includePassableBlocks: false });
      if (blockQuery !== undefined) {
        let block = blockQuery.block;
        distance = VO.length({
          x: block.x - location.x,
          y: block.y - location.y,
          z: block.z - location.z
        });
      }
    }

    /// 范围伤害 ///
    system.runTimeout(() => {
      let areaAttackList = [];
      DanmakuInterface.setDamage(danmaku, this.damageArea);
      let offset = VO.normalized(VO.Advanced.getAnyVerticalVector(params.velocity));
      const radius = 0.7;
      offset.x *= radius;
      offset.y *= radius;
      offset.z *= radius;

      const count = 6;// 分割次数
      const rotateOnce = 2 * Math.PI / (count);
      for (let i = 0; i < count; i++) {
        let areaVictims = dimension.getEntitiesFromRay(VO.add(location, offset),
          params.velocity, { "maxDistance": distance });
        offset = VO.Secondary.rotate_axis(offset, params.velocity, rotateOnce);
        // dimension.spawnEntity("thlmd:danmaku_basic_ball", VO.add(location, offset));
        for (let victim of areaVictims) {
          if (!attackList.get(victim.entity.id)) {
            attackList.set(victim.entity.id, true);
            areaAttackList.push(victim.entity);
          }
        }
      }
      for (let victim of areaAttackList) {
        DanmakuInterface.applyDamage(entity, danmaku, victim)
      }
    }, 1);

    /// 展示粒子 ///
    danmaku.setProperty("thlm:distance", distance / 2);
    danmaku.setProperty("thlm:enable", true);
    // if(danmaku !== undefined)
    //     danmaku.triggerEvent("despawn");
    return undefined;
  }

  /**
   * 设置中心区域的伤害
   */
  setDamageCenter(damageCenter: number) {
    this.damageCenter = damageCenter;
    return this;
  }

  /**
   * 设置外层区域的伤害
   */
  setDamageArea(damageArea: number) {
    this.damageArea = damageArea;
    return this;
  }

  /**
   * 设置穿透力
   */
  setPiercing(piercing: number) {
    this.piercing = piercing;
    return this;
  }
}