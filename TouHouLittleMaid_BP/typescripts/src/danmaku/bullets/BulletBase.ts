/**
 * 因为基岩版的实体操作及弹幕的底层实现和java版不同
 * 这里的一些方法只是为了保持接口一致而提供的，只是帮助定义和发射弹幕的工具类而不是弹幕本身
 * (Override方法是用于定义实体的，全部不提供)
 */
import { Dimension, Entity, system, Vector3 } from "@minecraft/server";
import { Vector, VectorMC } from "../../libs/VectorMC";
import { getRandom } from "../../libs/ScarletToolKit";

export abstract class BulletBase {
  protected world: Dimension;
  protected thrower?: Entity;
  // 位置确定
  protected enableThrowerLocation: boolean = false; // 是否指定发射位置
  protected Throwerlocation?: Vector; // 指定的发射位置
  protected thrower_offset: Vector = new Vector(0, 0, 0); // 使用实体作为发射位置时的偏移

  protected damage: number = 6; // 伤害
  protected lifeTime: number = 0; // 已存在的刻数，用来定时销毁

  protected ownerID?: string; // 主人 ID (女仆专用)

  /**
   * 创建一个弹幕发射器
   * @param world 名为world，实为维度
   * @param thrower 发射者，不设置时不指定
   */
  constructor(world: Dimension, thrower?: Entity) {
    this.world = world;
    this.thrower = thrower;
  }

  //// 发射函数 ////
  /**
   * 指定方向和动量大小，发射一个弹幕
   * 若要一个静止的弹幕，则把velocity设为0。xyz任何时候都不能同时为0
   * @param {Vector} direction
   * @param {Float} velocity 
   * @param {Float} inaccuracy In Radius(0~PI)
   */
  public shoot (direction: Vector, velocity: number, inaccuracy: number = 0): Entity | undefined {
    // 获取发射位置
    let spawnLocation = this.getShootLocation();
    if (!spawnLocation) {
      return undefined;
    }

    // 生成弹幕实体
    let danmaku = this.world.spawnEntity(this.getBulletEntityName(), spawnLocation);
    this.applyThrower(danmaku); // 应用发射者
    this.applyThrowerOwner(danmaku); // 应用发射者主人（女仆专属）
    this.applyDamage(danmaku); // 应用伤害
    this.applyLifeTime(danmaku); // 应用留存时间

    // 应用动量
    let bedrock_velocity: Vector;
    if (velocity === 0) {
      bedrock_velocity = new Vector(0, 0, 0);
    }
    else {
      bedrock_velocity = VectorMC.getVector_speed_direction(velocity, new Vector(direction.x, direction.y, direction.z));
      this.applyInaccuracy(bedrock_velocity, inaccuracy);
    }
    danmaku.applyImpulse(bedrock_velocity);
    return danmaku;
  }

  /**
   * 以基岩版原生方式，指定三维动量发射弹幕
   * @param velocity 动量
   * @param inaccuracy 西格玛
   * @returns 成功时返回弹幕实体
   */
  public shoot_bedrock (velocity: Vector, inaccuracy: number): Entity | undefined {
    // 获取发射位置
    let spawnLocation = this.getShootLocation();
    if (!spawnLocation) {
      return undefined;
    }

    // 生成弹幕实体
    let danmaku = this.world.spawnEntity(this.getBulletEntityName(), spawnLocation);
    this.applyThrower(danmaku); // 应用发射者
    this.applyThrowerOwner(danmaku); // 应用发射者主人（女仆专属）
    this.applyDamage(danmaku); // 应用伤害
    this.applyLifeTime(danmaku); // 应用留存时间

    // 应用动量
    let v = this.applyInaccuracy(velocity, inaccuracy);
    danmaku.applyImpulse(v);
    return danmaku;
  }

