import { Dimension, Entity, system } from "@minecraft/server";
import { BulletBase } from "./BulletBase";
import { Vector, VO } from "../../../libs/VectorMC";
import { GeneralBulletColor } from "./general_bullet/GeneralBulletColor";

const ANGLE_PI = 180 / Math.PI;
const PI_ANGLE = Math.PI / 180;


export class Amulet extends BulletBase {
  // 颜色，与通用弹种相通
  color = GeneralBulletColor.RED;
  // 旋转角
  private xRotation?: number = undefined;
  private yRotation?: number = undefined;
  private zRotation?: number = undefined;
  private yaw: number = 0;
  // 主运动方向
  private direction: Vector = new Vector(0, 0, 1);

  public getBulletEntityName (): string {
    return 'thlmd:bullet_amulet';
  }

  public createBulletEntity (world: Dimension, location: Vector): Entity {
    let bullet = super.createBulletEntity(world, location);
    // 设置自转角
    this.applyColor(bullet);
    // 设置旋转角信息，动画坐标系的xz和世界坐标系相反，旋转顺序被特殊处理为 Y-Z-X
    let xRotation = this.xRotation ?? 0;
    let yRotation = this.yRotation;
    let zRotation = this.zRotation;
    if (zRotation === undefined || yRotation === undefined) {
      let dirRotation = Amulet.getRotationByDirection(this.direction);
      zRotation = zRotation ?? -VO.radian2radius(dirRotation.z);
      yRotation = yRotation ?? VO.radian2radius(dirRotation.y);
    }
    let yaw = this.yaw;
    if (-90 <= yRotation && yRotation <= 90) {
      yaw = -yaw;
    }
    if (zRotation < 0) {
      yaw = -yaw;
    }
    bullet.setProperty("thlm:r_x", xRotation);
    bullet.setProperty("thlm:r_y", yRotation);
    bullet.setProperty("thlm:r_z", zRotation);
    bullet.setProperty("thlm:yaw", yaw);
    return bullet;
  }

  /**
   * 设置弹幕的运动方向 在生成时会自动根据朝向设置旋转角，若有指定旋转角，则以旋转角为准
   * 角度：Z - Y 决定朝向， X 决定自转角
   */
  public setDirection(direction?: Vector) {
    if (!direction) {
      this.direction = new Vector(0, 0, 1);
      return this;
    }
    this.direction = VO.normalized(direction);
    return this;
  }

  /**
   * 设置弹幕的自转角（角度制）
   * Z - Y 决定朝向， X 决定自转角
   */
  public setXRotation(r: number) {
    this.xRotation = r;
    return this;
  }

  /**
   * 设置扇形弹幕的偏转角
   *  弹幕会调整旋转角，保证与0偏转角的弹幕共面
   */
  public setYaw(yaw: number) {
    this.yaw = yaw;
    return this;
  }

  /**
   * 设置颜色
   */
  public setColor (color: number): this {
    this.color = color;
    return this;
  }

  /**
   * 应用颜色到实体
   */
  protected applyColor (danmaku: Entity) {
    danmaku.triggerEvent(GeneralBulletColor.getTriggerEvent(this.color));
  }

  /**
   * 由方向获得旋转角（x轴无旋转信息）
   */
  static getRotationByDirection(dir: Vector): Vector {
    return {
      x: 0,
      y: (dir.x === 0 && dir.z === 0) ? 0 : Math.atan2(dir.z, dir.x), // 竖直向下，没有y轴旋转信息
      z: Math.atan2(dir.y, Math.sqrt(dir.x*dir.x + dir.z*dir.z)),
    };
  }
}


/**
 * 符札实体控制器
 */
export class AmuletController {
  private bulletEntity: Entity;
  private turningTaskId?: number;
  private speedingTaskId?: number;

  constructor(entity: Entity) {
    this.bulletEntity = entity;
  }

  /**
   * 开始新的转向任务 仅变向，不变速
   * @param _v 目标方向
   * @param turningIncrement 转向增量 为空时瞬间变向 角度制单位
   * @param turningStep  每隔 turningStep 刻进行一次变向
   */
  startTurningTask(_v: Vector, turningIncrement: number, turningStep: number, finishCallback: ()=>void) {
    let v = VO.normalized(_v);
    /**
     * v, v0 平面的法向量垂直于v0  符札平面向量也垂直于v0  所以只需要计算 v-v0平面法向量 与 符札平面法向量 的夹角，然后用PI/2减去它
     */
    // 原动量
    let v0 = this.bulletEntity.getVelocity();
    
    // 旋转轴向量 | 即 v-v0 平面法向量 | 即 v0, v 的叉积，v0 遵照右手法则旋得 v
    let rotateNormalV = VO.cross(v0, v);

    // 当外积为0，原运动方向与目标运动方向平行，不需要旋转
    if (rotateNormalV.x === 0 && rotateNormalV.y === 0 && rotateNormalV.z === 0) {
      finishCallback();
      return;
    }

    // 符札平面法向量 | 即z-x平面上与运动方向垂直的向量
    let selfNormalV = new Vector(-v0.z, 0, v0.x);

    // 需要旋转的度数
    let v0Length = VO.length(v0);
    let totalAngle = Math.acos(VO.dot(v0, v) / VO.length(v0)) * ANGLE_PI; // v 已经单位化了 直接取 1
    // let totalAngle = VO.getAngle(v0, v);

    // theta | 符札平面法向量 与 旋转轴向量的夹角
    let theta = VO.Secondary.getIncludedAngle(selfNormalV, rotateNormalV);
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
        currentAngle += turningIncrement ?? 360;
        let currentV0 = this.bulletEntity.getVelocity();
        let currentV0Length = VO.length(currentV0);
        // 旋转完成 结束任务
        if (turningIncrement <= 0 || currentAngle >= totalAngle) {
          // 最终动量
          let finalV = VO.multiply(v, currentV0Length);
          // 施加目标动量
          this.bulletEntity.clearVelocity();
          this.bulletEntity.applyImpulse(finalV);
          // 完成任务
          system.clearRun(this.turningTaskId!);
          this.turningTaskId = undefined;
          finishCallback();
          return;
        }
  
        // 计算下一步动量
        let nextV = VO.Secondary.rotate_axis(currentV0, rotateNormalV, turningIncrement * PI_ANGLE);
        
        // 施加动量
        this.bulletEntity.clearVelocity();
        this.bulletEntity.applyImpulse(nextV);
      } catch {
        system.clearRun(this.turningTaskId!);
        this.turningTaskId = undefined;
        return;
      }
    }, turningStep);
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

  /**
   * 开始新的加速任务 仅加速，不变向
   * @param a 加速度（标量）
   * @param t 次数
   * @param speedingStep  每隔 turningStep 刻进行一次变向
   */
  startSpeedingTask(a: number, t: number, speedingStep: number) {
    let step = 0;
    this.speedingTaskId = system.runInterval(() => {
      // 实体消失 结束任务
      if(!this.bulletEntity || step >= t) {
        system.clearRun(this.speedingTaskId!);
        this.speedingTaskId = undefined;
        return;
      }
      try {
        this.speedUp(a);
      } catch {
        system.clearRun(this.speedingTaskId!);
        this.speedingTaskId = undefined;
        return;
      }
      step++;
    }, speedingStep);
  }

  /**
   * 立即加速，不变向
   * @param v
   */
  speedUp(v: number) {
    let v0 = this.bulletEntity.getVelocity();
    let deltaV = VO.multiply(VO.normalized(v0), v) ;
    this.bulletEntity.applyImpulse(deltaV);
  }
}