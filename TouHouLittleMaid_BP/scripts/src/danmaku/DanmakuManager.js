
import * as Tool from "../libs/scarletToolKit"
import * as Vec from "../libs/vector3d"
import { ItemDefinitionTriggeredBeforeEvent, ItemStack, Enchantment, EntityTypes, ItemUseOnBeforeEvent,
    DynamicPropertiesDefinition, world, Entity, Vector, Dimension, DataDrivenEntityTriggerAfterEvent, DataDrivenEntityTriggerBeforeEvent, WorldInitializeAfterEvent, system
    ,EntityDamageCause, 
    ProjectileHitEntityAfterEvent,
    ProjectileHitBlockAfterEventSignal,
    ProjectileHitBlockAfterEvent} from "@minecraft/server";

import {DanmakuColor}  from "./DanmakuColor";
import {DanmakuType}   from "./DanmakuType";
import {EntityDanmaku} from "./EntityDanmaku";
import {DanmakuShoot}  from "./DanmakuShoot";
import { EntityMaid } from "../maid/EntityMaid";
import { config } from "../controller/Config";
import { GoheiCherry } from "./item/GoheiCherry";
import { DanmakuInterface } from "./DanmakuInterface";

/**
 * 初始化动态属性
 * @param {WorldInitializeAfterEvent} e 
 */
export function init_dynamic_properties(e){
    // 弹幕属性
    {
        let def = new DynamicPropertiesDefinition();
        def.defineString("source", 15, "0"); // Entity id
        def.defineNumber("damage", config["danmaku_damage"] ); // 伤害
        def.defineString("owner" , 15); // 主人，女仆弹幕专用
        def.defineNumber("piercing", 1);// 穿透力  最多可以攻击一条线上的几个实体
    
        // 注册默认弹幕
        for(let i=1; i<=DanmakuType.AMOUNT; i++){
            e.propertyRegistry.registerEntityTypeDynamicProperties(def, EntityTypes.get(DanmakuType.getEntityName(i)));
        }
        // 注册自定义弹幕
        e.propertyRegistry.registerEntityTypeDynamicProperties(def, EntityTypes.get("thlmc:danmaku_custom_cherry"));
        
    }
    
}

/**
 * 弹幕击中处理(在1.6.0-beta被拆分为两个事件)
 * @param {ProjectileHitAfterEvent} ev 
 * @returns 
 */
function danmakuHitEvent(ev){
    let projectile = ev.projectile;
    // Hit block
    if(ev.getBlockHit() != undefined){
        projectile.triggerEvent("despawn");
        return;
    }
    // Hit entity
    let hit_info = ev.getEntityHit()
    if(hit_info != null){
        // Get source entity by event or property
        // let damageOptions = {"damagingProjectile": projectile}; // 弹射物
        let damageOptions = {"cause" : EntityDamageCause.magic} // 魔法
        let source = ev.source;
        if(source == undefined){
            // 没有原版框架下的攻击实体，则通过动态属性寻找
            let id = projectile.getDynamicProperty("source");
            if(id != "0"){
                source =  world.getEntity(id);
            }
        }
        if(source != undefined) damageOptions["damagingEntity"] = source;
        // Do not hit source
        if(hit_info.entity.id == source.id){
            return;
        }
        // Hit other entities
        else{
            hit_info.entity.applyDamage(projectile.getDynamicProperty("damage"), damageOptions);
            projectile.triggerEvent("despawn");
        }
    }
}

// 记录正在删除的弹幕
var despawningDanmaku = {

}
/**
 * 弹幕击中实体
 * @param {ProjectileHitEntityAfterEvent} ev 
 */
export function danmakuHitEntityEvent(ev){
    system.runTimeout(()=>{
        // 收集信息
        var danmaku = ev.projectile;
        if(danmaku===undefined || despawningDanmaku[danmaku.id]) return;
        var hit_info = ev.getEntityHit()
        if(hit_info === null) return;
        // Tool.logger(`${danmaku.location.x}, ${danmaku.location.y}, ${danmaku.location.z}`)
        // 施加伤害
        if(!DanmakuInterface.applyDamage(ev.source, danmaku, hit_info.entity))
            return;

        // 计算穿透次数
        let piercing = danmaku.getDynamicProperty("piercing");
        piercing--;
        if(piercing <= 0){
            // 销毁弹幕
            danmaku.triggerEvent("despawn");
            var id = danmaku.id;
            despawningDanmaku[id]=true;
            system.runTimeout(()=>{ delete despawningDanmaku[id] },2);

            // 销毁子弹幕
            let forks = DanmakuInterface.getForks(danmaku.id);
            if(forks !== undefined){
                for(let id of forks){
                    let forkDanmaku = world.getEntity(id);
                    if(forkDanmaku !== undefined){
                        forkDanmaku.triggerEvent("despawn");
                        despawningDanmaku[id]=true;
                        system.runTimeout(()=>{ delete despawningDanmaku[id]; },4);
                    }
                }
                DanmakuInterface.clearForks(danmaku.id);
            }
        }
        else{
            danmaku.setDynamicProperty("piercing", piercing);
        }
    },1);
    
}

