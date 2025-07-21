// 发现mc自己有向量运算方法后，修改原来的基于数组的方法
import { Direction } from "@minecraft/server";

const HALF_PI = Math.PI / 2;

// 仅用于快速创建向量和指定类型
export class Vector {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  
  constructor(x: number, y: number, z: number) {
    return { x: x, y: y, z: z };
  }
}

// 用三个向量指定一个坐标系，仅用于快速创建坐标系和指定类型
export class Axis {
  x: Vector = new Vector(1, 0, 0);
  y: Vector = new Vector(0, 1, 0);
  z: Vector = new Vector(0, 0, 1);

  constructor(x: Vector, y: Vector, z: Vector) {
    return { x: x, y: y, z: z };
  }
}
/**
 * VO - Vector Operation
 * Secondary: 二级运算
 * Advanced: 高级运算 常常带着鲜明的场景属性
 */
export namespace VO {
  /**
   * 取模
   */
  export function length(v: Vector): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * 化为单位向量，返回一个新对象
   */
  export function normalized(v: Vector): Vector {
    let l = VO.length(v);
    if (l < 1e-8) return new Vector(0, 0, 0);
    return new Vector(v.x / l, v.y / l, v.z / l);
  }
  
  /**
   * 加
   */
  export function add(v1: Vector, v2: Vector): Vector {
    return new Vector(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z);
  }

  /**
   * 减 v1 - v2
   */
  export function sub(v1: Vector, v2: Vector): Vector {
    return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
  }

  /**
   * 数乘
   */
  export function multiply(v: Vector, n: number) {
    return new Vector(v.x * n, v.y * n, v.z * n);
  }

  /**
   * 内积 a · b
   */
  export function dot(v1: Vector, v2: Vector): number {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  }

