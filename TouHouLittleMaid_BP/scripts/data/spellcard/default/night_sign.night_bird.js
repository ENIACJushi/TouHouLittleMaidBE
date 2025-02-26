import { Dimension, Entity, system } from "@minecraft/server";
import { Vector, VectorMC } from "../../../src/libs/VectorMC";
import { DanmakuColor as Color } from "../../../src/danmaku/DanmakuColor";
import { DanmakuType as Type } from "../../../src/danmaku/DanmakuType";
import { EntityDanmaku as Danmaku } from "../../../src/danmaku/EntityDanmaku";
import * as Tool from "../../../src/libs/ScarletToolKit";
// 夜符「Night Bird」
export const SpellCard = {
    // 释放该符卡的物品id，必须以thlms为开头
    id: "thlms:night_sign.night_bird",
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
        for (var i = 0; i < 1; i++) {
            // 第 1，3 次左侧扇形弹幕
            system.runTimeout(() => {
                for (var j = 0; j < 16; j++) {
                    for (var k = 0; k < 3; k++) {
                        var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset(new Vector(0, 0.8, 0))
                            .setDanmakuType(Type.ORBS).setColor(Color.PURPLE);
                        let direction = VectorMC.rotate_axis(new Vector(0, 0, 1), new Vector(0, -1, 0), Tool.angle2raduis(entity.getRotation().y + 90.0 - 135.0 / 16.0 * j - 3));
                        danmaku.shoot(direction, 0.04 + 0.04 * Math.pow(1.09, 15 - j + k * 5), 0);
                    }
                }
            }, i * 60);
            // 第 1，3 次右侧扇形弹幕
            system.runTimeout(() => {
                for (var j = 0; j < 16; j++) {
                    for (var k = 0; k < 3; k++) {
                        var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset(new Vector(0, 0.8, 0))
                            .setDanmakuType(Type.ORBS).setColor(Color.CYAN);
                        let direction = VectorMC.rotate_axis(new Vector(0, 0, 1), new Vector(0, -1, 0), Tool.angle2raduis(entity.getRotation().y - 90.0 + 135.0 / 16.0 * j));
                        danmaku.shoot(direction, 0.04 + 0.04 * Math.pow(1.09, 15 - j + k * 5), 0);
                    }
                }
            }, i * 60 + 15);
            // 第 2，4 次左侧扇形弹幕
            system.runTimeout(() => {
                for (var j = 0; j < 16; j++) {
                    for (var k = 0; k < 3; k++) {
                        var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset(new Vector(0, 0.8, 0))
                            .setDanmakuType(Type.ORBS).setColor(Color.PURPLE);
                        let direction = VectorMC.rotate_axis(new Vector(0, 0, 1), new Vector(0, -1, 0), Tool.angle2raduis(entity.getRotation().y + 90.0 - 135.0 / 16.0 * j - 2));
                        danmaku.shoot(direction, 0.04 + 0.04 * Math.pow(1.09, 15 - j + k * 5), 0);
                    }
                }
            }, i * 60 + 30);
            // 第 2，4 次右侧扇形弹幕
            system.runTimeout(() => {
                for (var j = 0; j < 16; j++) {
                    for (var k = 0; k < 3; k++) {
                        var danmaku = new Danmaku(world, entity).setDamage(2).setThrowerOffset(new Vector(0, 0.8, 0))
                            .setDanmakuType(Type.ORBS).setColor(Color.CYAN);
                        let direction = VectorMC.rotate_axis(new Vector(0, 0, 1), new Vector(0, -1, 0), Tool.angle2raduis(entity.getRotation().y - 90.0 + 135.0 / 16.0 * j - 1));
                        danmaku.shoot(direction, 0.04 + 0.04 * Math.pow(1.09, 15 - j + k * 5), 0);
                    }
                }
            }, i * 60 + 45);
        }
    }
};
//# sourceMappingURL=night_sign.night_bird.js.map