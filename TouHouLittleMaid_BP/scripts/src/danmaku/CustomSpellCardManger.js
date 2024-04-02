import { ItemStack, Player } from "@minecraft/server";
import { spellCardList } from "../../data/spellcard/CustomSpellCardEntry"
import { ItemDefinitionTriggeredBeforeEvent } from "@minecraft/server";
import * as Tool from "../libs/ScarletToolKit"

export class CustomSpellCardManger{
    /**
     * 吓我一跳释放符卡
     * @param {ItemDefinitionTriggeredBeforeEvent} event
     */
    static onSpellCardUseEvent(event){
        let item = event.itemStack;
        let player = event.source;
        for(let spellCard of spellCardList){
            if(spellCard["id"] == item.typeId){
                spellCard.spellCard(player.dimension, player);
                return true;
            }
        }
        return false;
    }
}
