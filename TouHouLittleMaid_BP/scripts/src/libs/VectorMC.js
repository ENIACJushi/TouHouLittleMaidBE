// 发现mc自己有向量运算方法后，修改原来的基于数组的方法
import { Direction, Vector } from "@minecraft/server";
import { logger } from "./scarletToolKit";
/**
 * 
 * @param {Vector} v1 
 * @param {Vector} v2
 */
function dot(v1, v2){
    return v1.x*v2.x + v1.y*v2.y + v1.z*v2.z
}
/**
 * 绕轴旋转
 * @param {Vector} source 
 * @param {Vector} axis
 * @param {number} theta A numeric expression that contains an angle measured in radians.
 */
export function rotate_axis(source, axis, theta){
    let axis_n = normalized(axis);
    let cos = Math.cos(theta);
    let sin = Math.sin(theta);
    return Vector.add(
        Vector.add(Vector.multiply(source, cos), Vector.multiply(Vector.cross(axis_n, source), sin)),
                Vector.multiply(Vector.multiply(axis_n, dot(axis_n, source)), (1-cos))
            );
}
/**
 * 化为单位向量
 * 发现获取到的Vector3并没有这个方法
 * @param {Vector} vector 
 * @returns {Vector}
 */
export function normalized(vector){
    let l = length(vector)
    if (l < 1e-8){
        return new Vector(0, 0, 0)
    }
    return new Vector(vector.x/l, vector.y/l, vector.z/l);
}
/**
 * 由视角向量获取面朝方向
 * @param {Vector} view 
 * @returns {Direction}
 */
export function getDirectionByView2D(view){
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
 * 将向量转为字符
 * @param {Vector} view 
 * @returns {string}
 */
export function toString(vector){
    return `x:${vector.x},y:${vector.y},z:${vector.z}`
}

/**
 * 取模
 * @param {Vector} vector 
 * @returns {string}
 */
export function length(vector){
    return Math.sqrt(vector.x*vector.x + vector.y*vector.y + vector.z*vector.z);
}

/**
 * 获取任意一条与给定非零向量垂直的向量
 * @param {Vector} vector
 * @returns {Vector} 
 */
export function getAnyVerticalVector(vector){
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

// 获取向量(0,1,0))到v2的欧拉角（仅z,x，弧度制）
export function getEulerAngle(v){
    let z = Math.atan2(v.x, v.y);
    let x = Math.acos(Math.sqrt(v.x*v.x + v.y*v.y) / length(v));

    if(v.z < 0) x = -1*x
    return [x, z];
}
