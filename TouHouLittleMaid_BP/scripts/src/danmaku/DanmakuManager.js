
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
    
        for(let i=1; i<=DanmakuType.AMOUNT; i++){
            e.propertyRegistry.registerEntityTypeDynamicProperties(def, EntityTypes.get(DanmakuType.getEntityName(i)));
        }
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

/**
 * 弹幕击中实体
 * @param {ProjectileHitEntityAfterEvent} ev 
 */
export function danmakuHitEntityEvent(ev){
    let projectile = ev.projectile;
    let hit_info = ev.getEntityHit()
    if(hit_info != null){
        // Get source entity by event or property
        // let damageOptions = {"damagingProjectile": projectile}; // 弹射物伤害
        let damageOptions = {"cause" : EntityDamageCause.magic} // 魔法伤害
        let source = ev.source;
        let target = hit_info.entity;
        let danmaku = ev.projectile;

        if(source == undefined){
            // 没有原版框架下的攻击实体，则通过动态属性寻找
            let id = projectile.getDynamicProperty("source");
            if(id != "0"){
                source =  world.getEntity(id);
            }
        }
        if(source != undefined) damageOptions["damagingEntity"] = source;
        // 不伤害自己
        if(hit_info.entity.id == source.id){ return; }
        // 玩家受击
        if(target.typeId==="minecraft:player"){
            // 女仆不伤害主人
            let ownerID = danmaku.getDynamicProperty("owner");
            if(ownerID!==undefined && ownerID===target.id){
                return;
            }
        }
        // 女仆受击
        else if(target.typeId==="thlmm:maid"){
            let targetOwnerID = EntityMaid.Owner.getID(target); // 目标的主人
            if(targetOwnerID !== undefined){
                // 主人不伤害自己的女仆
                // 脚本发射
                if(targetOwnerID === danmaku.getDynamicProperty("source")){
                    return;
                }
                // 御币发射
                if(source.id !== undefined && targetOwnerID === source.id){
                    return;
                }
                // 女仆不伤害相同主人的女仆
                let sourceOwnerID = danmaku.getDynamicProperty("owner");
                if(sourceOwnerID!==undefined && sourceOwnerID === targetOwnerID){
                    return;
                }
            }
        }
        // 不伤害自己的坐骑
        let rideable = target.getComponent("minecraft:rideable");
        if(rideable !== undefined){
            for(let entity of rideable.getRiders()){
                if(entity.id === danmaku.getDynamicProperty("source")){
                    return;
                }
            }
        }
        // 免伤失败，施加伤害
        hit_info.entity.applyDamage(projectile.getDynamicProperty("damage"), damageOptions);
        projectile.triggerEvent("despawn");
    }

}

/**
 * 弹幕击中方块
 * @param {ProjectileHitBlockAfterEvent} ev
 */
export function danmakuHitBlockEvent(ev){
    let projectile = ev.projectile;
    projectile.triggerEvent("despawn");
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
            DanmakuShoot.create().setWorld(fairy.dimension).setThrower(fairy).setThrowerOffSet([0,1,0]).setTargetOffSet([0,1,0])
                    .setTarget(fairy.target).setRandomColor().setRandomType()
                    .setDamage()((config["fairy_damage"]/100)*(distanceFactor + 1)).setGravity(0)
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
            default:
                // 默认弹幕（妖精女仆）
                fairy_shoot(entity);
                break;
        }
    }
}