/**
 * 弹幕击中方块
 * @param {ProjectileHitBlockAfterEvent} ev
 */
export function danmakuHitBlockEvent(ev){
    let projectile = ev.projectile;
    if(despawningDanmaku[projectile.id]) return;
    
    // 销毁弹幕
    var id = projectile.id;
    despawningDanmaku[id]=true;
    projectile.triggerEvent("despawn");
    system.runTimeout(()=>{ delete despawningDanmaku[id]; },4);

    // 销毁子弹幕
    let forks = DanmakuInterface.getForks(projectile.id);
    if(forks !== undefined){
        for(let id of forks){
            let forkDanmaku = world.getEntity(id);
            if(forkDanmaku !== undefined){
                forkDanmaku.triggerEvent("despawn");
                despawningDanmaku[id]=true;
                system.runTimeout(()=>{ delete despawningDanmaku[id]; },4);
            }
        }
        DanmakuInterface.clearForks(projectile.id);
    }
    
    return;
}



//////// Gohei ////////
const GoheiSequence = Object.freeze([
    DanmakuType.PELLET,
    DanmakuType.BALL,
    DanmakuType.ORBS,
    DanmakuType.BIG_BALL,
    DanmakuType.BUBBLE,
    DanmakuType.HEART,
    DanmakuType.AMULET,
    // DanmakuType.STAR, 用八卦炉发射
    // DanmakuType.BIG_STAR, 用八卦炉发射
    DanmakuType.GLOWEY_BALL,
]);
const GoheiPrefix = "touhou_little_maid:hakurei_gohei_";
const GoheiDefault = DanmakuType.PELLET;
/**
 * 激活由工作台合成的御币
 * @param {ItemDefinitionTriggeredBeforeEvent} ev 
 */
export function gohei_activate(ev){
    try{
        let pl = ev.source;
        let slot = pl.selectedSlot
        let container = pl.getComponent("inventory").container;
        let item = container.getItem(slot);

        if(item && item.typeId == GoheiPrefix + "crafting_table") {
            let itemStack = new ItemStack(GoheiPrefix + DanmakuType.getName(GoheiDefault), 1);
            let ench_list = itemStack.getComponent("minecraft:enchantments").enchantments;
            ench_list.addEnchantment(new Enchantment("infinity", 1));
            itemStack.getComponent("minecraft:enchantments").enchantments = ench_list;
            container.setItem(slot, itemStack);
        }
    }
    catch{}
}

/**
 * 切换御币弹种
 * @param {ItemUseOnBeforeEvent} ev 
 */
export function gohei_transform(ev){
    let origin_item = ev.itemStack;
    for(let i = 0; i < GoheiSequence.length; i++){
        let name = DanmakuType.getName(GoheiSequence[i]);
        if(GoheiPrefix + name === ev.itemStack.typeId){
            // Get index
            let index = i + 1;
            if(index >= GoheiSequence.length) index = 0;
            
            // Create item
            let itemStack = new ItemStack(GoheiPrefix + DanmakuType.getName(GoheiSequence[index]), 1);
            itemStack.getComponent("minecraft:enchantments").enchantments = origin_item.getComponent("minecraft:enchantments").enchantments;
            itemStack.getComponent("minecraft:durability").damage = origin_item.getComponent("minecraft:durability").damage;
            itemStack.setLore(origin_item.getLore());
            itemStack.nameTag = origin_item.nameTag;

            // Set item
            let player = ev.source;
            player.getComponent("inventory").container.setItem(player.selectedSlot, itemStack);

            // Send message
            player.sendMessage({rawtext:[{translate: "message.touhou_little_maid:hakurei_gohei.switch"}, {translate: `danmaku.${DanmakuType.getName(GoheiSequence[index])}.name`}]});
        }
    }
}

//////// Entity ////////
const AIMED_SHOT_PROBABILITY = 0.8; //java 0.9
/**
 * 妖精女仆攻击
 * @param {Entity} fairy 
 */
