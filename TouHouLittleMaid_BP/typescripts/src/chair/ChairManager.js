import { system } from "@minecraft/server";
import { CHAIR_IDENTIFIER, EntityChair } from "./EntityChair";
import * as Tool from "../libs/ScarletToolKit";

/**
 * 坐垫放置与交互管理
 *
 * - 玩家使用 `touhou_little_maid:chair` 物品点击方块 → 在点击位置生成坐垫实体；
 * - 玩家潜行与非潜行交互坐垫 → 非潜行由坐垫实体的 `minecraft:rideable` 组件自动坐上，
 *  潜行则由实体交互事件打开模型更换表单（见 EntityEvents）。
 */
export class ChairManager {
  /**
   * 从物品放置坐垫
   * @param {import("@minecraft/server").PlayerInteractWithBlockBeforeEvent} event
   */
  static placeOnUseEvent(event) {
    // 默认取消方块交互
    event.cancel = true;

    system.run(() => {
      const player = event.player;
      const dimension = player.dimension;

      // 获取放置位置
      let location = this.getSafeLocation(dimension, event.block.location, event.blockFace);
      if (location === undefined) {
        Tool.title_player_actionbar_translate(player.name, "message.touhou_little_maid:photo.not_suitable_for_place_maid.name");
        return;
      }
      location.x += 0.5;
      location.y += 0.25;
      location.z += 0.5;

      // 生成坐垫实体
      let chair = dimension.spawnEntity(CHAIR_IDENTIFIER, location);

      // 随机设置一个坐垫皮肤
      system.runTimeout(() => {
        EntityChair.Skin.setRandom(chair);
      }, 1);

      // 消耗物品（坐垫可堆叠，每次放置消耗 1 个）
      ChairManager.consumeMainHandItem(player);
    });
  }

  /**
   * 消耗玩家主手一个物品
   * @param {import("@minecraft/server").Player} player
   */
  static consumeMainHandItem(player) {
    let item = Tool.ItemTool.getPlayerMainHand(player);
    if (item === undefined) return;
    if (item.amount > 1) {
      item.amount -= 1;
      Tool.ItemTool.setPlayerMainHand(player, item);
    } else {
      Tool.ItemTool.setPlayerMainHand(player);
    }
  }

  /**
   * 获取可放置的坐垫位置（坐垫只需一格空间）
   * @param {import("@minecraft/server").Dimension} dimension
   * @param {import("@minecraft/server").Vector3} blockLocation 被点击方块位置
   * @param {import("@minecraft/server").Direction} blockFace 点击面
   * @returns {import("@minecraft/server").Vector3 | undefined}
   */
  static getSafeLocation(dimension, blockLocation, blockFace) {
    let location = { x: blockLocation.x, y: blockLocation.y, z: blockLocation.z };
    // 根据点击面计算放置位置
    if (blockFace === 1 || blockFace === "Up") { location.y += 1; }
    else if (blockFace === 0 || blockFace === "Down") { location.y -= 1; }
    else if (blockFace === 3 || blockFace === "North") { location.z -= 1; }
    else if (blockFace === 2 || blockFace === "South") { location.z += 1; }
    else if (blockFace === 4 || blockFace === "West") { location.x -= 1; }
    else if (blockFace === 5 || blockFace === "East") { location.x += 1; }
    return location;
  }
}
