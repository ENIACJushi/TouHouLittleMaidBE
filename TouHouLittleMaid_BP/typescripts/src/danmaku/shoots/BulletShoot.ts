import { Vector, VO } from "../../../src/libs/VectorMC";
import { BulletBase, GeneralBullet } from "../shapes/main";
import { Entity, EntityProjectileComponent } from "@minecraft/server";
import { getRandom } from "../../../src/libs/ScarletToolKit";
import { DanmakuActor } from "../actors/DanmakuActor";
import { EntityDanmakuActor } from "../actors/EntityDanmakuActor";
import { LocationDanmakuActor } from "../actors/LocationDanmakuActor";

export interface BulletShootData {
  shape: BulletBase;
  thrower: DanmakuActor ;
  ownerId?: string;
  target?: DanmakuActor;
  preJudge?: boolean;
  preJudgeVerticle?: boolean;
}

export class BulletShoot {
  // 发射的弹幕类型
  public shape: BulletBase;
  // 发射者信息
  public thrower: DanmakuActor;
  public ownerId?: string; // 主人 ID (女仆专用)
  // 目标信息 因为有指定方向的发射方式，目标信息不是必要的
  public target?: DanmakuActor;
  // 是否启用预瞄
  public preJudge: boolean = false;
  public preJudgeVerticle: boolean = false;
  
  // constructor (shape: BulletBase, thrower: DanmakuActor) {
  //   this.shape = shape;
  //   this.thrower = thrower;
  // }
  constructor (data: BulletShootData) {
    this.shape = data.shape;
    this.thrower = data.thrower;
    this.ownerId = data.ownerId;
    this.target = data.target;
    this.preJudge = data.preJudge ?? this.preJudge;
    this.preJudgeVerticle = data.preJudgeVerticle ?? this.preJudgeVerticle;
  }

  //////// 基础射击函数 ////////
  /**
   * 以基岩版原生方式，指定三维动量发射弹幕
   * @param velocity 动量
   * @param inaccuracy 西格玛
   * @returns 成功时返回弹幕实体
   */
  public shootByVelocity (velocity: Vector, inaccuracy: number): Entity | undefined {
    // 生成弹幕实体
    let danmaku = this.createBulletEntity();
    if (!danmaku) {
      return undefined;
    }
    // 应用动量
    const projectileComp = danmaku.getComponent("minecraft:projectile") as EntityProjectileComponent;
    if (!projectileComp) {
      danmaku.triggerEvent('despawn');
      return undefined;
    }
    projectileComp.shoot(velocity, {
      uncertainty: inaccuracy
    });
    return danmaku;
  }

  //////// 进阶射击函数 ////////
  /**
   * 指定方向和动量大小，发射一个弹幕
   * 若要一个静止的弹幕，则把velocity设为0。xyz任何时候都不能同时为0
   * @param {Vector} direction
   * @param {Float} velocity 
   * @param {Float} inaccuracy In Radius(0~PI)
   */
  public shootByDirection (direction: Vector, velocity: number, inaccuracy: number = 0): Entity | undefined {
    // 转换并动量
    let bedrockVelocity: Vector;
    if (velocity === 0) {
      bedrockVelocity = new Vector(0, 0, 0);
    }
    else {
      bedrockVelocity = VO.Secondary.getVector_speed_direction(velocity, new Vector(direction.x, direction.y, direction.z));
    }
    return this.shootByVelocity(bedrockVelocity, inaccuracy);
  }
  /**
   * 向目标射击 (aimedShot)
   * @param velocity 速率
   * @param inaccuracy 西格玛
   * @param _target 目标，未指定时使用先前设置的默认目标
   */
  public shootByTarget (velocity: number, inaccuracy: number, _target?: DanmakuActor): Entity | undefined {
    // 确定目标
    let target = _target;
    if (!target) {
      if (!this.target) {
        return undefined;
      }
      target = this.target;
    }

    // 计算向量
    let v = BulletShoot.getVelocity2Target(this.thrower, target, velocity, 
      this.preJudge, this.preJudgeVerticle);
    if (!v) {
      return undefined;
    }
    // 射击
    return this.shootByVelocity(v, inaccuracy);
  }

