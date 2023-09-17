
import * as Tool from "../../libs/scarletToolKit"
import { ProjectileHitAfterEvent, ItemDefinitionTriggeredBeforeEvent, ItemStack, Enchantment, EntityTypes, ItemUseOnBeforeEvent,
    DynamicPropertiesDefinition, world, Entity, Vector, Dimension, DataDrivenEntityTriggerAfterEvent, DataDrivenEntityTriggerBeforeEvent, WorldInitializeAfterEvent, system } from "@minecraft/server";
import * as Shoot from "./shoot";
import * as Config from "./config"


/**
 * 
 * @param {WorldInitializeAfterEvent} e 
 */
export function init_dynamic_properties(e){
    let def = new DynamicPropertiesDefinition();
    def.defineString("source", 15, "0"); // Entity id
    def.defineNumber("damage", 8);

    for(let type in Config.DanmakuTypes){
        console.info(type)
        e.propertyRegistry.registerEntityTypeDynamicProperties(def, EntityTypes.get(Config.DanmakuPrefix + Config.DanmakuTypes[type].name));
    }
}

//////// Danmaku ////////
/**
 * 
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
/**
 * 
 * @param {ItemDefinitionTriggeredBeforeEvent} ev 
 */
export function gohei_activate(ev){
    try{
        let pl = ev.source;
        let slot = pl.selectedSlot
        let container = pl.getComponent("inventory").container;
        let item = container.getItem(slot);
        if(item && item.typeId == Config.GoheiPrefix + "crafting_table") {
            let itemStack = new ItemStack(Config.GoheiPrefix + Config.DefaultDanmaku.name, 1);
            let ench_list = itemStack.getComponent("minecraft:enchantments").enchantments;
            ench_list.addEnchantment(new Enchantment("infinity", 1));
            itemStack.getComponent("minecraft:enchantments").enchantments = ench_list;
            container.setItem(slot, itemStack);
        }
    }
    catch{}
}

/**
 * 
 * @param {ItemUseOnBeforeEvent} ev 
 */
export function gohei_transform(ev){
    let origin_item = ev.itemStack;
    for(let i = 0; i < Config.GoheiSequence.length; i++){
        let name = Config.GoheiSequence[i].name;
        if(Config.GoheiPrefix + name === ev.itemStack.typeId){
            // Get index
            let index = i + 1;
            if(index >= Config.GoheiSequence.length) index = 0;
            
            // Create item
            let itemStack = new ItemStack(Config.GoheiPrefix + Config.GoheiSequence[index].name, 1);
            itemStack.getComponent("minecraft:enchantments").enchantments = origin_item.getComponent("minecraft:enchantments").enchantments;
            itemStack.getComponent("minecraft:durability").damage = origin_item.getComponent("minecraft:durability").damage;
            itemStack.setLore(origin_item.getLore());
            itemStack.nameTag = origin_item.nameTag;

            // Set item
            let player = ev.source;
            player.getComponent("inventory").container.setItem(player.selectedSlot, itemStack);

            // Send message
            player.sendMessage({rawtext:[{translate: "message.touhou_little_maid:hakurei_gohei.switch"}, {translate: `danmaku.${Config.GoheiSequence[index].name}.name`}]});
        }
    }
}

//////// Entity ////////
/**
 * 
 * @param {Entity} fairy 
 */
export function fairy_shoot(fairy){
    let target = fairy.target
    if(target != undefined){
        let shootLocation = fairy.getHeadLocation();
        shootLocation = new Vector(shootLocation.x, shootLocation.y-0.4, shootLocation.z);
        Shoot.fanShapedShot(fairy.dimension, shootLocation, shootLocation, target.location, fairy.id,
            Config.DanmakuTypes.BALL, Math.PI / 6, 3, [0,1,0], -1, 0.6, 8, Config.DanmakuColors.RANDOM);
    }
}

export function ghast_shoot(entity){
    let target = entity.target
    if(target != undefined){
        Shoot.fanShapedShot(entity.dimension, entity.getHeadLocation(), entity.getHeadLocation(),target.location, entity.id,
            Config.DanmakuTypes.BALL, Math.PI, 18, [0,1,0], -0.5, 0.6, 8, Config.DanmakuColors.RANDOM);
        system.runTimeout(()=>{
            Shoot.fanShapedShot(entity.dimension, entity.getHeadLocation(), entity.getHeadLocation(),target.location, entity.id,
            Config.DanmakuTypes.BALL, Math.PI/2, 18, [0,1,0], -5.5, 0.6, 8, Config.DanmakuColors.RANDOM);
            Shoot.fanShapedShot(entity.dimension, entity.getHeadLocation(), entity.getHeadLocation(),target.location, entity.id,
            Config.DanmakuTypes.BALL, Math.PI/2, 18, [0,1,0], 4.5, 0.6, 8, Config.DanmakuColors.RANDOM);
        }, 5);
        system.runTimeout(()=>{
            Shoot.fanShapedShot(entity.dimension, entity.getHeadLocation(), entity.getHeadLocation(),target.location, entity.id,
            Config.DanmakuTypes.BALL, Math.PI/3, 18, [0,1,0], -4.5, 0.6, 8, Config.DanmakuColors.RANDOM);
            Shoot.fanShapedShot(entity.dimension, entity.getHeadLocation(), entity.getHeadLocation(),target.location, entity.id,
            Config.DanmakuTypes.BALL, Math.PI/3, 18, [0,1,0], 3.5, 0.6, 8, Config.DanmakuColors.RANDOM);
        }, 10);
    }
}