  //////// 工厂函数 ////////
  /**
   * 创建子弹实体
   */
  protected abstract getBulletEntityName (): string;
  /**
   * 获取发射位置
   */
  protected getShootLocation (): Vector | undefined {
    // 方式1 指定发射位置
    if (this.enableThrowerLocation) {
      return this.Throwerlocation;
    }

    // 方式2 指定发射实体
    if (!this.thrower) {
      return undefined;
    }
    try {
      return new Vector(
        this.thrower.location.x + this.thrower_offset.x,
        this.thrower.location.y + this.thrower_offset.y,
        this.thrower.location.z + this.thrower_offset.z
      );
    }
    catch {
      return undefined;
    }
  }
  /**
   * 为 动量 应用不准确度
   */
  protected applyInaccuracy (input: Vector, inaccuracy: number): Vector {
    if (inaccuracy === 0) {
      return input;
    }

    // 计算旋转轴，取与发射向量相垂直的任意向量
    let rotate_axis: Vector;
    if (input.x == 0 && input.y == 0) {
      if (input.z == 0) {
        return new Vector(0, 0, 0); // 向量为 0，直接返回 0
      }
      // 由函数说明，z不为0，取与z轴垂直的x轴
      rotate_axis = new Vector(1, 0, 0);
    }
    else {
      if (input.y == 0) {
        // 向量在xz平面上，取y轴
        rotate_axis = new Vector(0, 1, 0);
      }
      else {
        // 与xz平面有一定夹角，取xy平面上与向量垂直的一个向量
        rotate_axis = new Vector(1, -input.x / input.y, 0);
      }
    }
    // 绕方向向量旋转旋转轴 0~2PI
    rotate_axis = VectorMC.rotate_axis(rotate_axis, input, getRandom(0, 2 * Math.PI));
    // 绕旋转轴旋转方向向量 0~inaccuracy
    return VectorMC.rotate_axis(input, rotate_axis, getRandom(0, inaccuracy));
  }
  /**
   * 为 弹幕实体 应用发射者
   * @param bulletEntity 弹幕实体
   */
  protected applyThrower (bulletEntity: Entity) {
    if (this.thrower !== undefined) {
      bulletEntity.setDynamicProperty("source", this.thrower.id);
    }
  }
  /**
   * 为 弹幕实体 应用发射者主人（女仆专属）
   * @param bulletEntity 弹幕实体
   */
  protected applyThrowerOwner (bulletEntity: Entity) {
    if (this.ownerID !== undefined) {
      bulletEntity.setDynamicProperty("owner", this.ownerID);
    }
  }
  /**
   * 为 弹幕实体 应用伤害
   */
  protected applyDamage (bulletEntity: Entity) {
    bulletEntity.setDynamicProperty("damage", this.damage);
  }
  /**
   * 为 弹幕实体 应用留存时间
   */
  protected applyLifeTime (bulletEntity: Entity) {
    if (this.lifeTime > 0) {
      system.runTimeout(() => {
        try {
          bulletEntity.triggerEvent("despawn");
        } catch { }
      }, this.lifeTime);
    }
  }

  //////// 工具函数 ////////
  /**
   * @param {Entity} danmaku
   */
  static getDamage(danmaku: Entity) {
    return danmaku.getDynamicProperty("damage");
  }

  //////// 设置函数 ////////
  /**
   * 设置伤害数值
   */
  public setDamage(damage: number): BulletBase {
    this.damage = damage;
    return this;
  }

  /**
   * 设置重力大小，暂未实现
   */
  public setGravityVelocity(gravity: number): BulletBase {
    return this;
  }

  /**
  * 指定发射位置
  */
  public setThrower(thrower: Entity): BulletBase {
    this.thrower = thrower;
    this.enableThrowerLocation = false;
    return this;
  }

  /**
   * 指定发射位置
   */
  public setThrowerLocation(location: Vector): BulletBase {
    this.Throwerlocation = location;
    this.enableThrowerLocation = true;
    return this;
  }

  /**
   * 设置发射位置的偏移，未使用 setShootLocation() 时生效
   */
  public setThrowerOffset(offset: Vector): BulletBase {
    this.thrower_offset = offset;
    return this;
  }

  /**
   * 设置弹幕的留存时间
   */
  public setLifeTime(tick: number): BulletBase {
    this.lifeTime = tick;
    return this;
  }

  /**
   * 设置主人id(女仆专用)
   */
  public setOwnerID(id: string): BulletBase {
    this.ownerID = id;
    return this;
  }

  //////// Unused ////////
  /**
   * 用于判定两个可驯服实体的主人是否相同
   * 基岩版的component目前无法获取到主人，无法实现
   * @param {Entity} tameableA
   * @param {Entity} tameableA
   * @returns {boolean}
   */
  static hasSameOwner(tameableA: Entity, tameableB: any): boolean {
    return false;
  }
}