import { Vector, VO } from "../../libs/VectorMC";
import { 
  BulletPatternBase,
} from "./BulletPatternBase";

const MIN_FAN_NUM = 2;
const MAX_YAW = 2 * Math.PI;

export interface FanShapedPatternData {
  fanNum: number;
  yawTotal: number;
  axisRotation?: number; // 中轴绕发射向量的旋转角度（先转）
  directionRotation?: number; // 发射向量绕旋转向量旋转的角度（后转）
}

export class FanShapedPattern extends BulletPatternBase<FanShapedPatternData> {
  shootByVelocity(data: FanShapedPatternData, velocity: Vector, inaccuracy: number): boolean {
    let yawTotal = data.yawTotal;
    let fanNum = data.fanNum;
    // 入参不符合条件 退出
    if (yawTotal < 0 || yawTotal > MAX_YAW || fanNum < MIN_FAN_NUM) {
      return false;
    }
    // 处理扇形偏转
    let yaw = -(yawTotal / 2);
    let addYaw = yawTotal / (fanNum - 1);
    let yawAxis;

    // 计算旋转轴
    let v = VO.normalized(velocity);
    if (v.y === 0) {
      // 发射向量与水平面平行，取y轴为旋转轴
      yawAxis = new Vector(0, 1, 0);
    }
    else {
      // 旋转轴与发射向量垂直，且二者所在平面与水平面垂直
      // 即与两向量垂直的向量（平面的法向量）与水平面平行（y=0）
      // 由点积，设该法向量为（1，0，-x1/z1）
      if (v.x === 0) {
        yawAxis = new Vector(0, -v.y, v.z);
      }
      else {
        yawAxis = new Vector(
          1,
          -(v.x + (v.z * v.z) / v.x) / v.y,
          v.z / v.x
        );
      }
    }
    yawAxis = VO.normalized(yawAxis)
    // 绕发射向量旋转旋转向量
    if (data.axisRotation) {
      yawAxis = VO.Secondary.rotate_axis(yawAxis, v, data.axisRotation);
    }

    // 计算每个弹幕的向量并发射
    for (let i = 1; i <= fanNum; i++) {
      let v1 = VO.Secondary.rotate_axis(velocity, yawAxis, yaw);
      yaw = yaw + addYaw;
      this.bulletShoot.shootByVelocity(v1, inaccuracy);
    }
    return true;
  }
}