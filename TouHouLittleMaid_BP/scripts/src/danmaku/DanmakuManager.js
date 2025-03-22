import { world, system } from "@minecraft/server";
import { BulletShoot } from "./shoots/BulletShoot";
import { DanmakuInterface } from "./DanmakuInterface";
import { Vector, VectorMC } from "../libs/VectorMC";
import { GeneralBullet } from "./shapes/main";
import { EntityDanmakuActor } from "./actors/EntityDanmakuActor";
import { FanShapedPattern } from "./patterns/Fan";
import { FairyPatternTest0 } from "./patterns/fairy_test/FairyPatternTest0";
import { FairyPatternTest5 } from "./patterns/fairy_test/FairyPatternTest5";
import { FairyPatternTest1 } from "./patterns/fairy_test/FairyPatternTest1";
import { FairyPatternTest3 } from "./patterns/fairy_test/FairyPatternTest3";
import { FairyPatternTest2 } from "./patterns/fairy_test/FairyPatternTest2";
import { FairyPatternTest4 } from "./patterns/fairy_test/FairyPatternTest4";
import { FairyPatternTest6 } from "./patterns/fairy_test/FairyPatternTest6";
import { FairyPatternTest7 } from "./patterns/fairy_test/FairyPatternTest7";
// 记录正在删除的弹幕
let despawningDanmaku = new Map();
/**
 * 弹幕击中实体
 * @param ev
 */
export function danmakuHitEntityEvent(ev) {
    // TODO: 为什么这里要延迟？能不能删？
    system.runTimeout(() => {
        // 收集信息
        var danmaku = ev.projectile;
        if (danmaku === undefined || despawningDanmaku.get(danmaku.id))
            return;
        var hit_info = ev.getEntityHit();
        if (hit_info === undefined) {
            return;
        }
        // Tool.logger(`${danmaku.location.x}, ${danmaku.location.y}, ${danmaku.location.z}`)
        // 施加伤害
        if (!hit_info.entity || !DanmakuInterface.applyDamage(ev.source, danmaku, hit_info.entity)) {
            return;
        }
        // 计算穿透次数
        let piercing = danmaku.getDynamicProperty("piercing");
        if (piercing === undefined || piercing <= 1) {
            // 销毁弹幕
            danmaku.triggerEvent("despawn");
            var id = danmaku.id;
            despawningDanmaku.set(id, true);
            system.runTimeout(() => {
                despawningDanmaku.delete(id);
            }, 2);
            // 销毁子弹幕
            let forks = DanmakuInterface.getForks(danmaku.id);
            if (forks !== undefined) {
                for (let id of forks) {
                    let forkDanmaku = world.getEntity(id);
                    if (forkDanmaku !== undefined) {
                        forkDanmaku.triggerEvent("despawn");
                        despawningDanmaku.set(id, true);
                        system.runTimeout(() => {
                            despawningDanmaku.delete(id);
                        }, 4);
                    }
                }
                DanmakuInterface.clearForks(danmaku.id);
            }
        }
        else {
            piercing--;
            danmaku.setDynamicProperty("piercing", piercing);
        }
    }, 1);
}
/**
 * 弹幕击中方块
 * @param {ProjectileHitBlockAfterEvent} ev
 */
export function danmakuHitBlockEvent(ev) {
    let projectile = ev.projectile;
    if (despawningDanmaku.get(projectile.id)) {
        return;
    }
    // 销毁弹幕
    var id = projectile.id;
    despawningDanmaku.set(id, true);
    projectile.triggerEvent("despawn");
    system.runTimeout(() => {
        despawningDanmaku.delete(id);
    }, 4);
    // 销毁子弹幕
    let forks = DanmakuInterface.getForks(projectile.id);
    if (forks !== undefined) {
        for (let id of forks) {
            let forkDanmaku = world.getEntity(id);
            if (forkDanmaku !== undefined) {
                forkDanmaku.triggerEvent("despawn");
                despawningDanmaku.set(id, true);
                system.runTimeout(() => {
                    despawningDanmaku.delete(id);
                }, 4);
            }
        }
        DanmakuInterface.clearForks(projectile.id);
    }
    return;
}
//////// Entity ////////
const AIMED_SHOT_PROBABILITY = 0.8; //java 0.9
/**
 * 妖精女仆攻击
 * @param {Entity} fairy
 */
export function fairy_shoot(fairy) {
    if (fairy === undefined)
        return;
    let target = fairy.target;
    if (target !== undefined) {
        let distance = VectorMC.length({
            x: fairy.location.x - target.location.x,
            y: fairy.location.y - target.location.y,
            z: fairy.location.z - target.location.z
        });
        let distanceFactor = distance / 8;
        let speed = 0.3 * (distanceFactor + 1);
        // 我们在 MC 加入了预瞄桂
        if (Math.random() <= AIMED_SHOT_PROBABILITY) {
            new BulletShoot({
                shape: new GeneralBullet().setRandomColor().setRandomType().setDamage(distanceFactor + 1),
                thrower: new EntityDanmakuActor(fairy, true),
                target: new EntityDanmakuActor(target, true).setOffset(new Vector(0, -0.4, 0)),
                preJudge: true,
            }).shootByTarget(speed, 0.05);
        }
        else {
            let shoot = new BulletShoot({
                shape: new GeneralBullet().setRandomColor().setRandomType().setDamage(distanceFactor + 1.5),
                thrower: new EntityDanmakuActor(fairy, true),
                target: new EntityDanmakuActor(target, true).setOffset(new Vector(0, -0.4, 0)),
                preJudge: true,
            });
            new FanShapedPattern(shoot).shootByTarget({
                fanNum: 3,
                yawTotal: Math.PI / 6,
                axisRotation: 0,
                directionRotation: 0,
            }, speed, 0.02);
        }
    }
}
/**
 * 测试妖精女仆攻击
 * @param {Entity} entity
 */
export function debug_shoot(entity) {
    let type = -1;
    if (entity.nameTag && entity.nameTag.substring(0, 10) == "thlm:debug") {
        type = parseInt(entity.nameTag.substring(10));
    }
    // 预瞄测试不需要目标
    if (type === 5) {
        new FairyPatternTest5().shoot(entity);
    }
    let target = entity.target;
    if (!target) {
        return;
    }
    switch (type) {
        case 0:
            new FairyPatternTest0().shoot(entity, target);
            break;
        case 1:
            new FairyPatternTest1().shoot(entity, target);
            break;
        case 2:
            new FairyPatternTest2().shoot(entity, target);
            break;
        case 3:
            new FairyPatternTest3().shoot(entity, target);
            break;
        case 4:
            new FairyPatternTest4().shoot(entity);
            break;
        case 5: break;
        case 6:
            new FairyPatternTest6().shoot(entity, target);
            break;
        case 7:
            new FairyPatternTest7().shoot(entity, target);
            break;
        default:
            // 默认弹幕（妖精女仆）
            fairy_shoot(entity);
            break;
    }
}
//# sourceMappingURL=DanmakuManager.js.map