import {Entity, EntityApplyDamageOptions, EntityDamageCause, system, world} from "@minecraft/server";
import { EntityMaid } from "../maid/EntityMaid";
import { config } from "../controller/Config";

/**
 * 对弹幕实体的通用操作接口
 *  可用于默认弹幕和自定义弹幕
 */
export class DanmakuInterface {
  static readonly PROPERTY_KEY_DAMAGE = 'damage';
  static readonly PROPERTY_KEY_PIERCING = 'piercing';
  static readonly PROPERTY_KEY_OWNER = 'owner';
  static readonly PROPERTY_KEY_SOURCE = 'source';

  /**
   * 施加伤害，成功则返回 true
   * @param _source 发射者(可为空)
   * @param danmaku 弹幕
   * @param target 受击者
   */
  static applyDamage(_source: Entity|undefined, danmaku: Entity, target: Entity): boolean {
    try {
      // Get source entity by event or property
      // const damageOptions = {"damagingProjectile": projectile}; // 弹射物伤害
      let damageOptions: EntityApplyDamageOptions = {
        "cause": EntityDamageCause.magic, // 魔法伤害
      };
      //// 设置伤害施加者 ////
      let source = _source;
      if (source === undefined) {
        // 没有原版框架下的攻击实体，则通过动态属性寻找
        let id = danmaku.getDynamicProperty("source") as undefined | string;

        if (id !== undefined && id !== "0") {
          if (target.id == id) {
            return false;
          }
          source = world.getEntity(id as string);
        }
      }
      if (source !== undefined) {
        damageOptions.damagingEntity = source;
      }

      //// 免伤判断 ////
      // 不伤害自己
      if (target.id === source?.id) {
        return false;
      }
      // 玩家受击
      if (target.typeId === "minecraft:player") {
        // 女仆不伤害玩家
        let ownerID = danmaku.getDynamicProperty("owner");
        if (ownerID !== undefined) {// && ownerID===target.id
          return false;
        }
      }
      // 女仆受击
      else if (target.typeId === "thlmm:maid") {
        let targetOwnerID = EntityMaid.Owner.getID(target); // 目标的主人
        if (targetOwnerID !== undefined) {
          /// 主人不伤害自己的女仆
          // 脚本发射
          if (targetOwnerID === danmaku.getDynamicProperty("source")) {
            return false;
          }
          // 御币发射
          if (source?.id !== undefined && targetOwnerID === source.id) {
            return false;
          }
        }
        /// 女仆不伤害女仆
        let sourceOwnerID = danmaku.getDynamicProperty("owner");
        if (sourceOwnerID !== undefined) {
          return false;
        }
      }
      // 不伤害自己的坐骑
      let rideable = target.getComponent("minecraft:rideable");
      if (rideable !== undefined) {
        for (let entity of rideable.getRiders()) {
          if (entity.id === danmaku.getDynamicProperty("source")) {
            return false;
          }
        }
      }
      // 免伤失败，施加伤害
      let damage: number = danmaku.getDynamicProperty("damage") as number;
      if (damage === undefined) {
        damage = config.danmaku_damage.value;
      }
      if (damage !== 0) {
        // 伤害倍率
        switch (source?.typeId) {
          case "minecraft:player": damage = damage * (config.player_damage.value / 100); break;
          case "thlmm:maid": damage = damage * (config.maid_damage.value / 100); break;
          case "touhou_little_maid:fairy": damage = damage * (config.fairy_damage.value / 100); break;
          default: break;
        }
        if (target.applyDamage(damage, damageOptions)) {
          return true;
        }
      }
    }
    catch { }
    return false;
  }

  //// 获取子弹实体的属性 ////
  /**
   * 获取子弹伤害
   */
  static getDamage(bulletEntity: Entity): number | undefined {
    return bulletEntity.getDynamicProperty(DanmakuInterface.PROPERTY_KEY_DAMAGE) as number;
  }

  /**
   * 获取子弹穿透力
   */
  static getPiercing(bulletEntity: Entity): number | undefined {
    return bulletEntity.getDynamicProperty(DanmakuInterface.PROPERTY_KEY_PIERCING) as number;
  }

  //// 为子弹实体应用属性 ////

  /**
   * 为弹幕实体设置伤害
   */
  static setDamage(danmaku: Entity, damage: number) {
    danmaku.setDynamicProperty(DanmakuInterface.PROPERTY_KEY_DAMAGE, damage);
  }

  /**
   * 为弹幕实体设置留存时间
   */
  static setLifeTime (bulletEntity: Entity, lifeTime: number) {
    if (lifeTime > 0) {
      system.runTimeout(() => {
        try {
          bulletEntity.triggerEvent("despawn");
        } catch { }
      }, lifeTime);
    }
  }

  /**
   * 为弹幕实体设置穿透力
   */
  static setPiercing(danmaku: Entity, count: number) {
    danmaku.setDynamicProperty(DanmakuInterface.PROPERTY_KEY_PIERCING, count);
  }

  /**
   * 为弹幕实体设置投掷者
   */
  static setTrower(danmaku: Entity, id: string) {
    danmaku.setDynamicProperty(DanmakuInterface.PROPERTY_KEY_SOURCE, id);
  }

  /**
   * 为弹幕实体设置主人id（女仆专用）
   */
  static setOwner(danmaku: Entity, ownerID: string) {
    danmaku.setDynamicProperty(DanmakuInterface.PROPERTY_KEY_OWNER, ownerID)
  }

  ///// 编组 /////
  /**
   * 弹幕编组
   * {"mainId":["forkId"...]}
   */
  static group: Map<string, Array<string>> = new Map();

  /**
   * 为一个弹幕设置子弹幕
   * 当主弹幕因击中目标而销毁时，子弹幕也会随之销毁
   */
  static addFork(mainId: string, forkId: string) {
    let ori = this.group.get(mainId);
    if (ori === undefined) {
      this.group.set(mainId, [forkId]);
    }
    else {
      ori.push(forkId);
    }
  }

  /**
   * 获取一个弹幕的所有子弹幕实体id
   * @param {string} mainId
   * @returns {string[]|undefined} 
   */
  static getForks(mainId: string): string[] | undefined {
    return this.group.get(mainId);
  }

  /**
   * 清除一个弹幕与其所有子弹幕的绑定 不会清除实体！
   * @param {string} mainId 
   */
  static clearForks(mainId: string) {
    let forks = this.getForks(mainId);
    if (forks === undefined) return false;

    this.group.delete(mainId);
    return true;
  }
}