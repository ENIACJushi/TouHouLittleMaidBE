import { Dimension, Entity, system } from "@minecraft/server";
import { Vector as Vec3d } from "../../../src/libs/VectorMC";
import { DanmakuColor as Color } from "../../../src/danmaku/DanmakuColor";
import { DanmakuType as Type } from "../../../src/danmaku/DanmakuType";
import { EntityDanmaku as Danmaku } from "../../../src/danmaku/EntityDanmaku";
import { rotate_axis } from "../../../src/libs/vector3d";
import * as Tool from "../../../src/libs/ScarletToolKit"

// Java.asJSONCompatible 改为 export const SpellCard = 
export const SpellCard = {
    // 释放该符卡的物品id，必须以thlms为开头
    id: "thlms:border_sign.boundary_between_wave_and_particle",
    // 作者，字符串
    author: "tartaric_acid",
    // 版本，字符串
    version: "1.0.0",
    // 冷却时间，整型数
    cooldown: 250,
    /**
     * 执行的符卡逻辑，函数签名固定，会直接调用
     * @param {Dimension} world 当前所处的世界
     * @param {Entity} shooter 释放符卡的实体
     */
    spellCard: function (world, shooter) {
        for (var i = 0; i < 120; i++) {
            // Task.add 改为 system.runTimeout, 传值需要使用另外的方法
            // 传值给延时命令
            var shoot_basic = function($times){
                for (var j = 0; j < 9; j++) {
                    // 原初始化参数：世界 实体, damage, gravity, type, color，除了前两个均要另外设置
                    var danmaku = new Danmaku(shooter.dimension, shooter).setDamage(2)
                        .setDanmakuType(Type.PETAL).setColor(Color.MAGENTA).setThrowerLocation([
                            shooter.location.x, shooter.location.y+1, shooter.location.z
                        ])
                    
                    // 原发射参数 entityThrower, rotationPitchIn, rotationYawIn, pitchOffset, velocity, inaccuracy
                    // 旋转角设置
                    let direction = rotate_axis([0,0,1], [0,-1,0], Tool.angle2raduis(- 40 * j + 5 * Math.pow($times / 4, 2)))
                    // danmaku.setAxisRotation_direction();
                    danmaku.shoot(direction[0], direction[1], direction[2], 0.4, 0);
                    // world.spawnDanmaku(danmaku);
                }
            };
            var shoot = function($times){return function () {shoot_basic($times);}};
            system.runTimeout(shoot(i), 2 * i);
        }
    }
};
