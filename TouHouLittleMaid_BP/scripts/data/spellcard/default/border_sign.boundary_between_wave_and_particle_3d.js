import { Dimension, Entity, system } from "@minecraft/server";
import { Vector } from "../../../src/libs/VectorMC";
import { DanmakuColor as Color } from "../../../src/danmaku/DanmakuColor";
import { DanmakuType as Type } from "../../../src/danmaku/DanmakuType";
import { EntityDanmaku as Danmaku } from "../../../src/danmaku/EntityDanmaku";
import * as Tool from "../../../src/libs/ScarletToolKit";
function fibonacciSphere(radius, samples, rotation) {
    rotation += 1;
    var offset = 2.0 / samples;
    var increment = Math.PI * (3 - Math.sqrt(5));
    var points = [];
    for (var i = 0; i < samples; i++) {
        var y = ((i * offset) - 1) + (offset / 2);
        var r = Math.sqrt(1 - y * y) * radius;
        var phi = ((i + rotation) % samples) * increment;
        var x = Math.cos(phi) * r;
        var z = Math.sin(phi) * r;
        points.push(new Vector(x, y * radius, z));
    }
    return points;
}
function shoot($d, danmaku) {
    return function () {
        shoot_basic($d, danmaku);
    };
}
function shoot_basic($d, danmaku) {
    fibonacciSphere(0.2, 50, $d / 100).forEach(function (v) {
        danmaku.shoot_bedrock(v, 0);
    });
}
export const SpellCard = {
    id: "thlms:boundary_between_wave_and_particle_3d",
    author: "snownee",
    version: "1.0.0",
    cooldown: 150,
    /**
     * 执行的符卡逻辑，函数签名固定，会直接调用
     * @param {Dimension} world 当前所处的世界
     * @param {Entity} shooter 释放符卡的实体
     */
    spellCard: function (world, shooter) {
        // var pos = new Vector(shooter.location.x, shooter.location.y + 1, shooter.location.z);
        var d = 0.0;
        // danmaku.setMotion(v);
        // danmaku.setPosition(pos);
        // danmaku.setLifeTime(100);
        var danmaku = new Danmaku(world, shooter).setDamage(2).
            setDanmakuType(Type.PELLET).setColor(Color.MAGENTA).
            setThrowerLocation(new Vector(shooter.location.x, shooter.location.y + 1, shooter.location.z));
        for (var i = 0; i < 30; i++) {
            d += i;
            system.runTimeout(shoot(d, danmaku), 4 * i);
        }
    }
};
//# sourceMappingURL=border_sign.boundary_between_wave_and_particle_3d.js.map