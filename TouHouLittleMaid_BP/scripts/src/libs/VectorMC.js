// 发现mc自己有向量运算方法后，修改原来的基于数组的方法
import { Direction, Vector } from "@minecraft/server";
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