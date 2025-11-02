import { LaserBase } from "./LaserBase";
import { LineShapeShootParams } from "../LineShapeBase";
import { DanmakuInterface } from "../../DanmakuInterface";
import { VO } from "../../../libs/VectorMC";
import { system, world } from "@minecraft/server";
import {dim_string2int} from "../../../libs/ScarletToolKit";

const ANGLE_PI = 180 / Math.PI;

/**
 * 樱花束
 */
export class SakuraLaser extends LaserBase {
  private readonly AREA_FLAME_MULTIPLIER: number = 0.5; // 外层起火时间与中心层时间的比例
  private readonly AREA_PUNCH_MULTIPLIER: number = 0.5; // 外层击退力度与中心层力度的比例
  damageCenter: number = 9; // 中心伤害
  damageArea: number = 3; // 外层伤害
  piercing: number = 3; // 穿透力
  flame: number = 0; // 起火时间（秒），为0时不起火
  punch: number = 0; // 额外冲击力

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
        // 应用火焰
        if (this.flame) {
          try {
            victim.entity.setOnFire(this.flame);
          } catch {}
        }
        // 应用击退力度
        if (this.punch) {
          // 有些实体不可被施加此函数，会报错（如末影水晶），所以用 try catch 圈起来
          try {
            victim.entity.applyKnockback(
              {x: params.velocity.x * this.punch, z: params.velocity.z * this.punch},
              0.5,
            );
          } catch {}
        }
        // 消耗穿透力
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

    /// 等待一刻后，执行范围伤害 ///
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
        if (DanmakuInterface.applyDamage(entity, danmaku, victim)) {
          // 应用火焰
          if (this.flame) {
            try {
              victim.setOnFire(this.flame * this.AREA_FLAME_MULTIPLIER);
            } catch {}
          }
          // 应用击退力度
          if (this.punch) {
            try {
              victim.applyKnockback(
                {
                  x: params.velocity.x * this.punch * this.AREA_PUNCH_MULTIPLIER,
                  z: params.velocity.z * this.punch * this.AREA_PUNCH_MULTIPLIER
                },
                0.5,
              );
            } catch {}
          }
        }
      }
    }, 1);

    /// 展示粒子 ///
    danmaku.setProperty('thlm:particle_type',
      this.flame > 0 ? (dim_string2int(params.location.dimension.id) ?? 1) + 1 : 0);
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

  /**
   * 设置起火时间（秒），为0时不起火
   */
  setFlame(flame: number) {
    this.flame = flame;
    return this;
  }

  /**
   * 设置额外冲击力（动量大小）
   */
  setExtraPunch(punch: number) {
    this.punch = punch;
    return this;
  }
}