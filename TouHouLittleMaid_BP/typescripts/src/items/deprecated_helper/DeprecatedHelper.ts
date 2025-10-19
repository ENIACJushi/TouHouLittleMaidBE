import {
  ItemStack,
  Player,
  StartupEvent,
} from "@minecraft/server";
import {ItemTool} from "../../libs/ScarletToolKit";

const CHANGE_MAP: Record<string, string> = {
  // 旧御币
  "touhou_little_maid:hakurei_gohei_pellet": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_orbs": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_ball": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_big_ball": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_bubble": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_heart": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_amulet": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_star": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_big_star": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_glowey_ball": "tlmsi:hakurei_gohei",
  "touhou_little_maid:hakurei_gohei_crafting_table": "tlmsi:hakurei_gohei",
  // 旧樱之御币
  "touhou_little_maid:hakurei_gohei_cherry": "tlmsi:sakura_gohei",
};

/**
 * 处理已弃用的物品，将它们转换为新物品
 */
export namespace DeprecatedItemHelper {
  export function registerCC(event: StartupEvent) {
    event.itemComponentRegistry.registerCustomComponent('tlm:deprecated', {
      onUse(ev) {
        console.log('huh', ev.itemStack?.typeId)
        changeItem(ev.source, ev.itemStack);
      },
      onUseOn(ev) {
        changeItem(ev.source as Player, ev.itemStack);
      },
    });
  }

  function changeItem(player: Player, oldItem?: ItemStack) {
    if (!oldItem) {
      return;
    }
    let newItem = CHANGE_MAP[oldItem.typeId];
    if (newItem) {
      ItemTool.setPlayerMainHand(player, new ItemStack(newItem));
    }
  }
}