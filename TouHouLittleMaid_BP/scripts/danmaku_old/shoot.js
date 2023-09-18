import { Dimension, Vector } from "@minecraft/server";
import { DanmakuColors, DanmakuPrefix } from "./config"
import * as Vec from "../../libs/vector3d";
import * as Tool from "../../libs/scarletToolKit"

export function getRandomColor(){
    let res = Tool.getRandomInteger(1, 13);
    return res
}
/**
 * 
 * @param {Dimension}     dimension
 * @param {Vector}        location
 * @param {Vector}        velocity
 * @param {string}        source_id  Entity id of shooter
 * @param {Object}        type       DanmakuTypes
 * @param {number}       [damage=8] 
 * @param {Integer}      [color=-1]  DanmakuColors
 */
export function shootDanmaku(dimension, location, velocity, source_id, type, damage=8, color=DanmakuColors.RANDOM){
    // Summon entity
    let danmaku = dimension.spawnEntity(DanmakuPrefix + type.name, location);
    // Set color
    if(color == -1){
        danmaku.triggerEvent("init_ramdon");
    }
    else{
        danmaku.triggerEvent("init_c" + color);
    }
    // Set source
    danmaku.setDynamicProperty("source", source_id);
    // Set damage
    danmaku.setDynamicProperty("damage", damage);
    // Set velocity
    danmaku.applyImpulse(velocity);
}
//////// 单点狙 ////////
export function singleShoot(dimension, location, source_location, target_location, source_id, type, offset=1, speed=0.6, damage=8, color=DanmakuColors.RANDOM){
    let v = [target_location.x - source_location.x, target_location.y - source_location.y - offset, target_location.z - source_location.z];
    v = Vec.getVector_speed_direction(speed, v);

    shootDanmaku(dimension, location, new Vector(v[0], v[1], v[2]), source_id, type, damage, color);
}

//////// 扇形 ////////
/**
 * 
 * @param {Dimension} dimension 
 * @param {Vector} location
 * @param {Vector} source_location
 * @param {Vector} target_location
 * @param {number} source_id 
 * @param {Object} type  DanmakuTypes
 * @param {number} [yawTotal=Math.PI/3]
 * @param {number} [fanNum=8]
 * @param {number[]} [axis=[0,1,0]] 
 * @param {number} [offset=1] 
 * @param {number} [speed=0.6]
 * @param {number} [damage=8]
 * @param {number} [color=-1] DanmakuColors
 */
export function fanShapedShot(dimension, location, source_location, target_location, source_id, type, yawTotal = Math.PI / 3, fanNum=8, axis=[0,1,0], offset=1, speed=0.6, damage=8, color=DanmakuColors.RANDOM){
    // yawTotal < 0 || yawTotal > MAX_YAW || fanNum < MIN_FAN_NUM
    let v = [target_location.x - source_location.x, target_location.y - source_location.y - offset, target_location.z - source_location.z];
    v = Vec.getVector_speed_direction(speed, v);

    let yaw = -(yawTotal / 2);
    let addYaw = yawTotal / (fanNum - 1);
    let aixs_norm = Vec.normalize(axis);

    for (let i = 1; i <= fanNum; i++) {
        let v1 = Vec.rotate_axis(v, aixs_norm, yaw);
        yaw = yaw + addYaw;
        shootDanmaku(dimension, location, new Vector(v1[0], v1[1], v1[2]), source_id, type, damage, color)
    }
}

/**
 * 在指定游戏刻内分时发射弹幕
 * 模式：从低角度到高角度、从高角度到低角度、从零角度到两边
 * @param {Dimension} dimension 
 * @param {Vector} location
 * @param {Vector} source_location
 * @param {Vector} target_location
 * @param {number} source_id 
 * @param {Object} type  DanmakuTypes
 * @param {number} [yawTotal=Math.PI/3]
 * @param {number} [fanNum=8]
 * @param {number[]} [axis=[0,1,0]] 
 * @param {number} [offset=1] 
 * @param {number} [speed=0.6]
 * @param {number} [damage=8]
 * @param {number} [color=-1] DanmakuColors
 * @param {number} [total_tick=5] 发射全部弹幕的总时长
 */
export function fanShapedShot_delay(dimension, location, source_location, target_location, source_id, type, yawTotal = Math.PI / 3, fanNum=8, axis=[0,1,0], offset=1, speed=0.6, damage=8, color=DanmakuColors.RANDOM, total_tick=5){
    // yawTotal < 0 || yawTotal > MAX_YAW || fanNum < MIN_FAN_NUM
    let v = [target_location.x - source_location.x, target_location.y - source_location.y - offset, target_location.z - source_location.z];
    v = Vec.getVector_speed_direction(speed, v);

    let yaw = -(yawTotal / 2);
    let addYaw = yawTotal / (fanNum - 1);
    let aixs_norm = Vec.normalize(axis);

    for (let i = 1; i <= fanNum; i++) {
        let v1 = Vec.rotate_axis(v, aixs_norm, yaw);
        yaw = yaw + addYaw;
        shootDanmaku(dimension, location, new Vector(v1[0], v1[1], v1[2]), source_id, type, damage, color)
    }
}