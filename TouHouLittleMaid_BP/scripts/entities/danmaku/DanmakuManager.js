
import * as Tool from "../../libs/scarletToolKit"
import { ProjectileHitAfterEvent, ItemDefinitionTriggeredBeforeEvent, ItemStack, Enchantment, EntityTypes, ItemUseOnBeforeEvent,
    DynamicPropertiesDefinition, world, Entity, Vector, Dimension, DataDrivenEntityTriggerAfterEvent, DataDrivenEntityTriggerBeforeEvent, WorldInitializeAfterEvent, system } from "@minecraft/server";

import DanmakuColor  from "./DanmakuColor";
import DanmakuType   from "./DanmakuType";
import EntityDanmaku from "./EntityDanmaku";
import DanmakuShoot  from "./DanmakuShoot";

/**
 * 初始化动态属性
 * @param {WorldInitializeAfterEvent} e 
 */
export function init_dynamic_properties(e){
    let def = new DynamicPropertiesDefinition();
    def.defineString("source", 15, "0"); // Entity id
    def.defineNumber("damage", 6);

    for(let i=1; i<DanmakuType.AMOUNT; i++){
        e.propertyRegistry.registerEntityTypeDynamicProperties(def, EntityTypes.get(DanmakuType.getEntityName(i)));
    }
}

/**
 * 弹幕击中处理
 * @param {ProjectileHitAfterEvent} ev 
 * @returns 
 */
export function danmakuHitEvent(ev){
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
        let source = ev.source;
        if(source == undefined){
            let id = projectile.getDynamicProperty("source");
            if(id != "0"){
                source =  world.getEntity(id);
            }
        }

        // Do not hit source
        if(hit_info.entity == source){
            return;
        }
        // Hit other entities
        else{
            hit_info.entity.applyDamage(projectile.getDynamicProperty("damage"), {damagingEntity: source, damagingProjectile: projectile});
            projectile.triggerEvent("despawn");
        }
    }
}

//////// Gohei ////////
const GoheiSequence = Object.freeze([
    DanmakuType.PELLET,
    DanmakuType.BALL,
    DanmakuType.ORBS,
    DanmakuType.BIG_BALL
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
/**
 * 妖精女仆攻击
 * @param {Entity} fairy 
 */
export function fairy_shoot(fairy){
    let target = fairy.target
    if(target != undefined){
        DanmakuShoot.create().setWorld(fairy.dimension)
            .setThrower(fairy).setTarget(target).setThrowerOffSet([0,1,0]).setTargetOffSet([0,1,0])
            .setRandomColor().setType(DanmakuType.BALL).setDamage(6).setGravity(0)
            .setVelocity(0.4).setInaccuracy(0)
            .setFanNum(3).setYawTotal(Math.PI / 6)
            .fanShapedShot();
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
        for(let tag of entity.getTags()){
            if(tag.substring(0, 10) == "thlm:debug"){
                type=parseInt(tag.substring(10))
                break;
            }
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
            default:
                // 默认弹幕（妖精女仆）
                fairy_shoot(entity);
                break;
        }
    }
}