  //////// 构建函数 ////////
  /**
   * 创建弹幕实体
   * 基于弹种类型的创建，还包含了关于射手的一些信息
   */
  private createBulletEntity(): Entity | undefined {
    let danmaku = this.shape.createBulletEntity(...this.thrower.getLocation());
    this.applyThrower(danmaku);
    this.applyOwnerId(danmaku);
    return danmaku;
  }
  /**
   * 应用发射者，仅在发射者是实体时生效
   */
  private applyThrower(bulletEntity: Entity) {
    if (this.thrower instanceof EntityDanmakuActor) {
      bulletEntity.setDynamicProperty("source", this.thrower.entity.id);
    }
  }
  /**
   * 应用发射者主人，仅在 OwnerID 被设置时生效
   */
  private applyOwnerId(bulletEntity: Entity) {
    if (this.ownerId) {
      bulletEntity.setDynamicProperty("owner", this.ownerId);
    }
  }
  
  //////// 设置函数 ////////
  /**
  * 指定发射位置
  */
  public setThrower(thrower: DanmakuActor): this {
    this.thrower = thrower;
    return this;
  }
  /**
   * 设置主人id(女仆专用)
   */
  public setOwnerID(id?: string): this {
    this.ownerId = id;
    return this;
  }
  /**
   * 设置目标
   */
  public setTarget(thrower: DanmakuActor): this {
    this.thrower = thrower;
    return this;
  }
  
  /**
   * 启用预瞄 仅对于实体目标有效
   * @param verticle 启用竖直方向的预瞄 默认关闭
   */
  enablePreJudge(verticle: boolean = false): BulletShoot {
    this.preJudgeVerticle = verticle;
    this.preJudge = true;
    return this;
  }

  //////// 工具函数 ////////
  /**
   * 为 动量 应用不准确度
   */
  static applyInaccuracy (input: Vector, inaccuracy: number): Vector {
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
    rotate_axis = VO.Secondary.rotate_axis(rotate_axis, input, getRandom(0, 2 * Math.PI));
    // 绕旋转轴旋转方向向量 0~inaccuracy
    return VO.Secondary.rotate_axis(input, rotate_axis, getRandom(0, inaccuracy));
  }
  /**
   * 计算到目标的
   * @param thrower 发射者
   * @param target 目标
   * @param velocity 速率 不指定时为1
   * @param preJudge 启用预判 仅目标是实体时生效
   * @param preJudgeVerticle 启用竖直方向预判
   */
  static getVelocity2Target (thrower: DanmakuActor, target: DanmakuActor, velocity: number=1,
    preJudge: boolean=false, preJudgeVerticle: boolean=true): Vector | undefined {
    // 获取发射者和目标位置
    let throwerLocation = thrower.getLocation();
    let targetLocation = target.getLocation();
    if (throwerLocation[0].id !== targetLocation[0].id) {
      return undefined;
    }
    let s_location = throwerLocation[1];
    let t_location = targetLocation[1];

    // 位置相同时直接返回
    if (VO.equals(s_location, t_location)) {
      return new Vector(velocity, 0, 0);
    }

    // 预瞄，给定目标必须是实体
    if (preJudge && target instanceof EntityDanmakuActor) {
      let targetV = target.entity.getVelocity();
      // 受重力和落地影响，竖直方向容易误判，竖直方向默认关闭
      if (!preJudgeVerticle) {
        targetV.y = 0;
      }
      // 因为弹幕创建存在延迟，这里要加一个时间差
      let targetLocationOnShot = VO.add(t_location, VO.multiply(targetV, 5));
      // 发射点和计算时间差后的目标点不能重合
      if (!VO.equals(s_location, targetLocationOnShot)) {
        return VO.Advanced.preJudge(s_location, targetLocationOnShot, velocity, targetV);
      }
    }
    
    // 不使用预瞄或预瞄点与发射点重合
    return VO.Secondary.getVector_speed_direction(velocity, new Vector(
      t_location.x - s_location.x,
      t_location.y - s_location.y,
      t_location.z - s_location.z
    ));
  }
}
