import * as Tool from "../libs/ScarletToolKit";
import { EntityTypes, world, Entity, WorldInitializeAfterEvent, system, ProjectileHitEntityAfterEvent, ProjectileHitBlockAfterEvent } from "@minecraft/server";
import { DanmakuColor } from "./DanmakuColor";
import { DanmakuType } from "./DanmakuType";
import { EntityDanmaku } from "./EntityDanmaku";
import { DanmakuShoot } from "./DanmakuShoot";
import { config } from "../controller/Config";
import { GoheiCherry } from "../items/GoheiCherry";
import { DanmakuInterface } from "./DanmakuInterface";
import { Vector, VectorMC } from "../libs/VectorMC";
/**
 * 初始化动态属性
 * @param {WorldInitializeAfterEvent} e
 */
export function init_dynamic_properties(e) {
    // 弹幕属性
    {
        let def = new DynamicPropertiesDefinition();
        def.defineString("source", 15, "0"); // Entity id
        def.defineNumber("damage", config["danmaku_damage"]); // 伤害
        def.defineString("owner", 15); // 主人，女仆弹幕专用
        def.defineNumber("piercing", 1); // 穿透力  最多可以攻击一条线上的几个实体
        // 注册默认弹幕
        for (let i = 1; i <= DanmakuType.AMOUNT; i++) {
            e.propertyRegistry.registerEntityTypeDynamicProperties(def, EntityTypes.get(DanmakuType.getEntityName(i)));
        }
        // 注册自定义弹幕
        e.propertyRegistry.registerEntityTypeDynamicProperties(def, EntityTypes.get("thlmc:danmaku_custom_cherry"));
    }
}
// 记录正在删除的弹幕
var despawningDanmaku = {};
/**
 * 弹幕击中实体
 * @param {ProjectileHitEntityAfterEvent} ev
 */
