import { Dimension, Entity, system } from "@minecraft/server";
import { BulletBase } from "./BulletBase";
import { Vector, VectorMC } from "../../../libs/VectorMC";
import { logger } from "../../../libs/ScarletToolKit";

const ANGLE_PI = 180 / Math.PI;
const PI_ANGLE = Math.PI / 180;


export class Amulet extends BulletBase {
  getBulletEntityName (): string {
    return 'thlmd:bullet_amulet';
  }
  public createBulletEntity (world: Dimension, location: Vector): Entity {
    let bullet = super.createBulletEntity(world, location);
    
    return bullet;
  }

  public initVelocity(entity: Entity, velocity: Vector) {
    super.initVelocity(entity, velocity);
    Amulet.setDirectionProperty(entity, VectorMC.normalized(velocity));
  }
  
  public setEntityVelocity(entity: Entity, velocity: Vector) {
    super.setEntityVelocity(entity, velocity);
    Amulet.setDirectionProperty(entity, velocity);
  }

  
  public applyEntityImpulse(entity: Entity, velocity: Vector) {
    entity.applyImpulse(velocity);
    Amulet.setDirectionProperty(entity, velocity);
  }


  /**
   * 设置弹幕的运动方向
   * 角度：Z - Y 决定朝向， X 决定自转角
   */
  static setDirectionProperty(entity: Entity, direction: Vector) {
    let input = VectorMC.normalized(direction);
    // 速度信息，动画坐标系的xz和世界坐标系相反
    entity.setProperty("thlm:v_x", -input.x);
    entity.setProperty("thlm:v_y", input.y);
    entity.setProperty("thlm:v_z", -input.z);
  }
  
  /**
   * 设置弹幕的自转角
   * Z - Y 决定朝向， X 决定自转角
   */
  static setXRotationProperty(entity: Entity, r: number) {
    entity.setProperty("thlm:r_x", r);
  }
}


/**
 * 符札实体控制器
 */
export class AmuletController {
  private bulletEntity: Entity;
  
  /**
   * 转向增量 为空时瞬间变向 角度制单位
   */
  private turningIncrement?: number;
  /**
   * 每隔 turningStep 刻进行一次变向
   */
  private turningStep: number = 1;
  private turningTaskId?: number;

  constructor(entity: Entity) {
    this.bulletEntity = entity;
  }

  /**
   * 设置每一步转弯的角度
   */
  setTurningIncrement(increment: number): this {
    this.turningIncrement = increment;
    return this;
  }
  setTurningStep(step: number): this {
    this.turningStep = step;
    return this;
  }

  /**
   * 开始新的转向任务
   * 仅变向，不变速
   */
  startTurningTask(_v: Vector) {
    let v = VectorMC.normalized(_v);
    /**
     * v, v0 平面的法向量垂直于v0  符札平面向量也垂直于v0  所以只需要计算 v-v0平面法向量 与 符札平面法向量 的夹角，然后用PI/2减去它
     */
    // 原动量
    let v0 = this.bulletEntity.getVelocity();
    
    // 旋转轴向量 | 即 v-v0 平面法向量 | 即 v0, v 的叉积，v0 遵照右手法则旋得 v
    let rotateNormalV = VectorMC.cross(v0, v);

    // 当外积为0，原运动方向与目标运动方向平行，不需要旋转
    if (rotateNormalV.x === 0 && rotateNormalV.y === 0 && rotateNormalV.z === 0) {
      return;
    }

    // 符札平面法向量 | 即z-x平面上与运动方向垂直的向量
    let selfNormalV = new Vector(-v0.z, 0, v0.x);

    // 需要旋转的度数
    let v0Length = VectorMC.length(v0);
    let totalAngle = Math.acos(VectorMC.dot(v0, v) / VectorMC.length(v0)) * ANGLE_PI; // v 已经单位化了 直接取 1
    // let totalAngle = VectorMC.getAngle(v0, v);

    // theta | 符札平面法向量 与 旋转轴向量的夹角
    let theta = VectorMC.getAngle(selfNormalV, rotateNormalV);
    // 自转角 | 当符札平面法向量 和 旋转平面上的目标符札平面法向量 在旋转轴向量同侧，为 PI/2-theta 异侧为 PI/2+theta
    // 同/异侧判断 | 因为 符札平面法向量 总是z-x平面上的向量，所以可以靠旋转轴向量所在象限来判断自转角的旋转方向: xz平面上方为同侧，下方为异侧
    let rotateAngle = rotateNormalV.y > 0 ? Math.PI / 2 - theta : Math.PI / 2 + theta;
    this.bulletEntity.setProperty('thlm:r_x', rotateAngle * ANGLE_PI);

    // 开始转向任务
    let currentAngle = 0;
    this.turningTaskId = system.runInterval(() => {
      // 实体消失 结束任务
      if(!this.bulletEntity) {
        system.clearRun(this.turningTaskId!);
        this.turningTaskId = undefined;
        return;
      }
      try {
        currentAngle += this.turningIncrement ?? 360;
        let currentV0 = this.bulletEntity.getVelocity();
        let currentV0Length = VectorMC.length(currentV0);
        // 旋转完成 结束任务
        if (!this.turningIncrement || currentAngle >= totalAngle) {
          // 最终动量
          let finalV = VectorMC.multiply(v, currentV0Length);
          // 施加目标动量
          Amulet.setDirectionProperty(this.bulletEntity, finalV);
          this.bulletEntity.clearVelocity();
          this.bulletEntity.applyImpulse(finalV);
          // 完成任务
          system.clearRun(this.turningTaskId!);
          this.turningTaskId = undefined;
          return;
        }
  
        // 计算下一步动量
        let nextV = VectorMC.rotate_axis(currentV0, rotateNormalV, this.turningIncrement * PI_ANGLE);
        
        // 施加动量
        Amulet.setDirectionProperty(this.bulletEntity, nextV);
        this.bulletEntity.clearVelocity();
        this.bulletEntity.applyImpulse(nextV);
      } catch {
        system.clearRun(this.turningTaskId!);
        this.turningTaskId = undefined;
        return;
      }
    }, this.turningStep);
  }


  /**
   * 中止转向任务
   */
  stopTurningTask() {
    if (!this.turningTaskId) {
      return;
    }
    system.clearRun(this.turningTaskId);
    this.turningTaskId = undefined;
  }
}