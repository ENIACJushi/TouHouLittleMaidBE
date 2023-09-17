
import * as Tool from "./scarletToolKit"

//////////////////// 向量操作 ////////////////////
// 数乘 a * n, n 为数
/**
 * 
 * @param {Array} a 
 * @param {Number} n 
 * @returns 
 */
export function multi(a, n){
    return [a[0]*n, a[1]*n, a[2]*n]
}

/**
 * 加法 a + b
 * @param {Array} a 
 * @param {Array} b 
 * @returns 
 */
export function add(a, b){
    let result = []
    for(let i = 0; i < a.length; i++){
        result.push(a[i] + b[i])
    }
    return result
}

// 减法 a - b
export function sub(a, b){
    let result = []
    for(let i = 0; i < a.length; i++){
        result.push(a[i] - b[i])
    }
    return result
}

// 内积 a · b
export function dot(a, b){
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

// 外积 a × b
export function cross(a, b){
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]]
}

// 取模
export function length(vector){
    let sum = 0;
    for(let e of vector){
        sum += e*e;
    }
    return Math.sqrt(sum)
}

// 单位化
export function normalize(vector){
    let length = vector.length
    if (length < 1e-8){
        return [0, 0, 0]
    }
    return [vector[0]/length, vector[1]/length, vector[2]/length]
}

// 投影  a 在 以 b 为法向量的平面上的投影
export function projection_plane(a, b){
    return add(a, multi(normalize(a), dot(a,b)/length(b)));
}

// 向量source绕旋转轴axis(单位向量)的右手方向转过角度 theta 得到新向量
/**
 * 
 * @param {Array} source 
 * @param {Array} axis
 * @param {number} theta A numeric expression that contains an angle measured in radians.
 */
export function rotate_axis(source, axis, theta){
    let cos = Math.cosh(theta);
    let sin = Math.sinh(theta);
    return add(
                add(multi(source, cos), multi(cross(axis, source), sin)),
                multi(multi(axis, dot(axis, source)), (1-cos))
            )
}

/**
 * 
 * @param {number} speed 
 * @param {Array} direction 
 */
export function getVector_speed_direction(speed, direction){
    let k = Math.sqrt((speed*speed)/(direction[0]*direction[0] + direction[1]*direction[1] + direction[2]*direction[2]));
    return [direction[0]*k, direction[1]*k, direction[2]*k]
}