  /**
   * 外积
   */
  export function cross(a: Vector, b: Vector): Vector {
    return new Vector(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }
  
  /**
   * 等于
   */
  export function equals(a: Vector, b: Vector): boolean {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  }

  /**
   * 将向量转为字符
   */
  export function toString(vector: Vector): string {
    return `${vector.x.toFixed(2)}  ${vector.y.toFixed(2)}  ${vector.z.toFixed(2)}`;
  }

  export function isZero(vector: Vector): boolean {
    return vector.x === 0 && vector.y === 0 && vector.z === 0;
  }
  /**
   * 复制一个向量
   */
  export function copy(vector: Vector): Vector {
    return new Vector(vector.x, vector.y, vector.z);
  }

  export namespace Secondary {
    /**
     * 绕轴旋转
     * @param {Vector} source 
     * @param {Vector} axis
     * @param {number} theta A numeric expression that contains an angle measured in radians.
     */
    export function rotate_axis(source: Vector, axis: Vector, theta: number) {
      let axis_n = VO.normalized(axis);
      let cos = Math.cos(theta);
      let sin = Math.sin(theta);
      return VO.add(
        VO.add(VO.multiply(source, cos), VO.multiply(VO.cross(axis_n, source), sin)),
        VO.multiply(VO.multiply(axis_n, VO.dot(axis_n, source)), (1 - cos))
      );
    }
    
    /**
     * 为了兼容旧库，移植而来。效率应该可以提升
     */
    export function getVector_speed_direction(speed: number, direction: Vector) {
      let k = Math.sqrt((speed * speed) / (direction.x * direction.x + direction.y * direction.y + direction.z * direction.z));
      return new Vector(direction.x * k, direction.y * k, direction.z * k);
    }

    /**
     * 获取两个向量的夹角
     */
    export function getIncludedAngle(v1: Vector, v2: Vector): number {
      return Math.acos(VO.dot(v1, v2) / (VO.length(v1) * VO.length(v2)));
    }
  }

  export namespace Advanced {
    /**
     * @deprecated MC的转动顺序是ZYX，这种方法难以实现后续的滚动角计算
     * 获取向量(0,1,0))到v2的欧拉角（仅z,x，弧度制）
     * @param {Vector} v 
     * @returns {Array}
     */
    export function getEulerAngleXZ(v: Vector): Array<any> {
      let z = Math.atan2(v.x, v.y);
      let x = Math.acos(Math.sqrt(v.x * v.x + v.y * v.y) / VO.length(v));

      if (v.z < 0) {
        x = -1 * x;
      }
      return [x, z];
    }

    /**
     * @deprecated 欧拉角的滚动角难以指定，如果要给弹幕计算旋转角，可使用一种固定坐标系和相对坐标系混合的转法
     * 获取向量 (1,0,0) 到 v 的欧拉角（Z-Y，弧度制）
     * @param {Vector} v 
     * @returns {Array} 
     */
    export function getEulerAngle(v: Vector): Array<any> {
      let z = Math.atan2(v.y, v.x);
      let y = Math.atan2(v.z, Math.sqrt(v.x * v.x + v.y * v.y));
      if (v.x < 0) {
        // Z 在 +-PI/2 之间
        z = z + (z < 0 ? Math.PI : -Math.PI);
        y = (y < 0 ? -Math.PI : Math.PI) - y;
      }
      return [z, y];
    }

    /**
     * 获取向量 (1,0,0) 到 v 的弹幕角（Y绕固定坐标系转动，Z X 绕相对坐标系转动）
     * @param {Vector} v 
     * @returns {Array} 
     */
    export function getDanmakuAngle(v: Vector): Array<any> {
      let z = Math.atan2(v.y, v.x);
      let y = Math.atan2(v.z, v.x);
      return [z, y];
    }

    /**
     * 获取任意一条与给定非零向量垂直的向量
     */
    export function getAnyVerticalVector(vector: Vector): Vector {
      if (vector.x === 0 && vector.y === 0) {
        // 向量为0，返回z轴
        if (vector.z === 0) {
          return new Vector(0, 0, 1);
        }
        // 由函数说明，z不为0，取与z轴垂直的x轴
        return new Vector(1, 0, 0);
      }
      if (vector.y === 0) {
        // 向量在xz平面上，取y轴
        return new Vector(0, 1, 0);
      }
      // 与xz平面有一定夹角，取xy平面上与向量垂直的一个向量
      return new Vector(1, -vector.x / vector.y, 0);
    }

    /**
     * 由视线获取屏幕坐标系
     * @param view 视线向量 作为坐标系的 x 轴
     * @param isRolling 是否处于翻滚状态。若不在翻滚，则 y 轴处于 zOx 平面上方；若在翻滚，则 y 轴位于  zOx 平面下方。
     *    两种情况的 y 轴向量正好相反
     */
    export function getAxisByView(view: Vector, isRolling: boolean=false): Axis {
      let roll = isRolling ? -1 : 1;
      let x = VO.normalized(view);
      let xzLength = Math.sqrt(x.x*x.x + x.z*x.z);
      let temp = roll * (xzLength / x.y);
      return {
        x,
        y: new Vector(x.x * temp , roll * xzLength , x.z * temp),
        z: VO.normalized(new Vector(x.z, 0, -x.x)),
      }
    }

    /**
     * 由视角向量获取面朝方向
     */
    export function getDirectionByView2D(view: Vector): Direction {
      let temp = (Math.abs(view.x) - Math.abs(view.y) > 0);// |x| > |y|
      if (view.x > 0) {
        if (view.z > 0) {
          return temp ? Direction.East : Direction.South;
        }
        return temp ? Direction.East : Direction.North;
      }
      if (view.z > 0) {
        return temp ? Direction.West : Direction.South;
      }
      return temp ? Direction.West : Direction.North;
    }

    /**
     * 提前量计算
     * @param {Vector} A 点 A 的位置
     * @param {Vector} B 点 B 的位置
     * @param {Number} Va_len A 发射的直线弹射物的速率
     * @param {Vector} Vb B 的速度
     * @returns {Vector} A 发射的直线弹射物的速度
     */
    export function preJudge(A: Vector, B: Vector, Va_len: number, Vb: Vector): Vector {
      let BA = VO.sub(A, B);
      let BA_normalized = VO.normalized(BA);

      // 求Va'
      let Vb_comp2_len = VO.dot(Vb, BA_normalized);
      let Vb_comp2 = VO.multiply(BA_normalized, Vb_comp2_len);
      let Va_comp1 = VO.sub(Vb, Vb_comp2); // Va_comp1 = Vb_comp1

      // 求Va''
      let Va_comp2_len_d = Va_len * Va_len - (Va_comp1.x * Va_comp1.x + Va_comp1.y * Va_comp1.y + Va_comp1.z * Va_comp1.z);
      if (Va_comp2_len_d <= 0) { // Va 与 Vb 垂直，Va = Va''，直接出结果
        return Va_comp1;
      }

      let Va_comp2_len = Math.sqrt(Va_comp2_len_d);
      let Va_comp2 = VO.multiply(VO.multiply(BA_normalized, -1), Va_comp2_len);

      return VO.add(Va_comp1, Va_comp2); // Va
    }
  }
}
