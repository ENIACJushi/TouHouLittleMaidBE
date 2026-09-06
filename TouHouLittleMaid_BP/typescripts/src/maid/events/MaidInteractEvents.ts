import {
  DataDrivenEntityTriggerAfterEvent,
  PlayerInteractWithEntityBeforeEvent,
  system,
} from "@minecraft/server";
import { EntityMaid } from "../EntityMaid";

const MAID_TYPE_ID = "thlmm:maid";
/** 与原先 JSON interact cooldown 0.2s 对齐 */
const SIT_TOGGLE_COOLDOWN_TICKS = 4;

/** 仍由实体 JSON interact 处理的物品（不拦截，保留准星提示） */
const JSON_INTERACT_ITEMS = new Set([
  "touhou_little_maid:camera",
  "touhou_little_maid:smart_slab_empty",
  "minecraft:saddle",
  "touhou_little_maid:npc_tool",
  "minecraft:shears",
  "touhou_little_maid:maid_backpack_small",
  "touhou_little_maid:maid_backpack_middle",
  "touhou_little_maid:maid_backpack_big",
  "minecraft:name_tag",
]);

const sitToggleCooldown = new Map<string, number>();

/**
 * 与女仆的交互事件
 */
export class MaidInteractEvents {
  /**
   * 玩家右键女仆（before）。
   * 坐下/站起不再走 JSON 属性过滤器，由脚本按 thlm:anim 判断后触发对应事件。
   */
  beforePlayerInteract(event: PlayerInteractWithEntityBeforeEvent) {
    const maid = event.target;

    // 未驯服：蛋糕驯服等仍交给原版/JSON
    if (maid.getComponent("minecraft:is_tamed") === undefined) {
      return;
    }

    const player = event.player;
    if (EntityMaid.Owner.getID(maid) !== player.id) {
      return;
    }

    const itemId = event.itemStack?.typeId;

    // 鞍：已抱起则拦住，避免重复触发 JSON 抱起事件
    if (itemId === "minecraft:saddle") {
      if (EntityMaid.isHug(maid)) {
        event.cancel = true;
      }
      return;
    }

    // 相机、魂符、背包等仍由 JSON interact 处理
    if (itemId !== undefined && JSON_INTERACT_ITEMS.has(itemId)) {
      return;
    }

    // 潜行是查包模式，不要坐下/站起
    if (player.isSneaking) {
      return;
    }

    // 抱起中不要切换坐下
    if (EntityMaid.isHug(maid)) {
      return;
    }

    const now = system.currentTick;
    const cooldownKey = `${player.id}:${maid.id}`;
    const last = sitToggleCooldown.get(cooldownKey) ?? -999;
    if (now - last < SIT_TOGGLE_COOLDOWN_TICKS) {
      event.cancel = true;
      return;
    }
    sitToggleCooldown.set(cooldownKey, now);

    const sitting = EntityMaid.isSitting(maid);
    event.cancel = true;
    system.run(() => {
      try {
        if (!maid.isValid) {
          return;
        }
        if (sitting) {
          // 站起需要延迟执行，不然移动属性会修改失败
          system.runTimeout(() => {
            EntityMaid.standUp(maid);
          }, 1);
        } else {
          EntityMaid.sitDown(maid);
        }
      } catch {
        // 实体可能已卸载
      }
    });
  }

  /**
   * 主人交互
   */
  interact(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 进入查包模式
   */
  enterInventoryMode(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 开始被抱起
   */
  startHug(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 停止被抱起
   */
  stopHug(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 坐下
   */
  sit(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 站起
   */
  stand(data: DataDrivenEntityTriggerAfterEvent) {

  }
}
