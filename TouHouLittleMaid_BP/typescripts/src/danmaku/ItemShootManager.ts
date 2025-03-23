/**
 * TODO: 这是一个没有使用的类，需要评估是否应该保留
 * 管理物品发射弹幕
 *  发射弹幕时触发物品事件 thlm:is
 *  弹幕与物品一一对应，在定义文件中
 *   id 定义物品完整 typeId
 *   shoot 定义发射函数，接收发射实体 entity 和物品 item
 *  定义文件需要在 ItemShootManager constructor 中注册
 */
import { ItemStack, ItemUseAfterEvent, ItemUseBeforeEvent, Player } from "@minecraft/server";
import * as Tool from "../libs/ScarletToolKit"


export class ItemShootManager {
  private map: Map<string, (player: Player, item: ItemStack) => void> = new Map();

  register(id: string, shoot: () => void) {
    this.map.set(id, shoot);
  }
  /**
   * 吓我一跳释放符卡
   * @param {ItemUseBeforeEvent} event
   */
  itemShootEvent(event: ItemUseBeforeEvent) {
    let item = event.itemStack;
    let player = event.source;
    let group_function = this.map.get(item.typeId);

    let cooldown = item.getComponent("minecraft:cooldown");
    if (cooldown) {
      let remain = cooldown.getCooldownTicksRemaining(player);
      if (cooldown.cooldownTicks - remain > 1) {
        return false;
      }
    }

    if (group_function !== undefined) {
      group_function(player, item);
      return true;
    }
    return false;
  }
}
export const itemShootManager = new ItemShootManager();