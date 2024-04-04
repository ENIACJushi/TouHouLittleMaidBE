import { ItemStack, ItemUseBeforeEvent, Player } from "@minecraft/server";
import { spellCardList } from "../../data/spellcard/CustomSpellCardEntry"
import * as Tool from "../libs/ScarletToolKit"

export class CustomSpellCardManger{
    /**
     * 吓我一跳释放符卡
     * @param {ItemUseBeforeEvent} event
     */
    static onSpellCardUseEvent(event){
        let item = event.itemStack;
        let player = event.source;

        let cooldown = item.getComponent("minecraft:cooldown");
        let remain = cooldown.getCooldownTicksRemaining(player);
        if(cooldown.cooldownTicks - remain > 1 ) return false;

        for(let spellCard of spellCardList){
            if(spellCard["id"] == item.typeId){
                spellCard.spellCard(player.dimension, player);
                return true;
            }
        }
        return false;
    }
}
