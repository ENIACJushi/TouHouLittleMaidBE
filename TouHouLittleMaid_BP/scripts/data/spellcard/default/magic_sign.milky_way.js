import { Dimension, Entity, system } from "@minecraft/server";
import { Vector, VectorMC } from "../../../src/libs/VectorMC";
import { DanmakuColor as Color } from "../../../src/danmaku/DanmakuColor";
import { DanmakuType as Type } from "../../../src/danmaku/DanmakuType";
import { EntityDanmaku as Danmaku } from "../../../src/danmaku/EntityDanmaku";
import * as Tool from "../../../src/libs/ScarletToolKit"

/**
 * entity.getRotation()获取 [-180, 180]，对应(-180~180)的角度
 */


/**
 * 
 * @param {Vector} vec3d
 * @param {float} yawIn 
 * @param {float} yOffset 
 * @param {Entity} entity
 * @returns {Vector}
 */
export function getRotationVector(vec3d, yawIn, yOffset, entity){
    let yaw = (entity.getRotation().y + yawIn) * -0.01745329251;// PI/180
    let pos = entity.location;

    let result = VectorMC.rotate_axis(vec3d, new Vector(0, 1, 0), yaw);
    result = VectorMC.add(result, new Vector(pos.x, pos.y + 1 + yOffset, pos.z));
    
    return result;
}

export const SpellCard = {
    // 释放该符卡的物品id，必须以thlms为开头
    id: "thlms:magic_sign.milky_way",
    /**
     * 执行的符卡逻辑，函数签名固定，会直接调用
     * @param {Dimension} world 当前所处的世界
     * @param {Entity} entity 释放符卡的实体
     */
    spellCard: function (world, entity) {
        // 中心散发的大星弹
        for (var i = 0; i < 50; i++) {
            var shoot_basic = function($times){
                for (var j = 0; j < 9; j++) {
                    
                    var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset(new Vector(0, 0.8, 0)).
                        setDanmakuType(Type.BIG_STAR).setColor(Color.RED);
                    if ($times % 2 == 1) {
                        danmaku.setColor(Color.BLUE);
                    }
                    let direction = VectorMC.rotate_axis(new Vector(0,0,1), new Vector(0,-1,0), Tool.angle2raduis(- 5 * $times + 40 * j));// 旋转弹幕感觉没必要跟着转 Tool.angle2raduis(entity.getRotation().y - 5 * $times + 40 * j)
                    danmaku.shoot(direction, 0.7, 0);
                }
            }
            var shoot = function($times){return function () {shoot_basic($times);}};
            system.runTimeout(shoot(i), 5 * i);
        }

        // 一段时间后的斜向弹幕
        for (i = 0; i < 20; i++) {
            system.runTimeout(()=>{
                for (var j = 0; j < 5; j++) {
                    var pos = getRotationVector(new Vector(-15, 0, Math.random() * 30 - 10), 0, -0.1, entity);
                    
                    var danmaku = new Danmaku(world, entity).setDamage(2)
                        .setDanmakuType(Type.STAR).setColor(Color.YELLOW);
                    danmaku.setThrowerLocation(pos);
                    let direction = VectorMC.rotate_axis(new Vector(0,0,1), new Vector(0,-1,0), Tool.angle2raduis(entity.getRotation().y - 60));
                    danmaku.shoot(direction, 0.3, 0);
                }
            }, 10 * i + 50);

            system.runTimeout(()=>{
                for (var j = 0; j < 5; j++) {
                    var pos = getRotationVector(new Vector(15, 0, Math.random() * 30 - 10), 0, -0.1, entity);

                    var danmaku = new Danmaku(world, entity).setDamage(2)
                        .setDanmakuType(Type.STAR).setColor(Color.GREEN);
                    danmaku.setThrowerLocation(pos);
                    let direction = VectorMC.rotate_axis(new Vector(0,0,1), new Vector(0,-1,0), Tool.angle2raduis(entity.getRotation().y + 60));
                    danmaku.shoot(direction, 0.3, 0);
                }
            }, 10 * i + 50);
        }
    }
}