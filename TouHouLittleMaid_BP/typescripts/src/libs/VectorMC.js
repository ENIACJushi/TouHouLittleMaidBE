// 发现mc自己有向量运算方法后，修改原来的基于数组的方法
import { Direction } from "@minecraft/server";
import { logger } from "./ScarletToolKit";

// 仅用于快速创建向量和指定类型
export class Vector {
    x; y; z;
    /**
     * @param {Number} x 
     * @param {Number} y 
     * @param {Number} z 
     */
    constructor(x, y, z){
        return {x:x, y:y, z:z};
    }
}

export class VectorMC{
    ////// 基本运算 //////
    /**
     * 取模
     * @param {Vector} v
     * @returns {number}
     */
    static length(v){
        return Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    }
    /**
     * 化为单位向量，返回一个新对象
     * @param {Vector} v
     * @returns {Vector}
     */
    static normalized(v){
        let l = this.length(v);
        if (l < 1e-8) return new Vector(0, 0, 0);
        return new Vector(v.x/l, v.y/l, v.z/l);
    }
    /**
     * 加
     * @param {Vector} v1
     * @param {Vector} v2
     * @returns {Vector}
     */
    static add(v1, v2){
        return new Vector( v1.x + v2.x, v1.y + v2.y, v1.z + v2.z );
    }
    /**
     * 减 v1 - v2
     * @param {Vector} v1 
     * @param {Vector} v2 
     * @returns {Vector}
     */
    static sub(v1, v2){
        return new Vector( v1.x - v2.x, v1.y - v2.y, v1.z - v2.z );
    }
    /**
     * 数乘
     * @param {Vector} v 
     * @param {number} n 
     * @returns 
     */
    static multiply(v, n){
        return new Vector(v.x*n, v.y*n, v.z*n)
    }
    /**
     * 内积 a · b
     * @param {Vector} v1 
     * @param {Vector} v2
     * @returns {number}
     */
    static dot(v1, v2){
        return v1.x*v2.x + v1.y*v2.y + v1.z*v2.z
    }
    /**
     * 外积
     * @param {Vector} a
     * @param {Vector} b 
     * @returns {Vector}
     */
    static cross(a, b){
        return new Vector(a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x)
    }
    /**
     * 等于
     * @param {Vector} a 
     * @param {Vector} b
     * @returns {boolean}
     */
    static equals(a, b){
        return a.x===b.x && a.y===b.y && a.z===b.z;
    }

    ////// 二级运算 //////
    /**
     * 绕轴旋转
     * @param {Vector} source 
     * @param {Vector} axis
     * @param {number} theta A numeric expression that contains an angle measured in radians.
     */
    static rotate_axis(source, axis, theta){
        let axis_n = this.normalized(axis);
        let cos = Math.cos(theta);
        let sin = Math.sin(theta);
        return this.add(
            this.add(this.multiply(source, cos), this.multiply(this.cross(axis_n, source), sin)),
            this.multiply(this.multiply(axis_n, this.dot(axis_n, source)), (1-cos))
        );
    }
    /**
     * 将向量转为字符
     * @param {Vector} vector 
     * @returns {string}
     */
    static toString(vector){
        return `x:${vector.x.toFixed(2)},y:${vector.y.toFixed(2)},z:${vector.z.toFixed(2)}`
    }
    /**
     * 为了兼容旧库，移植而来。效率应该可以提升
     * @param {number} speed 
     * @param {Vector} direction 
     * @returns 
     */
    static getVector_speed_direction(speed, direction){
        let k = Math.sqrt((speed*speed)/(direction.x*direction.x + direction.y*direction.y + direction.z*direction.z));
        return new Vector(direction.x*k, direction.y*k, direction.z*k);
    }
    ////// 高级运算 //////
    /**
     * 获取向量(0,1,0))到v2的欧拉角（仅z,x，弧度制）
     * @param {Vector} v 
     * @returns {Array}
     */
    static getEulerAngle(v){
        let z = Math.atan2(v.x, v.y);
        let x = Math.acos(Math.sqrt(v.x*v.x + v.y*v.y) / this.length(v));

        if(v.z < 0) x = -1*x;
        return [x, z];
    }
    /**
     * 获取任意一条与给定非零向量垂直的向量
     * @param {Vector} vector
     * @returns {Vector} 
     */
    static getAnyVerticalVector(vector){
        if(vector.x==0 && vector.y==0){
            
            if(vector.z==0) return undefined; // 向量为0，不符合函数要求
            // 由函数说明，z不为0，取与z轴垂直的x轴
            return new Vector(1,0,0);
        }
        else{
            if(vector.y == 0){
                // 向量在xz平面上，取y轴
                return new Vector(0, 1, 0);
            }
            else{
                // 与xz平面有一定夹角，取xy平面上与向量垂直的一个向量
                return new Vector(1, -vector.x/vector.y, 0);
            }
        }
    }
    /**
     * 由视角向量获取面朝方向
     * @param {Vector} view 
     * @returns {Direction}
     */
    static getDirectionByView2D(view){
        let temp = (Math.abs(view.x) - Math.abs(view.y) > 0);// |x| > |y|
        if(view.x > 0){
            if(view.z > 0){
                return temp ? Direction.East : Direction.South;
            }
            else{
                return temp ? Direction.East : Direction.North;
            }
        }
        else{
            if(view.z > 0){
                return temp ? Direction.West : Direction.South;
            }
            else{
                return temp ? Direction.West : Direction.North;
            }
        }
    }
    /**
     * 提前量计算
     * @param {Vector} A 点 A 的位置
     * @param {Vector} B 点 B 的位置
     * @param {Number} Va_len A 发射的直线弹射物的速率
     * @param {Vector} Vb B 的速度
     * @returns {Vector} A 发射的直线弹射物的速度
     */
    static preJudge(A, B, Va_len, Vb){
        let BA = this.sub(A, B);
        let BA_normalized = this.normalized(BA);

        // 求Va'
        let Vb_comp2_len = this.dot(Vb, BA_normalized);
        let Vb_comp2 = this.multiply(BA_normalized, Vb_comp2_len);
        let Va_comp1 = this.sub(Vb, Vb_comp2); // Va_comp1 = Vb_comp1
        
        // 求Va''
        let Va_comp2_len_d = Va_len*Va_len - (Va_comp1.x*Va_comp1.x + Va_comp1.y*Va_comp1.y + Va_comp1.z*Va_comp1.z);
        if(Va_comp2_len_d <= 0){ // Va 与 Vb 垂直，Va = Va''，直接出结果
            return Va_comp1;
        }
        
        let Va_comp2_len = Math.sqrt(Va_comp2_len_d);
        let Va_comp2 = this.multiply(this.multiply(BA_normalized, -1), Va_comp2_len);
        
        return this.add(Va_comp1, Va_comp2); // Va
    }
}

