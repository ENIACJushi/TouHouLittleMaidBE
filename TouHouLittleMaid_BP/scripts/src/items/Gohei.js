import { DanmakuType }   from "../danmaku/DanmakuType";
import { ItemStack, ItemUseOnBeforeEvent, EnchantmentTypes} from "@minecraft/server";
export class Gohei {
    static goheiSequence = Object.freeze([
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
    static goheiPrefix = "touhou_little_maid:hakurei_gohei_";
    static goheiDefault = DanmakuType.PELLET;
    /**
     * 激活由工作台合成的御币
     * @param {ItemUseOnBeforeEvent} ev 
     */
    static activate(ev){
        try{
            let pl = ev.source;
            let slot = pl.selectedSlotIndex
            let container = pl.getComponent("inventory").container;
            let item = container.getItem(slot);
    
            if(item && item.typeId == this.goheiPrefix + "crafting_table") {
                let itemStack = new ItemStack(this.goheiPrefix + DanmakuType.getName(this.goheiDefault), 1);
                let ench_list = itemStack.getComponent("minecraft:enchantable");
                ench_list.addEnchantment({type: EnchantmentTypes.get("infinity"), level: 1});
                container.setItem(slot, itemStack);
            }
        }
        catch{}
    }
    
    /**
     * 切换御币弹种
     * @param {ItemUseOnBeforeEvent} ev 
     * @param {string} itemName 去除前缀的物品名称，如 touhou_little_maid:hakurei_gohei_crafting_table → crafting_table
     */
    static transform(ev, danmakuName){
        let origin_item = ev.itemStack;
        if(danmakuName === "crafting_table"){
            this.activate(ev);
        }
        else{
            for(let i = 0; i < this.goheiSequence.length; i++){
                let name = DanmakuType.getName(this.goheiSequence[i]);
                if(name === danmakuName){
                    // Get index
                    let index = i + 1;
                    if(index >= this.goheiSequence.length) index = 0;
                    
                    // Create item
                    let itemStack = new ItemStack(this.goheiPrefix + DanmakuType.getName(this.goheiSequence[index]), 1);
                    itemStack.getComponent("minecraft:enchantable").addEnchantments(
                        origin_item.getComponent("minecraft:enchantable").getEnchantments()
                        );
                    itemStack.getComponent("minecraft:durability").damage = origin_item.getComponent("minecraft:durability").damage;
                    itemStack.setLore(origin_item.getLore());
                    itemStack.nameTag = origin_item.nameTag;
        
                    // Set item
                    let player = ev.source;
                    player.getComponent("inventory").container.setItem(player.selectedSlotIndex, itemStack);
        
                    // Send message
                    player.sendMessage({rawtext:[{translate: "message.touhou_little_maid:hakurei_gohei.switch"}, {translate: `danmaku.${DanmakuType.getName(this.goheiSequence[index])}.name`}]});
                }
            }
        }
    }    
}