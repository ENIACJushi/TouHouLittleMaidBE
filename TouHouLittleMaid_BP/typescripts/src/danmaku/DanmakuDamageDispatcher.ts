import {Entity, EntityApplyDamageOptions, EntityDamageCause, system, world} from "@minecraft/server";

/**
 * 弹幕伤害调度器
 *  主要用于处理无敌期间的伤害，让它们在目标退出无敌状态时再释放给目标
 *  目前仅支持弹幕伤害，伤害类型固定为魔法
 */
export class DanmakuDamageDispatcher {
  private readonly INVINCIBLE_TIME = 10; // 受击后的无敌时间
  /**
   * 实体id - {累计伤害, 最后伤害者}
   */
  private damageMap = new Map<string, damageInfo>();
  /**
   * 实体id - [10s内对实体造成伤害（或累积伤害）的弹幕实体id]
   */
  private danmakuHitMap = new Map<string, Set<string|undefined>>();
  // 当前处于无敌状态的实体列表
  private invincibleMap = new Set<string>();

  /**
   * 伤害判定，输入实体和本次的伤害，返回应当施加的伤害
   * @param target 受击实体id
   * @param damage 伤害量
   * @param danmaku 造成伤害的弹幕id
   * @param source 施加伤害的实体id
   * @return 返回 undefined 代表无法造成伤害，区别于返回 0 代表累积本次伤害，造成 0 伤害
   */
  public damageJudge(target: string, damage: number, danmaku: string, source?: string): undefined | number {
    // 判断弹幕是否能对该实体造成伤害
    if (!this.canDanmakuDamage(target, danmaku)) {
      return undefined;
    }
    // 无敌状态，累积伤害后返回
    if (this.isInvincible(target)) {
      let currDamage = this.damageMap.get(target)?.damage ?? 0;
      this.damageMap.set(target, {
        damage: currDamage + damage,
        lastSource: source,
      });
      return 0;
    }
    // 不处于无敌状态，则加上累积伤害后返回
    let currDamage = this.damageMap.get(target)?.damage ?? 0;
    this.damageMap.delete(target);
    return currDamage + damage;
  }

  /**
   * 实体受击时，进行记录
   */
  public recordHit(entityId: string) {
    // 若已有正在进行的无敌倒计时，则以旧的为准
    if (this.invincibleMap.has(entityId)) {
      return;
    }
    // 开始无敌倒计时
    this.invincibleMap.add(entityId);
    system.runTimeout(() => {
      this.invincibleMap.delete(entityId);
      // 无敌时间结束后，检查是否有累积伤害，若有则自动施加
      let damageInfo = this.damageMap.get(entityId);
      if (!damageInfo) {
        return;
      }
      let entity = world.getEntity(entityId);
      if (entity) {
        let damageOption: EntityApplyDamageOptions = {
          cause: EntityDamageCause.magic, // 魔法伤害
        }
        if (damageInfo.lastSource) {
          let damagingEntity = world.getEntity(damageInfo.lastSource);
          if (damagingEntity) {
            damageOption.damagingEntity = damagingEntity;
          }
        }
        entity.applyDamage(damageInfo.damage, damageOption);
      }
      this.damageMap.delete(entityId);
    }, this.INVINCIBLE_TIME);
  }

  /**
   * 记录弹幕伤害实体，一个弹幕实体需要等待 INVINCIBLE_TIME 才能对同一个实体再次造成伤害
   */
  public recordDanmakuHit(entityId: string, danmakuId?: string) {
    // 获取弹幕受击表
    let danmakuIds = this.danmakuHitMap.get(entityId) ?? new Set<string|undefined>();
    // 已经记录了，以先前的为准
    if (danmakuIds.has(danmakuId)) {
      return; // 已经有了，以先前的为准
    }
    // 记录弹幕 id
    danmakuIds.add(danmakuId);
    this.danmakuHitMap.set(entityId, danmakuIds);
    // 无敌时间过后移除该 id
    system.runTimeout(() => {
      let ids = this.danmakuHitMap.get(entityId);
      if (ids) {
        ids.delete(danmakuId);
        if (ids.size === 0) {
          this.danmakuHitMap.delete(entityId);
        }
      }
    }, this.INVINCIBLE_TIME);
  }

  /**
   * 判断弹幕是否可以对实体造成伤害（即是否不在伤害冷却时间内）
   */
  private canDanmakuDamage(entityId: string, danmakuId: string) {
    return !this.danmakuHitMap.get(entityId)?.has(danmakuId);
  }

  /**
   * 判断实体当前是否处于受击无敌状态
   */
  private isInvincible(entityId: string) {
    return this.danmakuHitMap.get(entityId) !== undefined;
  }

  //// 测试用 ////
  private isTestingInvincibleTime: boolean = false;
  private isVerifyingInvincibleTime: boolean = false;
  /**
   * 测试实体受击后的无敌时间
   */
  public testInvincibleTime(entity: Entity) {
    // 同时只能有一个测试在执行
    if (this.isTestingInvincibleTime) {
      return;
    }
    this.isTestingInvincibleTime = true;
    // 开始测试
    let i = 0;
    let lastVal = entity.getComponent('health')?.currentValue;
    let id = system.runInterval(() => {
      try {
        let beforeHealth = entity.getComponent('health')?.currentValue;
        entity.applyDamage(1);
        let afterHealth = entity.getComponent('health')?.currentValue;
        if (afterHealth !== beforeHealth && i !== 0) {
          // 伤害施加成功
          this.isTestingInvincibleTime = false;
          system.clearRun(id);
        }
        i++;
      } catch (e) {
        this.isTestingInvincibleTime = false;
        system.clearRun(id);
      }
    }, 1);
  }

  /**
   * 验证实体受击后的无敌时间
   */
  public verifyInvincibleTime(entity: Entity, source?: Entity) {
    // 同时只能有一个验证在执行
    if (this.isVerifyingInvincibleTime) {
      return;
    }
    this.isVerifyingInvincibleTime = true;
    let id = system.runInterval(() => {
      try {
        entity.applyDamage(1, {
          cause: EntityDamageCause.magic,
          damagingEntity: source,
        });
      } catch (e) {
        this.isVerifyingInvincibleTime = false;
        system.clearRun(id);
      }
    }, this.INVINCIBLE_TIME);
  }
}

/**
 * 累积伤害信息
 */
interface damageInfo {
  damage: number, // 累积总量
  lastSource?: string; // 最后施加伤害的实体 id
}
