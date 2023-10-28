// 发现mc自己有向量运算方法后，修改原来的基于数组的方法
import { Vector } from "@minecraft/server";
/**
 * 
 * @param {Vector} v1 
 * @param {Vector} v2
 */
function dot(v1, v2){
    return v1.x*v2*x + v1.y*v2*y + v1.z*v2*z
}
/**
 * 
 * @param {Vector} source 
 * @param {Vector} axis
 * @param {number} theta A numeric expression that contains an angle measured in radians.
 */
export function rotate_axis(source, axis, theta){

    let axis_n = axis.normalized();
    let cos = Math.cos(theta);
    let sin = Math.sin(theta);
    return Vector.add(
        Vector.add(Vector.multiply(source, cos), Vector.multiply(Vector.cross(axis_n, source), sin)),
                Vector.multiply(Vector.multiply(axis_n, dot(axis_n, source)), (1-cos))
            );
}