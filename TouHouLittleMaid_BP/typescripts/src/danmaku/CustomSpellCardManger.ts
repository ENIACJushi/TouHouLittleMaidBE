import { ItemStack, ItemUseBeforeEvent, Player, ItemComponentUseEvent, StartupEvent } from "@minecraft/server";
import { spellCardList } from "../../data/spellcard/CustomSpellCardEntry"
import * as Tool from "../libs/ScarletToolKit"

export class CustomSpellCardManger {
  /**
  * 初始化樱之御币的自定义属性
  */
  static registerCC(event: StartupEvent) {
    event.itemComponentRegistry.registerCustomComponent('tlm:spell_card', {
      onUse(useEvent) {
        CustomSpellCardManger.onSpellCardUseEvent(useEvent);
      }
    });
  }
  /**
   * 吓我一跳释放符卡
   */
  static onSpellCardUseEvent(event: ItemComponentUseEvent) {
    let item = event.itemStack;
    let player = event.source;

    for (let spellCard of spellCardList) {
      if (spellCard["id"] == item?.typeId) {
        spellCard.spellCard(player.dimension, player);
        item.getComponent("cooldown")?.startCooldown(player);
        return true;
      }
    }
    return false;
  }
}
