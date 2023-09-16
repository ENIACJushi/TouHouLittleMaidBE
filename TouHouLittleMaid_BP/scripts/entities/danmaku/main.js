
import * as Tool from "../../libs/scarletToolKit"
import { ProjectileHitAfterEvent, ItemDefinitionTriggeredBeforeEvent, ItemStack, Enchantment, DataDrivenEntityTriggerAfterEvent, ItemUseOnAfterEvent, ItemUseOnBeforeEvent } from "@minecraft/server";


export const DanmakuTypes = Object.freeze({
    PELLET  : {name: 'pellet'  },
    BALL    : {name: 'ball'    },
    ORBS    : {name: 'orbs'    },
    BIG_BALL: {name: 'big_ball'}
});
export const GoheiSequence = Object.freeze([
    DanmakuTypes.PELLET,
    DanmakuTypes.BALL,
    DanmakuTypes.ORBS,
    DanmakuTypes.BIG_BALL
]);
export const DefaultDanmaku = DanmakuTypes.PELLET;
export const GoheiPrefix    = "touhou_little_maid:hakurei_gohei_";
export const DanmakuPrefix  = "thlmd:danmaku_basic_";

/**
 * 
 * @param {ProjectileHitAfterEvent} ev 
 * @returns 
 */
export function danmakuHitEvent(ev){
    if(ev.getBlockHit() != undefined){
        ev.projectile.triggerEvent("despawn");
        return;
    }
    let hit_info = ev.getEntityHit()
    if(hit_info != null){
        if(hit_info.entity == ev.source){
            return;
        }
        else{
            hit_info.entity.applyDamage(8, {damagingEntity: ev.source, damagingProjectile: ev.projectile});
            ev.projectile.triggerEvent("despawn");
        }
    }
}

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
        if(item && item.typeId == GoheiPrefix + "crafting_table") {
            let itemStack = new ItemStack(GoheiPrefix + DefaultDanmaku.name, 1);
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
    for(let i = 0; i < GoheiSequence.length; i++){
        let name = GoheiSequence[i].name;
        if(GoheiPrefix + name === ev.itemStack.typeId){
            // Get index
            let index = i + 1;
            if(index >= GoheiSequence.length) index = 0;
            
            // Create item
            let itemStack = new ItemStack(GoheiPrefix + GoheiSequence[index].name, 1);
            itemStack.getComponent("minecraft:enchantments").enchantments = origin_item.getComponent("minecraft:enchantments").enchantments;
            itemStack.getComponent("minecraft:durability").damage = origin_item.getComponent("minecraft:durability").damage;
            itemStack.setLore(origin_item.getLore());
            itemStack.nameTag = origin_item.nameTag;

            // Set item
            let player = ev.source;
            player.getComponent("inventory").container.setItem(player.selectedSlot, itemStack);

            // Send message
            player.sendMessage({rawtext:[{translate: "message.touhou_little_maid:hakurei_gohei.switch"}, {translate: `danmaku.${GoheiSequence[index].name}.name`}]});
        }
    }
}