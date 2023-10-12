import { Dimension, Entity, Vector, system } from "@minecraft/server";
import { Vector as Vec3d } from "@minecraft/server";
import { DanmakuColor as Color } from "../../../src/danmaku/DanmakuColor";
import { DanmakuType as Type } from "../../../src/danmaku/DanmakuType";
import { EntityDanmaku as Danmaku } from "../../../src/danmaku/EntityDanmaku";
import { rotate_axis, add } from "../../../src/libs/vector3d";
import * as Tool from "../../../src/libs/scarletToolKit"

/**
 * entity.getRotation()获取 [-180, 180]，对应(-180~180)的角度
 */


/**
 * 
 * @param {float} x 
 * @param {float} y 
 * @param {float} z 
 * @param {float} yawIn 
 * @param {float} yOffset 
 * @param {Entity} entity
 */
function getRotationVector(x, y, z, yawIn, yOffset, entity){
    let yaw = (entity.getRotation().y + yawIn) * -0.01745329251;// PI/180
    let pos = entity.location;

    let vec3d = [x, y, z]
    vec3d = rotate_axis(vec3d, [0,1,0], yaw);
    vec3d = add(vec3d, [pos.x, pos.y + 1 + yOffset, pos.z]);
    
    return vec3d;
}

export const SpellCard = {
    // 符卡的 id，字符串，必需参数
    // 推荐格式：资源域:X符.符卡名
    id: "thlms:magic_sign.milky_way",
    // 作者，字符串
    author: "tartaric_acid",
    // 版本，字符串
    version: "1.0.0",
    // 冷却时间，整型数
    cooldown: 250,
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
                    
                    var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset([0,0.8,0]).
                        setDanmakuType(Type.BIG_STAR).setColor(Color.RED);
                    if ($times % 2 == 1) {
                        danmaku.setColor(Color.BLUE);
                    }
                    let direction = rotate_axis([0,0,1], [0,-1,0], Tool.angle2raduis(- 5 * $times + 40 * j));// 旋转弹幕感觉没必要跟着转 Tool.angle2raduis(entity.getRotation().y - 5 * $times + 40 * j)
                    danmaku.shoot(direction[0], direction[1], direction[2], 0.7, 0);
                }
            }
            var shoot = function($times){return function () {shoot_basic($times);}};
            system.runTimeout(shoot(i), 5 * i);
        }

        // 一段时间后的斜向弹幕
        for (i = 0; i < 20; i++) {
            system.runTimeout(()=>{
                for (var j = 0; j < 5; j++) {
                    var pos = getRotationVector(-15, 0, Math.random() * 30 - 10, 0, -0.1, entity);
                    
                    var danmaku = new Danmaku(world, entity).setDamage(2)
                        .setDanmakuType(Type.STAR).setColor(Color.YELLOW);
                    danmaku.setThrowerLocation(pos);
                    let direction = rotate_axis([0,0,1], [0,-1,0], Tool.angle2raduis(entity.getRotation().y - 60));
                    danmaku.shoot(direction[0], direction[1], direction[2], 0.3, 0);
                }
            }, 10 * i + 50);

            system.runTimeout(()=>{
                for (var j = 0; j < 5; j++) {
                    var pos = getRotationVector(15, 0, Math.random() * 30 - 10, 0, -0.1, entity);

                    var danmaku = new Danmaku(world, entity).setDamage(2)
                        .setDanmakuType(Type.STAR).setColor(Color.GREEN);
                    danmaku.setThrowerLocation(pos);
                    let direction = rotate_axis([0,0,1], [0,-1,0], Tool.angle2raduis(entity.getRotation().y + 60));
                    danmaku.shoot(direction[0], direction[1], direction[2], 0.3, 0);
                }
            }, 10 * i + 50);
        }
    }
}