export function danmakuHitEntityEvent(ev) {
    system.runTimeout(() => {
        // 收集信息
        var danmaku = ev.projectile;
        if (danmaku === undefined || despawningDanmaku[danmaku.id])
            return;
        var hit_info = ev.getEntityHit();
        if (hit_info === undefined)
            return;
        // Tool.logger(`${danmaku.location.x}, ${danmaku.location.y}, ${danmaku.location.z}`)
        // 施加伤害
        if (!DanmakuInterface.applyDamage(ev.source, danmaku, hit_info.entity))
            return;
        // 计算穿透次数
        let piercing = danmaku.getDynamicProperty("piercing");
        if (piercing === undefined || piercing <= 1) {
            // 销毁弹幕
            danmaku.triggerEvent("despawn");
            var id = danmaku.id;
            despawningDanmaku[id] = true;
            system.runTimeout(() => { delete despawningDanmaku[id]; }, 2);
            // 销毁子弹幕
            let forks = DanmakuInterface.getForks(danmaku.id);
            if (forks !== undefined) {
                for (let id of forks) {
                    let forkDanmaku = world.getEntity(id);
                    if (forkDanmaku !== undefined) {
                        forkDanmaku.triggerEvent("despawn");
                        despawningDanmaku[id] = true;
                        system.runTimeout(() => { delete despawningDanmaku[id]; }, 4);
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
    if (despawningDanmaku[projectile.id])
        return;
    // 销毁弹幕
    var id = projectile.id;
    despawningDanmaku[id] = true;
    projectile.triggerEvent("despawn");
    system.runTimeout(() => { delete despawningDanmaku[id]; }, 4);
    // 销毁子弹幕
    let forks = DanmakuInterface.getForks(projectile.id);
    if (forks !== undefined) {
        for (let id of forks) {
            let forkDanmaku = world.getEntity(id);
            if (forkDanmaku !== undefined) {
                forkDanmaku.triggerEvent("despawn");
                despawningDanmaku[id] = true;
                system.runTimeout(() => { delete despawningDanmaku[id]; }, 4);
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
    if (target != undefined) {
        let distance = VectorMC.length({
            x: fairy.location.x - fairy.target.location.x,
            y: fairy.location.y - fairy.target.location.y,
            z: fairy.location.z - fairy.target.location.z
        });
        let distanceFactor = distance / 8;
        let speed = 0.3 * (distanceFactor + 1);
        // 我们在 MC 加入了预瞄桂
        if (Math.random() <= AIMED_SHOT_PROBABILITY) {
            DanmakuShoot.create().setWorld(fairy.dimension).setThrower(fairy).setThrowerOffSet(new Vector(0, 1, 0))
                .setTargetOffSet(new Vector(0, 1, 0)).setTarget(fairy.target).setRandomColor().setRandomType()
                .setDamage((distanceFactor + 1)).setGravity(0)
                .setVelocity(speed).enablePreJudge()
                .setInaccuracy(0.05).aimedShot();
        }
        else {
            DanmakuShoot.create().setWorld(fairy.dimension).setThrower(fairy).setThrowerOffSet(new Vector(0, 1, 0))
                .setTargetOffSet(new Vector(0, 1, 0)).setTarget(fairy.target).setRandomColor().setRandomType()
                .setDamage(distanceFactor + 1.5).setGravity(0)
                .setVelocity(speed).enablePreJudge()
                .setInaccuracy(0.02).setFanNum(3).setYawTotal(Math.PI / 6)
                .fanShapedShot();
        }
    }
}
var laserRadius = 0;
var laserStep = 0.1;
var laserIsShooting = false;
/**
 * 测试妖精女仆攻击
 * @param {Entity} entity
 */
export function debug_shoot(entity) {
    let type = -1;
    if (entity.nameTag && entity.nameTag.substring(0, 10) == "thlm:debug") {
        type = parseInt(entity.nameTag.substring(10));
    }
    if (type === 5) { // 预判测试
        let shoot = DanmakuShoot.create().setWorld(entity.dimension)
            .setThrower(entity).setThrowerOffSet(new Vector(0, 1, 0)).setTargetOffSet(new Vector(0, 1, 0))
            .setColor(DanmakuColor.RANDOM).setType(DanmakuType.GLOWEY_BALL)
            .setDamage(1).setGravity(0).enablePreJudge().enableVerticlePreJudge();
        let target = entity.dimension.getPlayers({ "closest": 1, "location": entity.location, "name": "Voyage1976" })[0];
        const n = 18;
        let step = 65 / n;
        for (let i = 0; i < n; i++) {
            system.runTimeout(() => {
                let target = entity.dimension.getEntities({ "closest": 1, "location": entity.location, "families": ["phantom"] })[0];
                if (target === undefined)
                    return;
                let distance = VectorMC.length({
                    x: entity.location.x - target.location.x,
                    y: entity.location.y - target.location.y,
                    z: entity.location.z - target.location.z
                });
                let distanceFactor = distance / 6;
                let speed = 0.5 * (distanceFactor + 1);
                entity.teleport(entity.location, { "facingLocation": target.location });
                shoot.setTarget(target).setVelocity(speed).aimedShot();
            }, step * i);
        }
        return;
    }
    let target = entity.target;
    if (target != undefined) {
        switch (type) {
            case 0:
                { // 米字弹幕
                    let fanDanmaku = DanmakuShoot.create().setWorld(entity.dimension)
                        .setThrower(entity).setTarget(target).setThrowerOffSet(new Vector(0, 1, 0)).setTargetOffSet(new Vector(0, 1, 0))
                        .setRandomColor().setType(DanmakuType.BALL).setDamage(6).setGravity(0)
                        .setVelocity(1).setInaccuracy(0)
                        .setFanNum(17).setYawTotal(Math.PI / 4);
                    fanDanmaku.fanShapedShot();
                    let yaw = Math.PI / 8;
                    for (let i = -4; i < 4; i++) {
                        fanDanmaku.setAxisRotation_axis(i * yaw).fanShapedShot();
                    }
                }
                ;
                break;
            case 1:
                { // 带sigma的自机狙
                    var aimDanmakuShoot = DanmakuShoot.create().setWorld(entity.dimension)
                        .setThrower(entity).setTarget(target).setThrowerOffSet(new Vector(0, 1, 0)).setTargetOffSet(new Vector(0, 1, 0))
                        .setColor(DanmakuColor.random()).setType(DanmakuType.BALL)
                        .setDamage(6).setGravity(0)
                        .setVelocity(0.6).setInaccuracy(Math.PI / 30);
                    for (let i = 0; i < 40; i++) {
                        system.runTimeout(() => {
                            aimDanmakuShoot.aimedShot();
                        }, i + 10);
                    }
                }
                ;
                break;
            case 2:
                { // 多层弹幕
                    let fanDanmaku = DanmakuShoot.create().setWorld(entity.dimension)
                        .setThrower(entity).setTarget(target).setThrowerOffSet(new Vector(0, 1, 0)).setTargetOffSet(new Vector(0, 1, 0))
                        .setRandomColor().setType(DanmakuType.BALL).setDamage(6).setGravity(0)
                        .setVelocity(0.6).setInaccuracy(0)
                        .setFanNum(17).setYawTotal(Math.PI / 4);
                    fanDanmaku.fanShapedShot();
                    let yaw = Math.PI / 16;
                    for (let i = -4; i < 4; i++) {
                        fanDanmaku.setAxisRotation_direction(i * yaw).fanShapedShot();
                    }
                }
                break;
            case 3:
                { // 带sigma的自机狙（星型）
                    var aimDanmakuShoot_small = DanmakuShoot.create().setWorld(entity.dimension)
                        .setThrower(entity).setTarget(target).setThrowerOffSet(new Vector(0, 1, 0)).setTargetOffSet(new Vector(0, 1, 0))
                        .setColor(DanmakuColor.RANDOM).setType(DanmakuType.STAR)
                        .setDamage(6).setGravity(0)
                        .setVelocity(0.8).setInaccuracy(Math.PI / 7);
                    var aimDanmakuShoot_big = DanmakuShoot.create().setWorld(entity.dimension)
                        .setThrower(entity).setTarget(target).setThrowerOffSet(new Vector(0, 1, 0)).setTargetOffSet(new Vector(0, 1, 0))
                        .setColor(DanmakuColor.RANDOM).setType(DanmakuType.BIG_STAR)
                        .setDamage(6).setGravity(0)
                        .setVelocity(0.6).setInaccuracy(Math.PI / 15);
                    for (let i = 0; i < 20; i++) {
                        system.runTimeout(() => {
                            aimDanmakuShoot_small.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                            aimDanmakuShoot_small.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                            aimDanmakuShoot_small.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                            aimDanmakuShoot_big.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                            aimDanmakuShoot_big.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                        }, i + 10);
                    }
                }
                break;
            case 4:
                { // 樱花束
                    GoheiCherry.shoot(entity, undefined);
                    for (let i2 = 0; i2 < 0; i2++) {
                        system.runTimeout(() => {
                            for (let i = 0; i < 5; i++) {
                                GoheiCherry.shoot(entity, undefined);
                            }
                        }, i2);
                    }
                }
                ;
                break;
            case 5: break; // 预判测试
            case 6:
                { // 激光 伪
                    var danmakuShoot = DanmakuShoot.create().setWorld(entity.dimension)
                        .setThrower(entity).setTarget(target).setThrowerOffSet(new Vector(0, 1, 0)).setTargetOffSet(new Vector(0, 1, 0))
                        .setColor(DanmakuColor.RED).setType(DanmakuType.GLOWEY_BALL)
                        .setDamage(0).setGravity(0)
                        .setVelocity(0.1);
                    for (let i2 = 0; i2 < 80; i2++) {
                        system.runTimeout(() => {
                            danmakuShoot.aimedShot();
                            danmakuShoot.aimedShot();
                        }, i2);
                    }
                }
                ;
                break;
            case 7:
                { // 曲线激光 伪
                    if (laserIsShooting)
                        return;
                    laserIsShooting = true;
                    let danmaku = new EntityDanmaku(entity.dimension, entity)
                        .setDamage(1).setGravityVelocity(0.2).setThrowerOffset(new Vector(0, 1, 0))
                        .setDanmakuType(DanmakuType.GLOWEY_BALL).setColor(DanmakuColor.RED);
                    let direction = entity.getViewDirection();
                    let axis = VectorMC.getAnyVerticalVector(direction).normalized();
                    var shootNext = function () {
                        system.runTimeout(() => {
                            if (laserRadius > 60 || laserRadius < -60) {
                                laserStep = -laserStep;
                            }
                            laserRadius += laserStep;
                            let direction_shoot = VectorMC.rotate_axis(direction, axis, laserRadius * Math.PI / 180);
                            danmaku.shoot(direction_shoot.x, direction_shoot.y, direction_shoot.z, 0.1);
                            shootNext();
                        }, 1);
                    };
                    shootNext();
                }
                ;
                break;
            default:
                // 默认弹幕（妖精女仆）
                fairy_shoot(entity);
                break;
        }
    }
}
//# sourceMappingURL=DanmakuManager.js.map