export function fairy_shoot(fairy){
    let target = fairy.target
    if(target != undefined){
        let distanceFactor = Vec.length([
            fairy.location.x - fairy.target.location.x,
            fairy.location.y - fairy.target.location.y,
            fairy.location.z - fairy.target.location.z,
        ]) / 8;
        // DanmakuShoot.create().setWorld(fairy.dimension)
        //     .setThrower(fairy).setTarget(target).setThrowerOffSet([0,1,0]).setTargetOffSet([0,1,0])
        //     .setRandomColor().setType(DanmakuType.BALL).setDamage(2).setGravity(0)
        //     .setVelocity(0.2).setInaccuracy(0)
        //     .setFanNum(3).setYawTotal(Math.PI / 6)
        //     .fanShapedShot();
        if (Math.random() <= AIMED_SHOT_PROBABILITY) {
            let temp = DanmakuShoot.create().setWorld(fairy.dimension).setThrower(fairy).setThrowerOffSet([0,1,0])
                    .setTargetOffSet([0,1,0]).setTarget(fairy.target).setRandomColor().setRandomType()
                    .setDamage((config["fairy_damage"]/100)*(distanceFactor + 1)).setGravity(0)
                    .setVelocity(0.2 * (distanceFactor + 1))
                    .setInaccuracy(0.05).aimedShot();
        } else {
            DanmakuShoot.create().setWorld(fairy.dimension).setThrower(fairy).setThrowerOffSet([0,1,0]).setTargetOffSet([0,1,0])
                    .setTarget(fairy.target).setRandomColor().setRandomType()
                    .setDamage((config["fairy_damage"]/100)*(distanceFactor + 1.5)).setGravity(0)
                    .setVelocity(0.2 * (distanceFactor + 1))
                    .setInaccuracy(0.02).setFanNum(3).setYawTotal(Math.PI / 6)
                    .fanShapedShot();
        }
    }
}
/**
 * 测试妖精女仆攻击
 * @param {Entity} entity 
 */
export function debug_shoot(entity){
    let target = entity.target
    if(target != undefined){
        let type = -1;
        if(entity.nameTag && entity.nameTag.substring(0, 10) == "thlm:debug"){
            type=parseInt(entity.nameTag.substring(10))
        }
        
        switch(type){
            case 0:{// 米字弹幕
                let fanDanmaku = DanmakuShoot.create().setWorld(entity.dimension)
                .setThrower(entity).setTarget(target).setThrowerOffSet([0,1,0]).setTargetOffSet([0,1,0])
                .setRandomColor().setType(DanmakuType.BALL).setDamage(6).setGravity(0)
                .setVelocity(0.6).setInaccuracy(0)
                .setFanNum(17).setYawTotal(Math.PI / 4)

                fanDanmaku.fanShapedShot();
                let yaw = Math.PI/8;
                for(let i = -4; i < 4; i++){
                    fanDanmaku.setAxisRotation_axis(i*yaw).fanShapedShot();
                }
            }; break;
            case 1:{// 带sigma的自机狙
                var aimDanmakuShoot =DanmakuShoot.create().setWorld(entity.dimension)
                .setThrower(entity).setTarget(target).setThrowerOffSet([0,1,0]).setTargetOffSet([0,1,0])
                .setColor(DanmakuColor.random()).setType(DanmakuType.BALL)
                .setDamage(6).setGravity(0)
                .setVelocity(0.6).setInaccuracy(Math.PI/30);

                for(let i=0; i<40;i++){
                    system.runTimeout(()=>{
                        aimDanmakuShoot.aimedShot();
                    }, i+10);
                }
            }; break;
            case 2:{// 多层弹幕
                let fanDanmaku = DanmakuShoot.create().setWorld(entity.dimension)
                .setThrower(entity).setTarget(target).setThrowerOffSet([0,1,0]).setTargetOffSet([0,1,0])
                .setRandomColor().setType(DanmakuType.BALL).setDamage(6).setGravity(0)
                .setVelocity(0.6).setInaccuracy(0)
                .setFanNum(17).setYawTotal(Math.PI / 4)

                fanDanmaku.fanShapedShot();
                let yaw = Math.PI/16;
                for(let i = -4; i < 4; i++){
                    fanDanmaku.setAxisRotation_direction(i*yaw).fanShapedShot();
                }
            } break;
            case 3:{// 带sigma的自机狙（星型）
                var aimDanmakuShoot_small =DanmakuShoot.create().setWorld(entity.dimension)
                    .setThrower(entity).setTarget(target).setThrowerOffSet([0,1,0]).setTargetOffSet([0,1,0])
                    .setColor(DanmakuColor.RANDOM).setType(DanmakuType.STAR)
                    .setDamage(6).setGravity(0)
                    .setVelocity(0.8).setInaccuracy(Math.PI/7);
                var aimDanmakuShoot_big =DanmakuShoot.create().setWorld(entity.dimension)
                    .setThrower(entity).setTarget(target).setThrowerOffSet([0,1,0]).setTargetOffSet([0,1,0])
                    .setColor(DanmakuColor.RANDOM).setType(DanmakuType.BIG_STAR)
                    .setDamage(6).setGravity(0)
                    .setVelocity(0.6).setInaccuracy(Math.PI/15);
                for(let i=0; i<20;i++){
                    system.runTimeout(()=>{
                        aimDanmakuShoot_small.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                        aimDanmakuShoot_small.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                        aimDanmakuShoot_small.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                        aimDanmakuShoot_big.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                        aimDanmakuShoot_big.setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                    }, i+10);
                }
            }break;
            case 4:{// 樱花束
                
                for(let i2=0;i2<10;i2++){
                    system.runTimeout(()=>{
                        for(let i=0;i<5;i++){
                            GoheiCherry.shoot(entity, undefined);
                        }
                    },i2)
                }
                
            };break;
            default:
                // 默认弹幕（妖精女仆）
                fairy_shoot(entity);
                break;
        }
    }
}
