import { Dimension, Entity, system } from "@minecraft/server";
import { Vector, VectorMC } from "../../../src/libs/VectorMC";
import { DanmakuColor as Color } from "../../../src/danmaku/DanmakuColor";
import { DanmakuType as Type } from "../../../src/danmaku/DanmakuType";
import { EntityDanmaku as Danmaku } from "../../../src/danmaku/EntityDanmaku";
import { getRotationVector } from "../../../src/danmaku/scirpt/Functions";
import * as Tool from "../../../src/libs/ScarletToolKit";
// 金符「Metal Fatigue」
export const SpellCard = {
    // 释放该符卡的物品id，必须以thlms为开头
    id: "thlms:metal_sign.metal_fatigue",
    // 作者，字符串
    author: "tartaric_acid",
    // 版本，字符串
    version: "1.0.0",
    // 冷却时间，整型数
    cooldown: 170,
    /**
     * 执行的符卡逻辑，函数签名固定，会直接调用
     * @param {Dimension} world 当前所处的世界
     * @param {Entity} entity 释放符卡的实体
     */
    spellCard: function (world, entity) {
        // 第一波角度和后面不一致
        for (var j = 0; j < 8; j++) {
            var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset(new Vector(0, 0.8, 0))
                .setDanmakuType(Type.BIG_BALL).setColor(Color.YELLOW);
            let direction = VectorMC.rotate_axis(new Vector(0, 0, 1), new Vector(0, -1, 0), Tool.angle2raduis(entity.getRotation().y + 15 + 45 * j));
            danmaku.setLifeTime(31);
            danmaku.shoot(direction, 0.2, 0);
        }
        system.runTimeout(() => {
            for (var i = 0; i < 8; i++) {
                for (var j = 0; j < 8; j++) {
                    var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset(new Vector(0, 0.8, 0))
                        .setDanmakuType(Type.BIG_BALL).setColor(Color.YELLOW);
                    var pos = getRotationVector(new Vector(0, 0, 5.6), 15 + 45 * i, -0.1, entity);
                    danmaku.setThrowerLocation(pos);
                    let direction = VectorMC.rotate_axis(new Vector(0, 0, 1), new Vector(0, -1, 0), Tool.angle2raduis(entity.getRotation().y + 45 * j));
                    danmaku.shoot(direction, 0.2, 0);
                }
            }
        }, 30);
        // 后面来上 5 波即可，此时角度是固定的
        for (var k = 0; k < 5; k++) {
            system.runTimeout(() => {
                for (var j = 0; j < 8; j++) {
                    var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset(new Vector(0, 0.8, 0))
                        .setDanmakuType(Type.BIG_BALL).setColor(Color.YELLOW);
                    let direction = VectorMC.rotate_axis(new Vector(0, 0, 1), new Vector(0, -1, 0), Tool.angle2raduis(entity.getRotation().y + 30 + 45 * j));
                    danmaku.setLifeTime(31);
                    danmaku.shoot(direction, 0.2, 0);
                }
            }, 20 * (k + 1));
            system.runTimeout(() => {
                for (var i = 0; i < 8; i++) {
                    for (var j = 0; j < 8; j++) {
                        var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset(new Vector(0, 0.8, 0))
                            .setDanmakuType(Type.BIG_BALL).setColor(Color.YELLOW);
                        var pos = getRotationVector(new Vector(0, 0, 5.6), 30 + 45 * i, -0.1, entity);
                        danmaku.setThrowerLocation(pos);
                        let direction = VectorMC.rotate_axis(new Vector(0, 0, 1), new Vector(0, -1, 0), Tool.angle2raduis(entity.getRotation().y + 30 + 45 * j));
                        danmaku.shoot(direction, 0.2, 0);
                    }
                }
            }, 30 + 20 * (k + 1));
        }
    }
};
//# sourceMappingURL=metal_sign.metal_fatigue.js.map