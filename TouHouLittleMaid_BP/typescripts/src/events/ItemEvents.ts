import {
  ItemStartUseAfterEvent,
  ItemStopUseAfterEvent,
  ItemUseAfterEvent,
  PlayerInteractWithBlockBeforeEvent,
  system,
  world,
} from "@minecraft/server";
import { ShootItemManager } from "../items/shoot_item/ShootItemManager";
import { altarStructure } from "../altar/AltarStructureHelper";
import { MaidManager } from "../maid/MaidManager";
import { GarageKit } from "../blocks/GarageKit";
import { MemorizableGensokyo } from "../book/MemorizableGensokyoUI";
import {isInteractContainerBlock} from "../../data/BadContainerBlocks";

export class ItemEvents {
  playerOnUse = new Map(); // 使用冷却

  // 使用
  private itemUseBefore(event: ItemUseAfterEvent) {
    let item = event.itemStack;
    if (item === undefined) return;

    if (item.typeId.substring(0, 18) === "touhou_little_maid") {
      switch (item.typeId.substring(19)) {
        case "memorizable_gensokyo": MemorizableGensokyo.onUseEvent(event); break;
        default: break;
      }
    }
  }

  // 对方块使用前
  private PlayerInteractWithBlockBeforeEvent(event: PlayerInteractWithBlockBeforeEvent) {
    const block = event.block;
    const player = event.player;
    const itemStack = event.itemStack;

    if (!this.playerOnUse.get(player.name)) {
      // 带冷却事件
      this.playerOnUse.set(player.name, true);
      system.runTimeout(() => { this.playerOnUse.delete(player.name); }, 10);

      //// 方块筛选 ////
      if (block.typeId.substring(0, 18) === "touhou_little_maid") {
        let blockName = block.typeId.substring(19);
        switch (blockName) {
          //// 祭坛平台交互 ////
          case "altar_platform_block": {
            if (!player.isSneaking) {
              system.run(() => { altarStructure.placeItemEvent(event.block.location, player); });
              event.cancel = true;
              return;
            }
          }; break;
          default: break;
        }
      };

      //// 物品筛选 ////
      if (itemStack) {
        if (itemStack.typeId.substring(0, 18) === "touhou_little_maid") {
          let itemName = itemStack.typeId.substring(19);
          switch (itemName) {
            // case "gold_microwaver_item": GoldMicrowaver.placeEvent(event); break;
            // 照片释放女仆
            case "photo": {
              MaidManager.Interact.photoOnUseEvent(event);
              break;
            }
            // 魂符释放女仆
            case "smart_slab_has_maid": {
              MaidManager.Interact.smartSlabOnUseEvent(event);
              break;
            }
            // 激活雕塑/手办
            case "chisel": {
              if (isInteractContainerBlock(event.block.typeId) && !event.player.isSneaking) {
                // 若对着容器方块使用且没有潜行，则放进去
                event.cancel = false;
              } else {
                system.run(() => { GarageKit.activate(event); });
                event.cancel = true;
              }
              break;
            }
            // 放置手办
            case "garage_kit": {
              if (isInteractContainerBlock(event.block.typeId) && !event.player.isSneaking) {
                // 若对着容器方块使用且没有潜行，则放进去
                event.cancel = false;
              } else {
                system.run(() => { GarageKit.placeEvent(event); });
                event.cancel = true;
              }
              break;
            }
            default: break;
          }
        } else if (itemStack.typeId.startsWith("tlmsi")) {
          //// 御币使用事件 ////
          if (player.isSneaking) {
            // 切换弹种
          } else if (block.typeId == "minecraft:red_wool") {
            // 祭坛激活
            system.run(() => {
              altarStructure.activate(player.dimension, event.block.location, event.blockFace);
            });
          }
          event.cancel = true;
        }
      }
    }
  }
  
  // 蓄力开始
  private itemStartUseAfter(event: ItemStartUseAfterEvent) {
    if (event.itemStack.typeId.startsWith(ShootItemManager.ITEM_PREFIX)) {
      ShootItemManager.getInstance().handleStartUseEvent(event);
    }
  }

  // 蓄力中止
  private itemStopUseAfter(event: ItemStopUseAfterEvent) {
    if (!event.itemStack) {
      return;
    }
    if (event.itemStack.typeId.startsWith(ShootItemManager.ITEM_PREFIX)) {
      ShootItemManager.getInstance().handleStopUseEvent(event);
    }
  }

  // 注册事件
  public registerAllEvents () {
    world.afterEvents.itemStartUse.subscribe(event => {
      system.run(() => { this.itemStartUseAfter(event); });
    });
    world.afterEvents.itemStopUse.subscribe(event => {
      this.itemStopUseAfter(event);
    });
    world.beforeEvents.playerInteractWithBlock.subscribe(event => {
      this.PlayerInteractWithBlockBeforeEvent(event);
    });
    // 在 1.21.132 版本，只要注册 ItemUseBeforeEvent，就会导致收纳袋无法右键扔出物品。所以这里注册 AfterEvent
    world.afterEvents.itemUse.subscribe(event => {
      system.run(() => { this.itemUseBefore(event); });
    });
  }
}