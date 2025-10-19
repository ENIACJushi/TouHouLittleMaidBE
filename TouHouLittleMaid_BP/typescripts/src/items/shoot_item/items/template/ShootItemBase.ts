import {
  GameMode,
  ItemReleaseUseAfterEvent,
  ItemStack,
  ItemStartUseAfterEvent,
  Player,
} from "@minecraft/server";
import { getRandom, ItemTool } from "../../../../libs/ScarletToolKit";

export class ShootItemBase {
  /**
   * 处理开始蓄力事件
   */
  public startUseEvent (event: ItemStartUseAfterEvent) { }

  /**
   * 处理结束蓄力事件
   */
  public stopUseEvent (event: ItemReleaseUseAfterEvent) { }

  /**
   * 损耗物品
   */
  protected damageItem (item: ItemStack, player: Player, slot: number) {
    // 将损耗量应用到物品
    let durabilityComponent = item.getComponent("durability");
    // 无耐久的物品不损耗，创造模式不损耗
    if (durabilityComponent === undefined || player.getGameMode() === GameMode.Creative) {
      return;
    }
    let newItem = ItemTool.damageItem(item, 1);
    ItemTool.setPlayerSlot(player, slot, newItem);
  }

  /**
   * 播放发射音效
   */
  protected playShotSound(player: Player) {
    player.dimension.playSound('random.bow', player.location, {
      pitch: getRandom(0.330, 0.50),
      volume : 0.30
    });
  }
}