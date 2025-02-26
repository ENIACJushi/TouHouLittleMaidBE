import { ItemStack, ItemUseBeforeEvent, Player, WorldInitializeBeforeEvent, ItemComponentUseEvent } from "@minecraft/server";
import { spellCardList } from "../../data/spellcard/CustomSpellCardEntry"
import * as Tool from "../libs/ScarletToolKit"

export class CustomSpellCardManger{
    /**
    * 初始化樱之御币的自定义属性
    * @param {WorldInitializeBeforeEvent} event 
    */
    static registerCC(event){
        event.itemComponentRegistry.registerCustomComponent('tlm:spell_card', {
            onUse(useEvent){
                CustomSpellCardManger.onSpellCardUseEvent(useEvent);
            }
        });
    }
    /**
     * 吓我一跳释放符卡
     * @param {ItemComponentUseEvent} event
     */
    static onSpellCardUseEvent(event){
        
        let item = event.itemStack;
        let player = event.source;

        for(let spellCard of spellCardList){
            if(spellCard["id"] == item.typeId){
                spellCard.spellCard(player.dimension, player);
                item.getComponent("cooldown").startCooldown(player);
                return true;
            }
        }
        return false;
    }
}
