import { Entity } from "@minecraft/server";
import { Vector, VO } from "../../libs/VectorMC";
import { system } from "@minecraft/server";
import { DanmakuInterface } from "../DanmakuInterface";
const ANGLE_PI = 180 / Math.PI
/**
 * @param piercing 穿透力
 */
export function shoot(entity: Entity, location: Vector, direction: Vector, damageCenter = 9, damageArea = 3, piercing: number = 3) {
  const dimension = entity.dimension;
  // 发射中心弹幕 中心弹幕只是用来展示粒子，实际伤害在这里就会施加
  let danmaku = dimension.spawnEntity("thlmc:danmaku_custom_cherry" as any, location);

  DanmakuInterface.setTrower(danmaku, entity.id);
  DanmakuInterface.setPiercing(danmaku, 5);
  let euler = VO.Advanced.getEulerAngleXZ(direction);
  danmaku.setProperty("thlm:r_x", ANGLE_PI * euler[0]);
  danmaku.setProperty("thlm:r_y", 0);
  danmaku.setProperty("thlm:r_z", ANGLE_PI * euler[1]);

  /// 确定行进距离 ///
  var distance = 128; // 行进距离

  // 处理实体并施加伤害
  var attacklist: Map<string, boolean> = new Map();
  DanmakuInterface.setDamage(danmaku, damageCenter);
  var victims = dimension.getEntitiesFromRay(location, direction); // 由近到远排列，会包含实体自身，会被方块阻挡
  for (let victim of victims) {
    attacklist.set(victim.entity.id, true);
    if (DanmakuInterface.applyDamage(entity, danmaku, victim.entity)) {
      piercing--;
      if (piercing <= 0) {
        distance = victim.distance;
        break;
      }
    }
  }
  if (piercing > 0) {
    // 没有被实体阻挡完，处理方块
    var blockQuery = dimension.getBlockFromRay(location, direction, { includeLiquidBlocks: false, includePassableBlocks: false });
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
    var areaAttackList = [];
    DanmakuInterface.setDamage(danmaku, damageArea);
    let offset = VO.normalized(VO.Advanced.getAnyVerticalVector(direction));
    const radius = 0.7;
    offset.x *= radius;
    offset.y *= radius;
    offset.z *= radius;

    const count = 6;// 分割次数
    const rotateOnce = 2 * Math.PI / (count);
    for (let i = 0; i < count; i++) {
      var areaVictims = dimension.getEntitiesFromRay(VO.add(location, offset),
        direction, { "maxDistance": distance });
      offset = VO.Secondary.rotate_axis(offset, direction, rotateOnce);
      // dimension.spawnEntity("thlmd:danmaku_basic_ball", VO.add(location, offset));
      for (let victim of areaVictims) {
        if (!attacklist.get(victim.entity.id)) {
          attacklist.set(victim.entity.id, true);
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
}